/**
 * C.2 dev readout (G1, dev-facing — run: pnpm --filter @lolbuilder/helper readout)
 * Joins the capture log with reconciled outcomes and prints the diagnostic:
 * AUC + bootstrap CI per score phase (finalization primary, at-pick
 * secondary — never blended, AC-C-7), counts always, and the honest
 * "insufficient" state when the sample can't support a number (AC-C-8).
 * Reads the local files only; computes via @lolbuilder/core; writes nothing.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeCalibration, reliabilityBuckets, type CalibrationSample } from "@lolbuilder/core";
import { defaultLogDir } from "./calibration-store.js";
import { log } from "./sanitize.js";

const dir = defaultLogDir();
const read = (f: string): Array<Record<string, unknown>> =>
  existsSync(join(dir, f))
    ? readFileSync(join(dir, f), "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as Record<string, unknown>)
    : [];

const entries = read("calibration-log.jsonl");
const outcomes = read("calibration-outcomes.jsonl");
const results = new Map(outcomes.filter((o) => typeof o["win"] === "boolean").map((o) => [o["gameId"] as number, o["win"] as boolean]));
const orphans = outcomes.filter((o) => o["orphaned"] === true).length;
const pending = new Set(entries.map((e) => e["gameId"] as number)).size - results.size - orphans;

log(`calibration readout — ${dir}`);
log(`games logged: ${new Set(entries.map((e) => e["gameId"])).size} | outcomes: ${results.size} | orphaned: ${orphans} | pending: ${pending}`);

for (const phase of ["finalization", "at-pick"] as const) {
  const samples: CalibrationSample[] = entries
    .filter((e) => e["phase"] === phase && results.has(e["gameId"] as number))
    .map((e) => ({ rating: e["rating"] as number, win: results.get(e["gameId"] as number)! }));
  const a = analyzeCalibration(samples);
  log(`--- ${phase}${phase === "finalization" ? " (primary)" : " (secondary — a different question, never blended)"}`);
  if (a.insufficient) {
    log(`  n=${a.n} (${a.wins}W/${a.losses}L, ${a.pairs} pairs) — INSUFFICIENT: AUC needs at least one win and one loss. No number is the honest output.`);
    continue;
  }
  log(`  AUC ${a.auc!.toFixed(3)} [${a.ci![0].toFixed(3)}, ${a.ci![1].toFixed(3)}] over n=${a.n} (${a.wins}W/${a.losses}L, ${a.pairs} pairs)`);
  log(`  reading: 0.5 = no ordering signal; the CI is the claim, the point estimate is not`);
  for (const b of reliabilityBuckets(samples)) {
    log(`  bucket [${b.lo.toFixed(2)}..${b.hi.toFixed(2)}]: ${b.wins}/${b.n} wins (contaminated view — non-draft factors dominate)`);
  }
}
