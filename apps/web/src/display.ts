/**
 * UI-layer presentation of ratings (spec AC-13/AC-17). This is the ONLY
 * place a rating becomes a percentage, and it never appears without its
 * tier, confidence level, and the sample size it rests on. No bare decimals:
 * percentages render as whole numbers.
 */
import type { PickScore } from "@lolbuilder/core";

/** Logistic — the display inverse of the engine's logit. UI only. */
export function ratingToPct(rating: number): number {
  return Math.round(100 / (1 + Math.exp(-rating)));
}

export interface TierBand {
  min: number; // inclusive lower bound on the displayed pct
  label: string;
}

/** Qualitative tiers — deliberately coarse; the bands are the honesty. */
export const TIERS: TierBand[] = [
  { min: 55, label: "Strong pick" },
  { min: 52, label: "Favorable" },
  { min: 49, label: "Even" },
  { min: 46, label: "Uphill" },
  { min: 0, label: "Weak here" },
];

export function tierFor(pct: number): string {
  return TIERS.find((t) => pct >= t.min)!.label;
}

export function describeConfidence(score: PickScore): string {
  const { minN, level } = score.confidence;
  return `${level} confidence — weakest cell rests on ${minN.toLocaleString()} games`;
}

/** AC-19: the "what this can't tell you" disclosure, incl. the phase conditional. */
export const DISCLOSURE = [
  "This is a ranking heuristic, not a win probability — it compares your options; it does not predict your game.",
  "Signals are correlated: matchup and synergy numbers partially encode each other, so contributions double-count in unknowable ways.",
  "Data is Emerald+ ranked, all regions, current patch. Your lobby differs.",
  "Phase figures are the win rate of games that ENDED early/mid/late — a selection effect, not “strength during that phase.”",
  "Small samples are shrunk toward the champion's baseline; “insufficient data” means exactly that.",
] as const;
