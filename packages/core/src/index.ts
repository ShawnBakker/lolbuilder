/**
 * M3/M4 — scoring engine + phase analysis (spec F4, F5). Pure functions,
 * zero I/O (AC-14). The composite is a rating, never a probability (AC-13).
 */
export { CONFIDENCE_LEVELS, K_MATCHUP, K_PHASE, K_SYNERGY, PHASE_BUCKETS, PHASE_FLOOR_N, type ConfidenceLevel, type Phase } from "./constants.js";
export { logitPct, shrinkWr } from "./math.js";
export { phaseBreakdown, type PhaseBreakdown, type PhaseRate } from "./phase.js";
export { DEFAULT_CONFIG, scorePick, type PickScore, type RateCell, type ScoreCells, type ScoreComponent, type ScoreConfig } from "./score.js";
export { selectCells, type ShardIndex } from "./select.js";
export { MIN_PROFILES, TEAM_SIZE, evaluateItemRules, type EnemyProfile, type ItemRecommendation, type ItemRule, type RuleTrigger } from "./itemrules.js";
