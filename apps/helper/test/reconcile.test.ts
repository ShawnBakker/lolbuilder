/**
 * C.1 reconciler (AC-C-4/5/6): outcomes append to their own file, the
 * capture log is never rewritten, dodges orphan after the window, key
 * failures abort loudly without corruption, ambiguous participant matches
 * record nothing, and the PC-C-2 gate refuses the chat-transited key.
 */
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALIBRATION_SCHEMA } from "@lolbuilder/types";
import { reconcileOutcomes } from "../src/reconcile.js";

let dir: string;
const NOW = 1_800_000_000_000;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "reconcile-"));
  process.env["RIOT_KEY"] = "RGAPI-fresh-key-for-tests";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env["RIOT_KEY"];
  vi.restoreAllMocks();
});

const logEntry = (gameId: number, over: Record<string, unknown> = {}) =>
  appendFileSync(
    join(dir, "calibration-log.jsonl"),
    JSON.stringify({
      schema: CALIBRATION_SCHEMA, gameId, platform: "NA1", queueId: 420, phase: "finalization",
      rating: -0.1, draft: { pick: { cid: 8, lane: "middle" }, allies: [], enemies: [] },
      enemiesVisible: 5, alliesVisible: 5, lockedAt: new Date(NOW - 60_000).toISOString(),
      context: { patch: "16.13", kMatchup: 25, kSynergy: 50 },
      ...over,
    }) + "\n",
  );

const matchBody = (win: boolean) => ({
  status: 200,
  body: {
    info: {
      gameDuration: 1560,
      participants: [
        { participantId: 1, championId: 8, teamId: 100, win },
        { participantId: 6, championId: 21, teamId: 200, win: !win },
      ],
    },
  },
});

const timelineBody = {
  status: 200,
  body: { info: { frames: Array.from({ length: 20 }, () => ({ participantFrames: { "1": { totalGold: 9000, xp: 8000 }, "6": { totalGold: 7000, xp: 7500 } } })) } },
};

const deps = (getMatch: any, getTimeline: any = () => Promise.resolve(timelineBody), keyState: any = () => "usable") => ({
  getMatch, getTimeline, now: () => NOW, sleep: () => Promise.resolve(), keyState,
});

const outcomes = () => {
  const f = join(dir, "calibration-outcomes.jsonl");
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>) : [];
};

describe("reconcileOutcomes (C.1)", () => {
  it("records win/loss + gold/xp@15 for a pending game; the capture log is untouched", async () => {
    logEntry(111);
    const before = readFileSync(join(dir, "calibration-log.jsonl"), "utf8");
    await reconcileOutcomes(dir, deps(() => Promise.resolve(matchBody(false))));
    const out = outcomes();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ gameId: 111, win: false, gold15: 2000, xp15: 500 });
    expect(readFileSync(join(dir, "calibration-log.jsonl"), "utf8")).toBe(before); // append-only discipline
  });

  it("already-reconciled games are not refetched; at-pick/finalization pairs are ONE work item", async () => {
    logEntry(111, { phase: "at-pick" });
    logEntry(111); // finalization, same game
    const getMatch = vi.fn(() => Promise.resolve(matchBody(true)));
    await reconcileOutcomes(dir, deps(getMatch));
    await reconcileOutcomes(dir, deps(getMatch)); // second launch
    expect(getMatch).toHaveBeenCalledTimes(1);
    expect(outcomes()).toHaveLength(1);
  });

  it("dodge-orphans: 404 older than 24h marks orphaned; younger 404 stays pending (AC-C-5)", async () => {
    logEntry(111, { lockedAt: new Date(NOW - 25 * 3600 * 1000).toISOString() }); // old dodge
    logEntry(222, { lockedAt: new Date(NOW - 3600 * 1000).toISOString() }); // young 404
    await reconcileOutcomes(dir, deps(() => Promise.resolve({ status: 404, body: null })));
    const out = outcomes();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ gameId: 111, orphaned: true });
    // 222 stays pending: next launch retries it
    const getMatch = vi.fn(() => Promise.resolve(matchBody(true)));
    await reconcileOutcomes(dir, deps(getMatch));
    expect(getMatch).toHaveBeenCalledWith("NA1", 222);
  });

  it("403 aborts the whole run loudly and records NOTHING (AC-C-6)", async () => {
    logEntry(111);
    logEntry(222);
    const getMatch = vi.fn(() => Promise.resolve({ status: 403, body: null }));
    await reconcileOutcomes(dir, deps(getMatch));
    expect(getMatch).toHaveBeenCalledTimes(1); // aborted after the first — no pointless hammering
    expect(outcomes()).toHaveLength(0);
    expect(console.error).toHaveBeenCalled();
  });

  it("ambiguous participant match records nothing — a result is never guessed (AC-C-6)", async () => {
    logEntry(111);
    const twoVlads = {
      status: 200,
      body: { info: { gameDuration: 1000, participants: [
        { participantId: 1, championId: 8, teamId: 100, win: true },
        { participantId: 6, championId: 8, teamId: 200, win: false },
      ] } },
    };
    await reconcileOutcomes(dir, deps(() => Promise.resolve(twoVlads)));
    expect(outcomes()).toHaveLength(0);
  });

  it("timeline failure never blocks the outcome (gold15 nulls)", async () => {
    logEntry(111);
    await reconcileOutcomes(dir, deps(() => Promise.resolve(matchBody(true)), () => Promise.reject(new Error("nope"))));
    expect(outcomes()[0]).toMatchObject({ gameId: 111, win: true, gold15: null, xp15: null });
  });

  it("PC-C-2 gate: a compromised-fingerprint key is REFUSED — zero requests, loud error", async () => {
    // keyState injected: the real key literal must never exist in this repo,
    // so the gate is exercised via its state, and riot.test.ts pins the
    // fingerprint mechanism itself.
    logEntry(111);
    const getMatch = vi.fn();
    await reconcileOutcomes(dir, deps(getMatch, undefined, () => "compromised"));
    expect(getMatch).not.toHaveBeenCalled();
    expect(outcomes()).toHaveLength(0);
    const errText = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat().join(" ");
    expect(errText).toContain("PC-C-2");
  });

  it("no key: skipped quietly (normal on friends' machines)", async () => {
    logEntry(111);
    const getMatch = vi.fn();
    await reconcileOutcomes(dir, deps(getMatch, undefined, () => "absent"));
    expect(getMatch).not.toHaveBeenCalled();
  });
});
