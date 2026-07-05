/**
 * Outcome reconciliation (C.1, AC-C-4/5/6): on helper launch, every logged
 * prediction without a recorded outcome gets one fetch attempt. Outcomes
 * are their OWN append-only JSONL (calibration-outcomes.jsonl) — the
 * capture log is never rewritten. Join key: gameId.
 *
 * - Own result resolves by championId — unique across both teams in draft
 *   queues (400/420/440), so exactly one participant must match; anything
 *   else fails loud (AC-C-6), records nothing.
 * - Dodge orphans (AC-C-5): a 404 older than ORPHAN_AFTER_MS marks the
 *   gameId orphaned (dodged drafts never become matches); younger 404s
 *   stay pending for the next launch.
 * - gold/xp diff @15 stored alongside (calibration research: the
 *   intermediate outcome accumulates from day one; games under 15min get
 *   nulls).
 * - Politeness: sequential, spaced, hard per-launch cap — dropped
 *   remainder is LOGGED, not silent.
 */
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { OUTCOME_SCHEMA } from "@lolbuilder/types";
import { defaultLogDir } from "./calibration-store.js";
import { fetchMatch, fetchTimeline, keyState, type RiotResult } from "./riot.js";
import { log, logError } from "./sanitize.js";

const MAX_PER_LAUNCH = 15;
const SPACING_MS = 1200;
const ORPHAN_AFTER_MS = 24 * 3600 * 1000;

interface Deps {
  getMatch: typeof fetchMatch;
  getTimeline: typeof fetchTimeline;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Injectable so tests can exercise the PC-C-2 gate WITHOUT the real key literal ever existing in the repo. */
  keyState: typeof keyState;
}

const readJsonl = (file: string): Array<Record<string, unknown>> =>
  existsSync(file)
    ? readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Record<string, unknown>)
    : [];

export async function reconcileOutcomes(
  dir: string = defaultLogDir(),
  deps: Deps = { getMatch: fetchMatch, getTimeline: fetchTimeline, now: Date.now, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), keyState },
): Promise<void> {
  const state = deps.keyState();
  if (state === "absent") {
    log("outcome reconcile: no RIOT_KEY in environment — skipped (normal on machines without a key)");
    return;
  }
  if (state === "compromised") {
    // PC-C-2, enforced: rotation VERIFIED, not assumed.
    logError("outcome reconcile REFUSED: RIOT_KEY is the chat-transited key (PC-C-2) — rotate it at developer.riotgames.com, then relaunch");
    return;
  }

  const logFile = join(dir, "calibration-log.jsonl");
  const outFile = join(dir, "calibration-outcomes.jsonl");
  const entries = readJsonl(logFile);
  const done = new Set(readJsonl(outFile).map((o) => o["gameId"] as number));

  // one work item per game (entries come in at-pick/finalization pairs)
  const pending = new Map<number, Record<string, unknown>>();
  for (const e of entries) {
    const gid = e["gameId"] as number;
    if (done.has(gid) || pending.has(gid)) continue;
    if (typeof e["platform"] !== "string" || !e["platform"]) {
      logError(`outcome reconcile: game ${gid} has no platform (logged before resolution succeeded) — set LEAGUE_PLATFORM and it will retry; skipped loudly, not silently`);
      continue;
    }
    pending.set(gid, e);
  }
  if (pending.size === 0) return;

  const work = [...pending.entries()].slice(0, MAX_PER_LAUNCH);
  if (pending.size > work.length) log(`outcome reconcile: ${pending.size - work.length} game(s) beyond the per-launch cap — next launch continues`);

  let fetched = 0;
  for (const [gameId, entry] of work) {
    if (fetched > 0) await deps.sleep(SPACING_MS);
    fetched++;
    const platform = entry["platform"] as string;
    let match: RiotResult;
    try {
      match = await deps.getMatch(platform, gameId);
    } catch (err) {
      logError(`outcome reconcile: network failure on game ${gameId} — stays pending`, err);
      continue;
    }
    if (match.status === 403 || match.status === 401) {
      logError(`outcome reconcile ABORTED: Riot rejected the key (HTTP ${match.status}) — expired or invalid; regenerate at developer.riotgames.com. Nothing recorded.`);
      return; // every later fetch would fail the same way
    }
    if (match.status === 404) {
      const lockedAt = Date.parse(String(entry["lockedAt"] ?? ""));
      if (Number.isFinite(lockedAt) && deps.now() - lockedAt > ORPHAN_AFTER_MS) {
        appendFileSync(outFile, JSON.stringify({ schema: OUTCOME_SCHEMA, gameId, platform, orphaned: true, fetchedAt: new Date(deps.now()).toISOString() }) + "\n");
        log(`outcome reconcile: game ${gameId} orphaned (no match after 24h — dodge)`);
      }
      continue; // young 404: still pending
    }
    if (match.status !== 200 || match.body === null) {
      logError(`outcome reconcile: HTTP ${match.status} on game ${gameId} — stays pending`);
      continue;
    }

    const info = (match.body as { info?: { participants?: Array<Record<string, unknown>>; gameDuration?: number } }).info;
    const pickCid = ((entry["draft"] as Record<string, unknown>)["pick"] as Record<string, unknown>)["cid"] as number;
    const mine = (info?.participants ?? []).filter((p) => p["championId"] === pickCid);
    if (mine.length !== 1) {
      // AC-C-6: fail loud, record nothing — never guess a result.
      logError(`outcome reconcile: game ${gameId} matched ${mine.length} participants for champion ${pickCid} (expected exactly 1) — recorded nothing`);
      continue;
    }
    const me = mine[0]!;

    let gold15: number | null = null;
    let xp15: number | null = null;
    try {
      const tl = await deps.getTimeline(platform, gameId);
      const frames = (tl.body as { info?: { frames?: Array<{ participantFrames: Record<string, { totalGold: number; xp: number }> }> } } | null)?.info?.frames;
      if (tl.status === 200 && frames && frames.length > 15) {
        const myTeam = (me["teamId"] as number) ?? 0;
        const teamOf = new Map((info?.participants ?? []).map((p) => [p["participantId"] as number, p["teamId"] as number]));
        let g = 0, x = 0;
        for (const [pid, frame] of Object.entries(frames[15]!.participantFrames)) {
          const sign = teamOf.get(Number(pid)) === myTeam ? 1 : -1;
          g += sign * frame.totalGold;
          x += sign * frame.xp;
        }
        gold15 = g;
        xp15 = x;
      }
    } catch {
      // timeline is a bonus signal — its failure never blocks the outcome
    }

    appendFileSync(
      outFile,
      JSON.stringify({
        schema: OUTCOME_SCHEMA,
        gameId,
        platform,
        win: me["win"] === true,
        gameDurationSec: info?.gameDuration ?? null,
        gold15,
        xp15,
        fetchedAt: new Date(deps.now()).toISOString(),
      }) + "\n",
    );
    log(`outcome reconcile: game ${gameId} → ${me["win"] === true ? "WIN" : "LOSS"} recorded`);
  }
}
