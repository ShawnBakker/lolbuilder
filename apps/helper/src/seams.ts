/**
 * SEAM STUBS (AC-M7-15) — deliberately unimplemented. These exist so the
 * next milestones extend the helper instead of re-architecting it. Zero
 * feature ships behind either; both throw, and a test asserts they throw,
 * so nothing half-built can sneak out.
 */

/**
 * SEAM 1 — matchup-conditioned builds (the v2 feature named in the spec
 * amendment). The browser cannot fetch lolalytics cross-origin (no CORS),
 * but this local process can: one polite request to the vs-route
 * (`lolalytics.com/lol/<us>/vs/<them>/build/q-data.json`, shape validated
 * 2026-07-03) for the ONE live matchup at champ-select time. Politeness
 * rules (2s spacing, honest UA) apply when implemented.
 */
export interface MatchupBuildRequest {
  ourSlug: string;
  theirSlug: string;
  patch: string;
}

export function fetchMatchupBuild(_req: MatchupBuildRequest): never {
  throw new Error("not implemented: matchup-conditioned builds are a post-M7 milestone (spec §1 amendment; seam only)");
}

/**
 * SEAM 2 — calibration local-log (the v2 feature that needs local
 * persistence; the no-database decision flagged this as its one exception).
 * Append-only JSONL on the friend's machine: predicted rating at lock-in,
 * joined later with the actual result via Match-V5 (needs the PC-5 key —
 * which this helper deliberately does NOT touch in M7).
 */
export interface CalibrationEntry {
  gameId: number;
  patch: string;
  pickCid: number;
  rating: number;
  lockedAt: string;
}

export function appendCalibrationEntry(_entry: CalibrationEntry): never {
  throw new Error("not implemented: calibration logging is a post-M7 milestone (spec F-M7-7; seam only)");
}
