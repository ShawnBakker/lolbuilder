/**
 * C.2 — the calibration statistics (spec AC-C-7/8/9). Pure, zero I/O,
 * deterministic under a seeded RNG.
 *
 * Primary statistic: AUC over (win, loss) prediction pairs — equivalently
 * the Mann-Whitney U — the fraction of pairs where the winning game's
 * rating exceeded the losing game's, ties counting 0.5 (omitting ties
 * biases the statistic; Pass A detail). 0.5 = no ordering signal.
 *
 * CI: stratified percentile bootstrap (wins and losses resampled
 * separately, preserving class counts — avoids degenerate resamples at
 * personal sample sizes; the assumption-light standard per the research
 * pass). An AUC without its CI is the false precision this feature exists
 * to avoid: analyzeCalibration never returns one without the other.
 */

export interface CalibrationSample {
  /** Engine rating (logit units) at the capture moment. */
  rating: number;
  win: boolean;
}

export interface CalibrationAnalysis {
  n: number;
  wins: number;
  losses: number;
  /** Win/loss pair count the AUC is computed over (wins × losses). */
  pairs: number;
  /** Undefined until at least one win AND one loss exist. */
  auc: number | null;
  /** Percentile bootstrap CI, same nullability as auc. */
  ci: [number, number] | null;
  /** True when auc is null — the honest "cannot compute yet" state. */
  insufficient: boolean;
}

/** Deterministic RNG (mulberry32) — the bootstrap is seedable by rule. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** AUC over all (win, loss) pairs, ties = 0.5. Null without both classes. */
export function auc(samples: readonly CalibrationSample[]): number | null {
  const winRatings = samples.filter((s) => s.win).map((s) => s.rating);
  const lossRatings = samples.filter((s) => !s.win).map((s) => s.rating);
  if (winRatings.length === 0 || lossRatings.length === 0) return null;
  let score = 0;
  for (const w of winRatings) {
    for (const l of lossRatings) {
      if (w > l) score += 1;
      else if (w === l) score += 0.5;
    }
  }
  return score / (winRatings.length * lossRatings.length);
}

export const BOOTSTRAP_ITERATIONS = 2000;

export function analyzeCalibration(
  samples: readonly CalibrationSample[],
  opts: { iterations?: number; alpha?: number; rng?: () => number } = {},
): CalibrationAnalysis {
  const { iterations = BOOTSTRAP_ITERATIONS, alpha = 0.05, rng = mulberry32(1) } = opts;
  const wins = samples.filter((s) => s.win);
  const losses = samples.filter((s) => !s.win);
  const point = auc(samples);
  const base: Omit<CalibrationAnalysis, "auc" | "ci" | "insufficient"> = {
    n: samples.length,
    wins: wins.length,
    losses: losses.length,
    pairs: wins.length * losses.length,
  };
  if (point === null) return { ...base, auc: null, ci: null, insufficient: true };

  // stratified resample: class counts preserved, so every iteration computes
  const draw = <T>(from: readonly T[]): T[] => Array.from({ length: from.length }, () => from[Math.floor(rng() * from.length)]!);
  const stats: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = auc([...draw(wins), ...draw(losses)]);
    if (s !== null) stats.push(s);
  }
  stats.sort((a, b) => a - b);
  const at = (q: number) => stats[Math.min(stats.length - 1, Math.max(0, Math.floor(q * stats.length)))]!;
  return { ...base, auc: point, ci: [at(alpha / 2), at(1 - alpha / 2)], insufficient: false };
}

export interface ReliabilityBucket {
  /** Rating range [lo, hi) covered by this bucket. */
  lo: number;
  hi: number;
  n: number;
  wins: number;
}

/**
 * The ≤3-bucket reliability view (AC-C-9) — the secondary, contaminated-
 * by-non-draft-factors display. Buckets are rating terciles of the actual
 * sample (equal-count, not equal-width): a personal sample supports no
 * finer resolution, per the power math.
 */
export function reliabilityBuckets(samples: readonly CalibrationSample[], bucketCount = 3): ReliabilityBucket[] {
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => a.rating - b.rating);
  const count = Math.min(bucketCount, sorted.length);
  const out: ReliabilityBucket[] = [];
  for (let b = 0; b < count; b++) {
    const start = Math.floor((b * sorted.length) / count);
    const end = Math.floor(((b + 1) * sorted.length) / count);
    const slice = sorted.slice(start, end);
    if (slice.length === 0) continue;
    out.push({
      lo: slice[0]!.rating,
      hi: slice[slice.length - 1]!.rating,
      n: slice.length,
      wins: slice.filter((s) => s.win).length,
    });
  }
  return out;
}
