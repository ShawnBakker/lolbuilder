# Brainstorm — Calibration (prediction logging + honesty report)

**Phase:** /brainstorm (precedes /spec)
**Date:** 2026-07-04
**Status:** Draft — proposals with reasoning, to be locked in /spec
**Builds on:** M7 (helper reads champ-select), PC-5 (Riot personal key, approved, for Match-V5 own-results), the no-database decision (flagged calibration's local JSON log as the one feature needing local persistence), M7.5's stubbed calibration seam.
**Two goals, both in scope (operator confirmed):**
- **G1 — QA diagnostic:** is the scoring engine trustworthy? A calibration curve you check to validate/tune the model.
- **G2 — user report card:** show the player, over their games, whether the tool's advice tracked reality.
Shared plumbing, different bars. G1 is the honest-engineering goal; G2 is the honest-product goal. This doc keeps them distinct so the easy half (logging) doesn't paper over the hard half (what the data can claim).

---

## 1. The mechanical half is mostly already built (short section on purpose)

- **Prediction capture:** the M7 helper already reads champ-select and the tool already computes the score. Logging "(draft state, predicted rating, timestamp)" at lock-in is a small addition to an existing path.
- **Outcome capture:** the Match-V5 API (PC-5 key, approved) fetches your own match results — a few requests/day, trivially within personal-key limits, fully sanctioned (unlike the aggregate scraping, this is *your own* data via the official API).
- **Storage:** a small local JSON log written by the helper — the exact persistence the no-database decision anticipated and M7.5 stubbed a seam for. This is the *only* feature in the project that legitimately needs local writes, and it's local-only (never leaves the machine), consistent with the helper's hard lines.

So the plumbing is ~designed. **The entire difficulty of this feature is statistical and epistemic, not mechanical.** The rest of this doc is that difficulty.

## 2. The three tensions the spec must resolve (this is the real content)

### T1 — A single game is a coin flip, not a measurement.
A 56% prediction that loses tells you almost nothing — 56% *means* losing 44% of the time. Calibration is only meaningful in **aggregate**: across many games, do the picks rated ~56% actually win ~56%? That's a **calibration curve** — predicted-bucket vs. actual-win-rate-per-bucket, ideally tracking the diagonal.
- **Consequence:** the feature produces *nothing trustworthy* until dozens of games are logged. The spec must set an honest floor (rough estimate: ~30 games before *any* signal, ~100+ before per-bucket claims), and G2's UI must **refuse to show a report card below that floor** — same "insufficient data" honesty as the scoring engine's low-sample handling. A report card at n=5 would be exactly the false-precision this project polices everywhere.

### T2 — The tool doesn't control most of what it's predicting.
Draft quality is maybe 15-20% of what decides a game; mechanics, teammates, enemy errors dominate. So even a *perfectly* calibrated draft score would show a **weak** relationship to outcomes — because draft is a minority input.
- **The trap:** a flat-looking calibration curve could mean "the score is bad" OR "the score is fine, draft just doesn't determine games much." These are not distinguishable from the curve alone.
- **Proposed honest resolution (spec to confirm):** calibration can credibly validate **ordering** ("higher-rated picks win more often than lower-rated ones") more than **absolute calibration** ("56% picks win exactly 56%"), because the absolute number is contaminated by non-draft factors while the *ordering* survives contamination as long as the noise is roughly even across buckets. So the primary claim is a **monotonicity check** (does win rate rise across rating buckets?), with absolute calibration shown but explicitly caveated as "draft is one input among many." This is the disconfirmation-honest framing: claim the weaker thing you can actually support, disclaim the stronger thing you can't.

### T3 — Which score is "the prediction"?
The rating changes as the draft fills — one value after your pick, another after enemies reveal, another at finalization.
- **Finalization score** (full information) is the most *defensible* to calibrate — it's the tool's best, complete judgment.
- **At-pick score** (partial info) is what the tool actually *helps you with* — the whole point is advice under uncertainty at pick time.
- **They measure different things.** Calibrating finalization answers "is the complete-information score good"; calibrating at-pick answers "is the advice-when-it-matters good." Proposal: **log both, calibrate finalization as the primary QA signal (G1), and treat at-pick calibration as a separate, harder, secondary curve** — because at-pick is contaminated by *additional* uncertainty (the draft wasn't done). Don't blend them into one number.

## 3. What this feature can and cannot honestly claim (the house-style section)

**Can:** whether higher-rated picks win more often than lower-rated ones, over enough of the player's own games (ordering/monotonicity); a rough calibration curve with explicit contamination caveats; a personal, honest "here's how the tool's advice has tracked your results" report once past the game-count floor.

**Cannot:** attribute a win or loss to the draft (T2); say anything from a handful of games (T1); claim the absolute percentage is precise (draft is a minority input); separate "score is wrong" from "draft doesn't matter much" without additional modeling the scope should probably decline.

**The disclaimer is a feature, not a footnote** — same as the scoring engine's "ranking heuristic, not a probability" and the phase panel's "games that ENDED early/late." G2's report card must lead with what it can't attribute, or it becomes the thing the whole project avoids: a confident-looking number that means less than it appears.

## 4. Open questions for /spec

1. **Game-count floors** — n before any signal (G1), n before a user-facing report card (G2). Set defaults, tune with real data.
2. **Bucketing** — how many rating buckets for the curve, given a personal sample is small (an individual plays hundreds, not millions, of games)? Coarse buckets (e.g. 3-4) may be all a personal sample supports.
3. **At-pick vs finalization** (T3) — confirm log-both, calibrate-finalization-primary.
4. **Ordering vs absolute** (T2) — confirm monotonicity as the primary claim, absolute as caveated-secondary.
5. **Match-V5 matching** — how to reliably tie a logged champ-select prediction to the correct Match-V5 result afterward (game ID correlation; the helper sees champ-select, Match-V5 sees the finished game — need a reliable join key).
6. **G1 vs G2 surfacing** — is the QA curve a dev-only artifact (a local report the developer reads) while G2 is the in-app player-facing card? Or both in-app? They have different bars; likely G1 is a local/dev readout and G2 is the polished, floor-gated player view.
7. **Privacy/scope** — the log contains your match history and predictions. Local-only (never leaves the machine), consistent with the helper's hard lines. Confirm no off-machine sync, ever.

## 5. What this is NOT (scope guard)

- **Not a model that improves itself automatically.** Calibration *measures*; using the measurement to retune k or the scoring weights is a *separate* future decision, not this feature. This feature produces the curve; a human reads it. (Auto-tuning on a contaminated signal would be exactly the wrong thing.)
- **Not a win predictor.** It measures whether the *draft rating* tracks outcomes, honestly caveated; it does not tell you if you'll win a given game.
- **Not multi-user.** Personal, local, one player's own games.

## 6. Process from here

```
[this doc] → CC in-repo review (verify the M7 seam shape, the Match-V5 join-key
feasibility, the stubbed calibration seam matches this design) → /spec (locks the
four resolutions in §2, the floors, the G1/G2 surfacing split) → /plan → /implement
```

No calibration code before its spec. The Match-V5 join-key question (§4.5) is the one place a small empirical check may be needed before /spec locks — same pattern as every other "verify the shape before trusting it" gate: can a champ-select prediction actually be reliably tied to its finished-game result? If that join is unreliable, the whole feature's outcome-half is shaky, so it's worth confirming early.

---

# In-repo review addendum (CC, 2026-07-04)

## 1. Join-key (§4.5): REAL, STABLE, OBSERVED — with one passthrough gap and one gate left

- **The champ-select session carries a top-level `gameId`, stable across the
  whole draft**: one distinct value (5594749083) across all 19 snapshots of
  the M7.4 live capture (local dumps re-checked for this review). Match-V5
  match ids are `{platformId}_{gameId}` — the join is direct, not
  correlational: log the gameId at lock-in, fetch the match later.
- **Gap (concrete /spec work item):** the helper's validator currently
  DISCARDS gameId — `ValidSession` normalizes to teams/actions/timer only.
  /spec adds gameId (and `queueId`, see below) to the validated shape and
  the served response. The M7.5 seam already anticipated the field
  (`CalibrationEntry.gameId` exists).
- **Caveats to design in:** dodged drafts produce gameIds with no finished
  match — the log must tolerate/expire orphans; customs and bot games
  should be excluded via `queueId` (present in the session, observed);
  `platformId` needs sourcing (the LCU exposes region — spec detail).
- **The remaining empirical gate (the feature's PC-1 analog):** one
  Match-V5 fetch of a *logged* gameId with the personal key, verifying the
  finished match comes back and the participants match the logged draft.
  Operator-held key, one request, belongs on /spec's PC list. Everything
  short of that is now verified.

## 2. Seam shape (§1): matches in spirit, extends at /spec

`appendCalibrationEntry({gameId, patch, pickCid, rating, lockedAt})` —
the join-key was anticipated ✓. T3's log-both resolution requires a
score-phase discriminator (`at-pick` | `finalization`) and §4.5's caveats
add `queueId` + platform; the draft-state snapshot the doc mentions should
be settled at /spec (full snapshot enables re-scoring later; rating-only is
lighter — recommend snapshot, it is cheap and unrepeatable). Both capture
points exist in the current architecture: the provider observes the phase
transitions (BAN_PICK → FINALIZATION) live, per the M7.4 timeline.

## 3. T2 pressure-test: ordering is the right CLAIM CLASS — but the floors
     are optimistic by roughly an order of magnitude, and that changes G2

Quantifying the doc's own premise (draft ≈ 15–20% of outcome): the
plausible true effect of draft-rating tertiles on win rate is a few
percentage points. At N=100 games (~33/tertile), the CI half-width on a
top-vs-bottom tertile difference is ≈ ±24pp — an order of magnitude wider
than the effect being sought. Even a rank-based statistic using every
win/loss pair (recommended: AUC / Mann-Whitney — "in X% of win/loss pairs
the winner had the higher rating", more power per game than bucket curves)
needs on the order of **hundreds of games** to distinguish a draft-sized
ordering effect from noise. Consequences for /spec:

- **Floors are display-honesty gates, not trust thresholds.** "Past 30
  games" must not imply "now meaningful" — that would be the false
  precision T2 warns about, one level up. Every displayed number carries
  its CI; below-floor shows nothing.
- **The honest report card may read "consistent with tracking — sample too
  small to conclude" for months of casual play, possibly indefinitely.**
  The spec should embrace that as the product (the card's headline is the
  CI, not the point estimate), not treat it as a failure state.
- **Primary statistic proposal:** AUC with a bootstrap CI as G1's number;
  a coarse 3-bucket curve as G2's visual (answers §4.2: personal samples
  support ~3 buckets at most). Monotonicity across 3 buckets + AUC > 0.5
  with CI excluding 0.5 = the strong-form finding, likely years away at
  friend scale; the card says exactly where it stands on that road.

## 4. Groundings confirmed

- Privacy (§4.7): AC-M7-12 already carves the exception verbatim ("persists
  nothing off-machine — except the explicitly-scoped calibration log
  seam"). Local-only is consistent with every hard line.
- Scope guard (§5): endorsed — auto-tuning on a contaminated signal is the
  correct thing to decline; the seam's throw-test pattern should carry
  forward (nothing half-built ships behind the log).

**Verdict:** converges to /spec cleanly. The outcome-matching problem does
NOT need solving first — the join-key is observed; only the one-request
Match-V5 confirmation remains, and it slots into /spec's PC list rather
than blocking the spec's drafting.
