# Calibration research findings — 2026-07-04

Scope per the research handoff: three questions, disconfirmation-first,
feeding the G1/G2 analysis milestones. **Does not gate C.0** — and nothing
found below changes the capture layer, so the value clock is unaffected.

## 1. Prior art on prediction-moment + personal calibration: THIN, CONFIRMED — with one instructive exception

- **No tool found logs personal predictions against the player's own
  outcomes.** The ecosystem validates differently: LoLDraftAI (a neural
  whole-draft model) reports **56.7% draft-only accuracy** and claims
  population-scale calibration ("predicts 55% → wins ~55%") — calibration
  achieved on a training corpus of millions of games, not on a personal
  log. Recommendation-quality benchmarks exist (an April 2026 benchmark
  measured win rates when the played champion appeared in each tool's
  top-10, with a 5.4pp spread between tools) — but that evaluates advice
  retrospectively at population scale, not a logged prediction stream.
  **G2 as specced (a personal, patient, CI-first report card) has no
  precedent found to copy — including for the at-pick-moment question.**
  The operator's values-choice framing stands: nothing to borrow.
- **The draft-only accuracy ceiling in published/hobby models is 55–62%**
  (LoLDraftAI 56.7%; a champions-only model 62%; Naive Bayes baselines
  ~55%). Player-experience features lift accuracy to ~75% (arXiv
  2108.02799) — which is precisely the non-draft variance T2 names. This
  independently confirms the spec's premise with citations: draft carries
  real but modest signal; nobody extracts more than ~62% from draft alone.

## 2. Forecast-verification statistics: OUR DERIVED DESIGN MATCHES THE FIELD'S STANDARD ANSWER

The weather/sports verification literature has standard names for exactly
the distinctions the spec derived from first principles:

- **Discrimination vs. calibration are different axes** (AUC/ROC measures
  the first; reliability diagrams the second). With weak signal and small
  samples, discrimination is detectable long before calibration —
  reliability diagrams need large per-bin counts, and the field warns that
  probability-forecast verification "requires many samples." The spec's
  ordering-over-absolute resolution IS the field's discrimination-first
  guidance under another name. **AUC/Mann-Whitney is the standard
  discrimination statistic — no better primary found.** Disconfirmation
  outcome: the first-principles design converged on the textbook answer.
- **Vocabulary adoption for /plan and the G1 readout:** "calibration
  curve" → *reliability diagram*; "ordering" → *discrimination*; the
  is-it-better-than-nothing question → *skill vs. climatology* (the
  player's own base win rate is the climatological baseline).
- **One cheap complement (optional, G1-only):** the Brier Skill Score vs.
  the player's own base rate — a proper score combining both axes,
  standard in the field, nearly free once outcomes exist. Its CI at
  personal n is as wide as everything else's; AUC stays primary. Not an
  AC change; a line in C.2's readout script.

## 3. Intermediate-outcome calibration: REAL PATH, NOT A MIRAGE — verified access, documented linkage, genuine power gain

- **Data access: OBSERVED, not assumed.** The Match-V5 **timeline**
  endpoint was fetched live for the join-gate game (same key, one
  request): 33 one-minute frames, per-participant `totalGold`, `xp`,
  `level`, `damageStats`, `position`. Team gold-diff@15 computes trivially
  (the gate game: −3267 for the team that went on to lose — one
  consistent data point, not evidence). Cost: **one extra request per
  match at outcome-fetch time**, same endpoint family, same key.
- **Documented linkage from the intermediate to the final outcome:** the
  EGR model (logistic regression, ~800 pro games): +750 gold @15 ≈ 60%
  win, +1500 ≈ 70%; in-game state at 15 minutes predicts the winner at
  ~73% (random-forest, within-match data). GD@15 is a meaningful, widely
  used early-game summary.
- **The statistical case is a double dividend — one half proven, one half
  hypothesis (labeled):** (a) *proven by construction:* a continuous
  outcome (gold-diff) carries far more information per game than a binary
  win/loss — regression on a continuous target has much higher power per
  observation than pairwise ranking of binaries; (b) *hypothesis, not
  verified:* draft quality plausibly explains a larger share of
  15-minute state than of final outcomes (fewer intervening variables by
  minute 15). If both hold, "hundreds of games for signal" could drop to
  high tens **for the intermediate claim** — but that estimate must be
  verified on accumulated data, never promised.
- **What it does NOT do:** it does not replace win/loss calibration. The
  tool's user-facing claim is about winning; gold@15 answers a different,
  weaker question ("does the rating track early-game advantage?"). It is
  a faster-converging *diagnostic* (G1), not a substitute report card.
- **Live Client Data API (127.0.0.1:2999): not needed for this.** The
  timeline provides the same information retrospectively with zero new
  infrastructure. Keep parked for the v3 live-advisor; adding it here
  would be scope creep with no analytical gain.

## Recommendation (per the handoff's ask)

1. **G1/G2 analysis design: keep as specced**, with vocabulary adoption
   and the optional BSS-vs-baseline line in G1's readout. No AC changes.
2. **One small C.1 addition worth folding at /plan-review discretion:**
   at outcome-fetch time, also fetch the timeline and store team gold/xp
   diff @15 alongside the win/loss (one extra request/game; avoids any
   retention risk and makes the intermediate data accumulate from day
   one). Backfill is possible within Match-V5's retention window, so
   this is cheap insurance rather than a hard dependency.
3. **The intermediate-outcome ANALYSIS is its own post-C.1 brainstorm
   candidate** — as the handoff framed it: if promising, it's a
   brainstorm, not a C.0 fold. C.0 is untouched by everything in this
   document; the meter's start date is unaffected.

## Sources

- [LoLDraftAI](https://loldraftai.com/) — draft-only 56.7% accuracy, population-scale calibration claim
- [Winrate.gg draft-AI benchmark](https://winrate.gg/articles/draft-recommendation-benchmark) — recommendation-quality evaluation, Apr 2026
- [Using ML to Predict Game Outcomes Based on Player-Champion Experience (arXiv 2108.02799)](https://arxiv.org/pdf/2108.02799) — ~75% with player features
- [TechLabs: win percentage from draft phase](https://techlabs-aachen.medium.com/determining-win-percentage-from-draft-phase-in-a-professional-league-of-legends-game-59ea4e4d5c55)
- [WWRP/WGNE Forecast Verification — Issues, Methods, FAQ](https://www.cawcr.gov.au/projects/verification/) — discrimination vs reliability, sample-size guidance
- [Brier score (Wikipedia)](https://en.wikipedia.org/wiki/Brier_score) — proper scoring rules, skill scores
- [Pinnacle: Gold Difference at 15 minutes](https://www.pinnacle.com/en/esports-hub/betting-articles/league-of-legends/gold-difference-at-15-minutes/rqg29g3m6jhppqpc) — EGR model figures
- [Real-Time Result Prediction (arXiv 2309.02449)](https://arxiv.org/pdf/2309.02449) — in-game state predictivity
