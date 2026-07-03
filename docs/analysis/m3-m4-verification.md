# M3/M4 verification record — 2026-07-03, patch 16.13 production dataset

Empirical gates for the scoring engine (M3) and phase analysis (M4), run
against the published patch-16.13 shards (172-shard first publish; the
Wukong-completing republish changes nothing below — verified byte-identical
re-emission for unchanged champions).

## OI-3 — d1/d2 semantics: RESOLVED (empirically, stronger than the research prose)

- **Matchup d1 = vsWr − allWr, exactly** over all **63,972** production
  matchup rows (default + all vslane tables, 172 champions; max |error|
  0.0000 at payload precision). **Provenance caveat (post-review check):**
  this is a *stored-field relationship* — the three fields are arithmetically
  linked on lolalytics' side — not an independent re-derivation of their
  formula. `allWr` is NOT simply the opponent's own overall WR (median
  |allWr − opponent's own baseline wr| = 4.18pp, p90 7.10pp, across 7,500
  n≥300 rows — far beyond population drift, which measures ~0.5pp on the
  synergy side); its exact population is unidentified. What the exact match
  DOES establish, and what OI-3 needed: d1's scale is percentage points,
  categorically not logit.
- **Matchup d2 = d1 − c(champion), and c is (approximately) the n-weighted
  mean of the champion's own d1**: the identity holds within 0.15pp for
  150/172 champions, worst 0.232pp. So d2 is the matchup delta relative to
  the champion's average delta across opponents ("normalized expected WR"
  in the research prose). The residual is consistent with floor truncation —
  rows under the source's 100-game floor contribute to their true weighted
  mean but are invisible to us. Status: explained, still unconsumed.
- **Synergy d1 ≈ duoWr − teammate's overall WR** (median |error| 0.47pp,
  p90 1.19pp against the nearest available proxy — teammates' default-lane
  emerald+ baselines, n≥500 rows, lane-matched). Same percentage-point family.
- **Consequence (locked into the engine):** d1/d2 are percentage-point
  quantities, never logit addends. `packages/core` consumes raw `(wr, n)`
  cells and derives its own logit-space deltas post-shrinkage; d1 survives
  only as a UI explanation aid; d2 is not consumed (normalizer unidentified).
  The external review that summed d1/d2 in logit space (register OI-3
  exhibit) would have been wrong by construction.

## OI-4 — shrinkage sensitivity sweep: RESOLVED

Method (as blessed at plan review): 20 deterministic benchmark drafts built
from the production dataset, 10 candidates each, ranked by rating under all
(k_matchup, k_synergy) ∈ {10,25,50}²; agreement vs the (50,50) reference.

| config (kM,kS) | mean top-5 overlap | top-1 agreement | exact top-5 order |
|---|---|---|---|
| (10,10) | 4.95/5 | 20/20 | 17/20 |
| (10,25) | 5.00/5 | 20/20 | 18/20 |
| (10,50) | 5.00/5 | 20/20 | 18/20 |
| (25,10) | 4.95/5 | 20/20 | 16/20 |
| (25,25) | 5.00/5 | 20/20 | 18/20 |
| (25,50) | 5.00/5 | 20/20 | 19/20 |
| (50,10) | 4.95/5 | 20/20 | 16/20 |
| (50,25) | 4.95/5 | 20/20 | 17/20 |
| (50,50) | 5.00/5 | — reference — | 20/20 |

**Reading:** the plateau spans the whole grid — pick ordering is insensitive
to k within [10, 50]. The constants are therefore chosen by D8's structural
rationale, not ranking optimization: **K_MATCHUP = 25** (halves the max
shrink weight on a source-floored n=101 cell from 33% to ~20%, preserving
the matchup signal the tool exists for), **K_SYNERGY = 50** (full discipline
where n=1 tails exist). Both remain named, doc-commented, trivially tunable
(`packages/core/src/constants.ts`); the v2 calibration feature is the path
to choosing k on accuracy rather than structure.

## AC-16b — phase-semantics sanity check: PASS 4/4

Bucket WR curves (raw timeWin/time per bucket, %) from production shards:

| champion | profile | curve (buckets 1→7) | late−early |
|---|---|---|---|
| kayle | hyperscaler | 47.8 43.7 42.2 52.6 60.5 62.2 62.7 | **+16.05pp** |
| kassadin | late-game | 43.8 42.6 40.2 52.4 58.9 58.1 56.1 | **+14.48pp** |
| renekton | lane bully | 55.8 51.5 51.8 50.9 50.4 50.8 50.9 | **−2.93pp** |
| elise | early jungler | 58.6 54.0 52.3 49.9 50.7 50.4 51.0 | **−5.65pp** |

The game-length-conditional construct behaves exactly as known scaling
profiles predict. (Bucket 1 is noisy — remake/stomp territory; the
PHASE_FLOOR_N floor and the early=1–2 grouping absorb it.)

## OI-1 — bucket→minute boundaries: RESOLVED AS RELATIVE

The build payload carries **no minute labels** (string-scan of `_objs`,
2026-07-03 — the only "min" hits are item names like "Mortal Reminder").
Phase labels therefore stay relative (early/mid/late by game-length rank,
never clock minutes) per AC-15's block. Optional unlock: one browser look at
the site's rendered game-length graph axis (operator task, ~2 minutes) —
until then, no minute label ships.
