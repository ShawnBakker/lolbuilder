/**
 * Rate math. All win rates are percentages (0–100), matching the source
 * payloads; logit space is where contributions become additive (D8).
 *
 * OI-3 (resolved 2026-07-03, empirically): the source's d1/d2 are
 * PERCENTAGE-POINT deltas — d1 = vsWr − allWr exactly, across all 63,972
 * production matchup rows; d2 = d1 minus a champion-level normalizer.
 * They are never logit addends. The engine therefore consumes raw
 * (wr, n) cells and derives its own logit-space deltas post-shrinkage;
 * d1 survives only as a UI explanation aid.
 */

/** Bayesian shrinkage: pull `wr` toward `baselineWr` by k pseudo-games. */
export function shrinkWr(wr: number, n: number, baselineWr: number, k: number): number {
  if (!(n >= 0) || !(k >= 0)) throw new Error(`shrinkWr: invalid n=${n} k=${k}`);
  if (n + k === 0) return baselineWr;
  return (wr * n + baselineWr * k) / (n + k);
}

/** Logit of a percentage; domain-guarded — shrinkage keeps inputs interior. */
export function logitPct(wrPct: number): number {
  const p = wrPct / 100;
  if (!(p > 0 && p < 1)) throw new Error(`logitPct: ${wrPct} outside (0,100)`);
  return Math.log(p / (1 - p));
}
