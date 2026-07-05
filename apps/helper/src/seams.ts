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
 * SEAM 2 — calibration local-log: REALIZED at C.0 (2026-07-04). The stub
 * that lived here became `calibration-store.ts` + the `/calibration-log`
 * POST route (see the calibration spec, AC-C-1/1b/2/3). Kept as a pointer
 * so the seam's history is findable; the remaining seam in this file is
 * the vs-route build fetch only.
 */
