/**
 * Shrinkage pseudo-counts, per source (spec AC-11 / OI-4).
 *
 * Why per-source: matchup cells arrive source-floored at n≥100 (min observed
 * 101), so a large k would shrink a floor-passing cell by up to a third and
 * flatten the signal the tool exists to surface. Synergy cells have NO source
 * floor — n=1 rows at 100% WR exist in live data — and need the full
 * discipline.
 *
 * Values set by the OI-4 sensitivity sweep (scripts/oi4-sweep.ts) over the
 * patch-16.13 production dataset; the sweep's decision record lives in
 * docs/analysis/m3-m4-verification.md. Tunable with documentation — never
 * remove shrinkage itself.
 */
export const K_MATCHUP = 25;
export const K_SYNERGY = 50;

/**
 * Phase groups over bucket indices (spec AC-15). Minute labels are BLOCKED
 * until OI-1 verifies bucket boundaries — buckets carry no minute data in the
 * payload (scanned 2026-07-03), so phases stay relative: early/mid/late by
 * game-length rank, not by clock.
 */
export const PHASE_BUCKETS = {
  early: ["1", "2"],
  mid: ["3", "4"],
  late: ["5", "6", "7"],
} as const;
export type Phase = keyof typeof PHASE_BUCKETS;

/**
 * Below this many games a phase aggregate renders "insufficient data", never
 * a number (spec AC-16). Mirrors the source's own 100-game matchup floor.
 */
export const PHASE_FLOOR_N = 100;

/**
 * Shrinkage for phase aggregates (AC-16 "same shrinkage discipline").
 * Phase cells have no source floor (bucket 1 can be tiny for low-PR champs),
 * so they get the synergy-grade k.
 */
export const K_PHASE = 50;

/** Confidence tiers from the min sample size across consumed cells (AC-12). */
export const CONFIDENCE_LEVELS = [
  { min: 1000, level: "high" },
  { min: 200, level: "medium" },
  { min: 0, level: "low" },
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]["level"];
