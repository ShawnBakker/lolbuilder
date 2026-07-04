/**
 * PC-M7-3 champ-select probe — DISPOSABLE instrument (PC-6 stub pattern).
 * Answers empirical questions, then gets deleted. This is NOT the helper.
 *
 * Answers, with pass criteria printed explicitly:
 *   CHECK 1  does /lol-champ-select/v1/session expose enemy champions?
 *   CHECK 2  does it expose position/role hints for enemies (yes/no/partial)?
 *   CHECK 3  does league-connect still work against the live LCU? (PC-M7-2)
 *   CHECK 4  does the hand-rolled ~50-line path work? (PC-M7-2's alternative)
 *   CHECK 5  is the websocket event stream reachable? (OI-M7-2, note only)
 *
 * Scope: LCU only, lockfile auth. NO Riot Web API key — that surface is
 * reserved for the calibration milestone; this probe never references it.
 * Hard lines: read-only (GETs only), local-only, lockfile token REDACTED
 * from every output (first live exercise of AC-M7-11's concern).
 *
 * Run: node tools/pc-m7-3-probe.mjs   (League client open; then enter any
 * champ-select — see bottom-of-file note on Custom vs matchmade)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import https from "node:https";

const DUMP = "tools/pc-m7-3-session-dump.json";
let TOKEN = null; // set as soon as known; every output routes through redact()

const redact = (s) => (TOKEN ? String(s).split(TOKEN).join("[REDACTED-TOKEN]") : String(s));
const log = (...a) => console.log(...a.map(redact));

// ---------- hand-rolled path (the ~50-line control, PC-M7-2 alternative) ----
function readLockfile() {
  const candidates = [
    process.env.LEAGUE_LOCKFILE,
    "C:/Riot Games/League of Legends/lockfile",
    "D:/Riot Games/League of Legends/lockfile",
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) {
      const [name, pid, port, password, protocol] = readFileSync(p, "utf8").trim().split(":");
      return { name, pid, port: Number(port), password, protocol, path: p };
    }
  }
  return null;
}

function lcuGet(port, password, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { Authorization: "Basic " + Buffer.from(`riot:${password}`).toString("base64") },
        rejectUnauthorized: false, // LCU uses a self-signed cert; local-only
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

// ---------- payload analysis (the actual PC-M7-3 questions) ----------------
function analyze(session) {
  const team = (arr = []) =>
    arr.map((p) => ({
      cellId: p.cellId,
      championId: p.championId ?? null,
      championPickIntent: p.championPickIntent ?? null,
      assignedPosition: p.assignedPosition ?? null,
      isBot: p.isBot ?? undefined,
    }));
  const my = team(session.myTeam);
  const their = team(session.theirTeam);

  const enemiesWithChamp = their.filter((p) => p.championId && p.championId > 0).length;
  const enemiesWithPos = their.filter((p) => p.assignedPosition && p.assignedPosition !== "").length;
  const alliesWithPos = my.filter((p) => p.assignedPosition && p.assignedPosition !== "").length;

  log("");
  log("=== CHECK 1 — enemy champions exposed:", their.length === 0 ? "NO theirTeam AT ALL" : `${enemiesWithChamp}/${their.length} enemy slots carry a championId > 0`);
  log("=== CHECK 2 — enemy position hints:", their.length === 0 ? "n/a" : enemiesWithPos === their.length ? "YES (all)" : enemiesWithPos > 0 ? `PARTIAL (${enemiesWithPos}/${their.length})` : "NO (all empty)");
  log(`    (ally positions, for contrast: ${alliesWithPos}/${my.length})`);
  log("    myTeam:   ", JSON.stringify(my));
  log("    theirTeam:", JSON.stringify(their));
  log("    bans:     ", JSON.stringify(session.bans ?? "absent"), "(freebie for F8)");
  log("    timer.phase:", session.timer?.phase ?? "absent", "| top-level keys:", Object.keys(session).join(","));
}

// ---------- main ------------------------------------------------------------
log("PC-M7-3 probe starting. GETs only; token redacted from all output.\n");

// lockfile first (both paths need the port; token enables redaction ASAP)
const lock = readLockfile();
if (!lock) {
  log("FAIL: no lockfile found (League client running? non-default install -> set LEAGUE_LOCKFILE=<path>)");
  process.exit(1);
}
TOKEN = lock.password;
log(`lockfile: ${lock.path} -> port ${lock.port} (token read, redaction armed)`);

// CHECK 3 — league-connect against the live client (PC-M7-2)
let lcCreds = null;
let lcError = null;
try {
  const lc = await import("league-connect");
  lcCreds = await lc.authenticate();
  log("=== CHECK 3 — league-connect authenticate(): OK (found client)");
  try {
    const res = await lc.createHttp1Request({ method: "GET", url: "/lol-gameflow/v1/gameflow-phase" }, lcCreds);
    log(`    league-connect GET gameflow-phase: ${JSON.stringify(res.json())}`);
  } catch (e) {
    lcError = e;
    log(`    league-connect request FAILED: ${e.name}: ${e.message}`);
  }
} catch (e) {
  lcError = e;
  log(`=== CHECK 3 — league-connect FAILED: ${e.name}: ${e.message}`);
  log("    (evidence for the hand-roll decision — full stack below)");
  log(String(e.stack ?? "").split("\n").slice(0, 5).join("\n"));
}

// CHECK 4 — hand-rolled control (always runs; PC-M7-2's alternative evidence)
const phase = await lcuGet(lock.port, lock.password, "/lol-gameflow/v1/gameflow-phase");
log(`=== CHECK 4 — hand-rolled GET gameflow-phase: HTTP ${phase.status} ${redact(phase.body)}`);

// CHECK 5 — websocket reachability (note only, informs OI-M7-2)
try {
  const lc = await import("league-connect");
  const ws = await lc.createWebSocketConnection({ authenticationOptions: {}, pollInterval: 1000, maxRetries: 2 }).catch(async () => lc.createWebSocketConnection(lcCreds));
  log("=== CHECK 5 — websocket: REACHABLE (league-connect)");
  ws.close?.();
} catch (e) {
  log(`=== CHECK 5 — websocket: NOT verified via league-connect (${e.message}); hand-rolled ws needs a dep — /plan evidence, not a blocker`);
}

// Continuous capture: poll through the whole champ-select, save every
// DISTINCT snapshot, log a timeline of enemy-reveal events. Built for the
// dodge run: whatever appears, whenever it appears, gets captured the cycle
// it appears — the operator can dodge as soon as enemy picks are visible.
log("\nwaiting for champ-select (poll 2s, up to 10 min — queue now)...");
const t0 = Date.now();
let snaps = 0;
let lastBody = null;
let sawSession = false;
const timeline = [];
while (Date.now() - t0 < 10 * 60 * 1000) {
  const res = await lcuGet(lock.port, lock.password, "/lol-champ-select/v1/session").catch(() => null);
  if (res && res.status === 200) {
    sawSession = true;
    const raw = redact(res.body);
    if (raw !== lastBody) {
      lastBody = raw;
      snaps++;
      writeFileSync(DUMP.replace(".json", `-${String(snaps).padStart(2, "0")}.json`), raw);
      const s = JSON.parse(raw);
      const enemyChamps = (s.theirTeam ?? []).filter((p) => p.championId > 0).map((p) => p.championId);
      const enemyPos = (s.theirTeam ?? []).filter((p) => p.assignedPosition).map((p) => p.assignedPosition);
      const enemyActs = (s.actions ?? []).flat().filter((a) => a.isAllyAction === false);
      const line = {
        t: Math.round((Date.now() - t0) / 1000),
        phase: s.timer?.phase,
        enemyChampionIds: enemyChamps,
        enemyPositions: enemyPos,
        enemyActions: enemyActs.map((a) => ({ type: a.type, championId: a.championId, completed: a.completed })),
      };
      timeline.push(line);
      log(`snap ${String(snaps).padStart(2, "0")} t+${line.t}s phase=${line.phase} enemyChamps=[${enemyChamps.join(",")}] enemyPos=[${enemyPos.join(",")}] enemyActions=${JSON.stringify(line.enemyActions)}`);
    }
  } else if (sawSession) {
    log("\nsession ended (dodge/exit/game-start) — capture complete");
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}

if (!sawSession) {
  log("no champ-select session appeared (HTTP 404 throughout) — client was never in champ-select");
} else if (lastBody) {
  log(`\n${snaps} distinct snapshots saved. FINAL state analysis:`);
  analyze(JSON.parse(lastBody));
  log("\nENEMY-REVEAL TIMELINE (the CHECK 1/2 evidence):");
  for (const l of timeline) {
    log(`  t+${l.t}s ${l.phase}: champs=[${l.enemyChampionIds.join(",")}] pos=[${l.enemyPositions.join(",")}] actions=${JSON.stringify(l.enemyActions)}`);
  }
}
log("\nprobe done. Bring back the console output + the dump file(s).");
