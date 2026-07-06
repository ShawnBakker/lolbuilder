# Review brief — intermediate-outcome brainstorm (outside pass)

**To the reviewer:** you are the outside pass on the attached brainstorm
(`docs/brainstorm/intermediate-outcome-brainstorm.md`). Its drafter
cannot review it — your job is to attack the reasoning before it can
become a spec. This is a BRAINSTORM review: the questions are whether
the framing and the proposed statistic survive scrutiny, not
implementation detail and not product value. This brief plus the
brainstorm are self-contained; you need and should use nothing else.

## Context you need (the system in six lines)

A private League of Legends draft-advice tool runs a personal
calibration loop: at champion lock-in it logs its own rating of the
draft; after the game it fetches the win/loss outcome from the official
API and appends it to a separate outcome log. The shipped analysis (a
dev-facing readout script) measures ordering — do higher-rated drafts
win more often? — via AUC with a seeded-bootstrap confidence interval.
Its honest power wall: with a plausible effect size, hundreds of games
before the CI excludes no-signal. Each reconciled outcome ALSO stores
the player's gold difference and XP difference at minute 15 (`gold15`,
`xp15`), taken from the official match timeline. The house claim style
everywhere: ordering-first, CIs shown, refuse-to-conclude below floors.

The brainstorm proposes: a new readout section correlating the logged
rating with gold15 (Spearman rank correlation + seeded bootstrap CI),
as a faster-converging *diagnostic* — never replacing the win/loss
statistic, never player-facing until it demonstrates signal.

## Pre-validated — do not re-litigate, evidence exists

- `gold15`/`xp15` are already stored per outcome (observed: both real
  outcomes on disk carry them; the automated values matched prior
  manual computation exactly).
- The statistical machinery to reuse exists and is property-tested
  (seeded RNG, percentile bootstrap).
- Win/loss AUC remains the primary statistic (decided at its build);
  the brainstorm does not propose changing that.
- No new capture path, schema change, or network request is needed
  (verified: this is analysis over existing files).

## Known weaknesses, pre-declared by the drafter

- The games excluded from the statistic (ended before minute 15) are
  selection-correlated with stomps — the exclusion bias points in the
  worst possible direction for a statistic about early advantage.
- The §4 comparison ("whichever CI excludes its null first") races two
  CIs that are not on a common scale; as written it is loose enough to
  invite post-hoc reading.
- Only 2 outcomes exist today; any analysis built now runs on air for
  weeks. The build-now argument is patience, not need.
- Spearman discards magnitude, which the §4 hypothesis (draft explains
  MORE of minute-15 state) may actually care about.

## What to attack (priority order)

1. **The §1 epistemic split.** The brainstorm stakes one claim as
   "proven by construction" (a continuous outcome carries more
   information per game than binary win/loss) and labels the second as
   a testable hypothesis (draft explains a larger share of minute-15
   state than of final outcomes). Attack the first claim's tense: is it
   actually construction-true as stated, or does it smuggle an
   assumption — e.g., that the rating should relate to gold@15 at all
   (a support/utility-heavy draft could be well-rated while
   gold-neutral at 15)? If the "proven" half is really conditional,
   the whole speed-up promise weakens. Reverses if: you can name a
   realistic mechanism where the continuous statistic converges NO
   faster than the binary one on this data.
2. **Statistic choice.** Spearman (rank) vs a robust linear
   alternative (e.g., Pearson on winsorized gold15). Rank correlation
   is assumption-light and stomp-robust (a −8.1k game is already in
   the log — observed), but discards magnitude. Which serves the §4
   hypothesis test better? Reverses if: winsorized-Pearson is shown
   more powerful under realistic fat-tailed gold distributions without
   fragile assumptions.
3. **The exclusion (games ending before 15:00).** Proposal: exclude,
   show the count, name the bias in the readout line. Attack: honest
   enough, or does it need a sensitivity companion (statistic recomputed
   with excluded games imputed at cap values)? Is there a defensible
   imputation at all, given the exclusion correlates with stomps?
4. **The §4 race protocol.** Should "which CI resolves first" be
   pre-registered harder — fixed evaluation checkpoints (e.g.,
   n = 30/60/100), declared nulls, declared directional expectations —
   given the house's own history of pre-registering pass criteria
   before probes? As written, could a motivated reader declare victory
   early?
5. **Build-now vs wait.** Is even a dev-readout section premature at
   n=2, or is building it now (so the analysis is simply THERE as
   outcomes accumulate) the right patient move? Cost asymmetry to
   weigh: the code is small and reuses tested machinery, but code
   built long before its data can rot unnoticed.

## Output contract

For each numbered item: verdict (stands / falls / sharpen-with-change)
+ reasoning. End with one of: advance to /spec now / advance with named
changes / park until ~N outcomes exist (name N). Also confirm or refute
the scope guard: nothing in the sketch touches a player-facing surface
or weakens the win/loss statistic's primacy.

## Not in scope

The player-facing report card's design (shipped, deliberately
untouched by this proposal); the capture layer (already stores the
fields); whether win/loss AUC was the right primary statistic (decided
and shipped); implementation detail below the statistic choice.
