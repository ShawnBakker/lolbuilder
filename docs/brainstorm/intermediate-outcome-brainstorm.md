# Brainstorm — Intermediate-outcome diagnostic (gold@15 as G1's fast lane)

**Phase:** /brainstorm
**Date:** 2026-07-06
**Drafted by:** CC. **Per the seam: needs an OUTSIDE review pass** — §6.
**Unparked by:** C.1 (every reconciled outcome already stores `gold15` +
`xp15`); groundwork in `calibration-research.md` §3.

## 1. The idea, and the honest split in it

Win/loss calibration needs hundreds of games (the ±24pp power wall). The
intermediate question — *does the draft rating track early-game
advantage?* — may show signal far sooner, for two stacked reasons with
very different epistemic status:

- **Proven by construction:** a continuous outcome (gold-diff@15) carries
  far more information per game than a binary win/loss. Correlation on a
  continuous target has much higher power per observation than pairwise
  ranking of binaries.
- **Hypothesis, dataset-testable:** draft quality explains a larger share
  of minute-15 state than of final outcomes (fewer intervening variables).
  This is NOT assumed — it's the thing the diagnostic will itself test.

## 2. What this is and is not

- **G1 only, dev-facing only.** A section in the existing readout script.
  It earns any player-facing surface only AFTER it demonstrates signal —
  and even then it answers a WEAKER question than the report card
  ("tracks early advantage," not "tracks winning"). The card's claim
  discipline is untouched by this feature.
- Not a new capture path, not a schema change, not a new request: the
  data already accumulates (C.1 stores gd15/xp15 with every outcome;
  entries #1–2 have it). This is pure analysis over existing files.

## 3. The statistic

- **Primary: Spearman rank correlation** rating ↔ gold15, finalization
  scores, with a **seeded bootstrap CI** (reuse `mulberry32` + the
  stratification-free percentile machinery from C.2 — no classes here).
  Spearman over Pearson: rank-based, assumption-light, robust to the fat
  tails stomps produce (−8.1k is already in the log), and consistent with
  the house's ordering-first claim style.
- **Reported beside, never blended:** the AUC section stays primary in
  the readout; this is a separate section labeled as the weaker claim.
- **Games without a minute-15 frame** (ended early): excluded from this
  statistic, count shown. Their absence is selection-correlated with
  stomps — name that bias in the readout line rather than pretending
  it away.

## 4. What it will let us actually test (the research hypothesis)

Once both statistics run on the same log: compare when each CI first
excludes its null. If Spearman(rating, gd15) resolves at n≈30–60 while
AUC still spans 0.5, the hypothesis has evidence and a player-facing
"early-advantage" line becomes a spec conversation. If gd15 correlation
stays null while games accumulate, that is ALSO a finding — the rating
fails to track even the nearest thing it should influence, which would
point at the engine before the sample size.

## 5. Implementation sketch (small)

- `packages/core`: `spearman(samples: {rating, value}[]): number` +
  bootstrap CI via existing machinery. Property tests (monotone → 1;
  shuffled → CI spans 0; ties handled by average ranks).
- `apps/helper/src/readout.ts`: new section joining entries ↔ outcomes on
  gold15 (and xp15 as a secondary line), with n, CI, exclusion count.
- Nothing else changes. No helper surface, no frontend, no pipeline.

## 6. Review handoff — what to attack

1. **Spearman vs Pearson:** rank correlation discards magnitude — is
   that the right tradeoff, or is a robust linear alternative (e.g.
   Pearson on winsorized gd15) more informative for the hypothesis test
   in §4?
2. **The early-game-end exclusion (§3):** is "exclude + count + name the
   bias" honest enough, or does it need a sensitivity line (statistic
   with the excluded games imputed at caps)?
3. **The §4 comparison protocol:** "whichever CI excludes its null first"
   — is that a fair race, given the two statistics' CIs aren't on the
   same scale? Should the protocol be pre-registered more precisely
   (fixed checkpoints, e.g. evaluate at n=30/60/100)?
4. **Scope discipline:** is even a dev-readout section premature before
   ~20 outcomes exist, or is building it now (so it's simply THERE as
   data accumulates) the right patient move?
```
