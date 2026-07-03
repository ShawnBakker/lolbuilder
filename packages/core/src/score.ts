/**
 * Composite pick assessment (spec F4). Pure: cells in, PickScore out.
 *
 * FRAMING INVARIANT (AC-13): the composite is a `rating` in logit units —
 * a ranking heuristic, never a probability. No probability appears in this
 * API; any percentage display happens in the UI beside its uncertainty
 * treatment.
 */
import { CONFIDENCE_LEVELS, K_MATCHUP, K_SYNERGY, type ConfidenceLevel } from "./constants.js";
import { logitPct, shrinkWr } from "./math.js";

export interface ScoreConfig {
  kMatchup: number;
  kSynergy: number;
}
export const DEFAULT_CONFIG: ScoreConfig = { kMatchup: K_MATCHUP, kSynergy: K_SYNERGY };

/** One consumed data cell: a win rate with its sample size. */
export interface RateCell {
  wr: number;
  n: number;
}

export interface ScoreCells {
  /** Pick's role-baseline WR (the shrinkage target for every other cell). */
  baseline: RateCell;
  /** Matchup cells vs enemies (lane opponent and cross-lane alike). */
  matchups: Array<RateCell & { cid: number }>;
  /** Duo cells with allies, keyed by the ally's champion id. */
  synergies: Array<RateCell & { cid: number }>;
  /** Enemies/allies with no data cell — surfaced, never silently dropped. */
  missing: Array<{ kind: "matchup" | "synergy"; cid: number }>;
}

export interface ScoreComponent {
  kind: "baseline" | "matchup" | "synergy";
  cid?: number;
  /** Contribution in logit units (baseline carries the base value). */
  delta: number;
  n: number;
}

export interface PickScore {
  /** Logit-space rating — a ranking heuristic, NOT a probability (AC-13). */
  rating: number;
  components: ScoreComponent[];
  /** From the min sample size across consumed cells (AC-12). */
  confidence: { minN: number; level: ConfidenceLevel };
  missing: ScoreCells["missing"];
}

export function scorePick(cells: ScoreCells, config: ScoreConfig = DEFAULT_CONFIG): PickScore {
  const base = logitPct(cells.baseline.wr);
  const components: ScoreComponent[] = [{ kind: "baseline", delta: base, n: cells.baseline.n }];

  for (const m of cells.matchups) {
    const delta = logitPct(shrinkWr(m.wr, m.n, cells.baseline.wr, config.kMatchup)) - base;
    components.push({ kind: "matchup", cid: m.cid, delta, n: m.n });
  }
  for (const s of cells.synergies) {
    const delta = logitPct(shrinkWr(s.wr, s.n, cells.baseline.wr, config.kSynergy)) - base;
    components.push({ kind: "synergy", cid: s.cid, delta, n: s.n });
  }

  const rating = components.reduce((sum, c) => sum + c.delta, 0);
  const minN = Math.min(cells.baseline.n, ...cells.matchups.map((c) => c.n), ...cells.synergies.map((c) => c.n));
  const level = CONFIDENCE_LEVELS.find((t) => minN >= t.min)!.level;
  return { rating, components, confidence: { minN, level }, missing: cells.missing };
}
