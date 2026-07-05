# Spec — Calibration (prediction logging + honesty report)

**Phase:** /spec (follows calibration brainstorm + CC review, all empirical gates met)
**Inputs:** `docs/brainstorm/calibration-brainstorm.md` (with review), the Match-V5 join-key gate (PASS), the M7.5 stubbed seam.
**Status:** Revised after Pass A (all four findings folded) + Pass A-lite hygiene check. Ready for /plan. Two goals, both in scope: **G1** QA diagnostic (dev-facing), **G2** patient report card (player-facing).

## 0. Confirmed foundations (drafted against reality, not assumption)

- **Join-key: OBSERVED.** Champ-select session carries a top-level `gameId`, stable across a full draft; Match-V5 id = `{platform}_{gameId}`; a live fetch matched 10/10 participants and resolved own-result via `localPlayerCellId`. `queueId` present at both ends (champ-select + match) for the matchmade filter. The prediction→outcome join is direct, no correlation heuristics.
- **Seam:** M7.5 stubbed `CalibrationEntry` with `gameId` already in the interface. Extends here (§3) with a score-phase discriminator, `queueId`, `platform`.
- **Capture points:** both at-pick and FINALIZATION scores demonstrably exist in the live provider (M7 watched those exact phase transitions).
- **Power math (from CC's pressure-test, carried as hard constraints, not vibes):** if draft is ~15–20% of outcome, the true tertile effect is a few pp; at N=100 the CI on a top-vs-bottom comparison is **±24pp** — an order of magnitude wider than the effect. Hundreds of games are needed to distinguish a draft-sized ordering signal from noise. **This is why the feature is patient by design; the spec states it so no future reader re-litigates "why so cautious."**

## 1. Scope

Log each **matchmade** draft's prediction (at-pick + finalization), fetch its outcome via Match-V5, and (G1) compute a rank-based diagnostic of whether higher-rated picks win more, and (G2) show the player an honest, confidence-interval-first report of how the tool's advice has tracked their own results — including "inconclusive" as a legitimate long-term state.

**Non-goals:** no auto-tuning of the scoring engine from this signal (measuring ≠ retuning — a contaminated signal must not drive k or weights; §5 brainstorm); no win prediction (measures whether draft *rating* tracks outcomes, caveated — does not predict a given game); no multi-user (personal, local); no off-machine sync (log is local-only, per AC-M7-12's carved exception).

## 2. The claim discipline (what this feature may and may not assert — the load-bearing section)

- **Primary claim (supportable): ordering.** Do higher-rated picks win more often than lower-rated ones, over enough of the player's own games? Rank-based, survives the T2 contamination because non-draft noise is roughly even across rating levels.
- **Secondary claim (shown, heavily caveated): absolute calibration.** Do ~56% picks win ~56%? Contaminated by non-draft factors (draft is a minority input); shown for completeness, never as the headline.
- **Never claimed:** that a win/loss is attributable to the draft; anything from a small sample; that the point estimate is precise.
- **The CI is the headline, always.** The point estimate is de-emphasized. "Inconclusive — sample too small to conclude" is a legitimate, honest, possibly-multi-month state, not a placeholder or an error. (AC-C-7 makes this structural.)

## 3. Features & acceptance criteria

### F-C-1 — Prediction logging
- **AC-C-1:** At champ-select lock-in, a `CalibrationEntry` captures `gameId`, `platform`, `queueId`, both at-pick and finalization ratings (score-phase discriminator — T3 log-both), the draft state, and a timestamp. Two Pass-A-surfaced sourcing facts:
  - The validator must **preserve `gameId` and `queueId`** — the current M7 validator normalizes to teams/actions/timer and *discards* both (grep-confirmed). Named work item.
  - **`platform` is NOT in the champ-select session** (dump-verified: no platform/region/shard key). The helper sources it once from a separate LCU GET or config — it cannot come from the session payload.
  - The **ratings are computed in the frontend, not the helper** (scoring engine + shards live in the web packages; the helper has neither). They must be transported to the helper to be logged — see AC-C-1b.
- **AC-C-1b (new — rating transport + hard-line rescope):** The frontend sends computed ratings to the helper via a **local, origin-scoped POST** (`/calibration-log`, same CORS + PNA treatment as the existing GETs). This is a new helper surface. **Hard-line clarification, stated so the first POST handler is not mistaken for a violation:** AC-M7-3's read-only invariant was always about *Riot surfaces* — zero writes to the LCU or any Riot endpoint. A write channel between our own frontend and our own local helper does not touch that. Explicit work: (a) the invariant's grep-test is **rescoped to "no outgoing writes to LCU/Riot endpoints"** (not "no writes at all"); (b) the helper's docs are updated to match; (c) the new POST is origin-scoped and local-only, writes nothing off-machine. The guarantee is unchanged in meaning; only its wording tightens to what it always meant.
- **AC-C-2:** Log is a local JSON file written by the helper, local-only, never synced off-machine (AC-M7-12's carved exception). Append-only per game; idempotent on re-log of the same `gameId` (no duplicate entries).
- **AC-C-3:** Sample is **matchmade only** — `queueId` ∈ {400 Normal Draft, 420 Ranked Solo, 440 Ranked Flex}; customs/bots/practice excluded, never entering the sample. Filter at log time, re-checkable at analysis time. (Correction from Pass A: the filter is *matchmade*, not *ranked-only* — the join-gate game itself was queueId 400, and a ranked-only filter would starve the sample given the real queue mix.)

### F-C-2 — Outcome fetch
- **AC-C-4:** For each logged `gameId` without a recorded outcome, fetch `{platform}_{gameId}` via Match-V5, resolve own win/loss via `localPlayerCellId`/participant match, and record it against the entry. Reads `RIOT_KEY` from the environment only (never a file, never a literal). Few requests/day — trivially within personal-key limits.
- **AC-C-5:** Dodge-orphans (logged `gameId`s that never produce a finished match) are handled explicitly: after a bounded retry window, marked orphaned and excluded from the sample — never left pending forever, never counted as anything.
- **AC-C-6:** Fetch failures (403 key-expired, network, rate-limit) fail loud in the dev log, don't corrupt the store, and retry cleanly — same fail-loud discipline as the qdata deserializer. A missing outcome is "pending," never a guessed result.

### F-C-3 — G1: QA diagnostic (dev-facing)
- **AC-C-7:** Primary statistic is **AUC over win/loss pairs** (equivalently Mann-Whitney U) — for all (winning-game prediction, losing-game prediction) pairs, the fraction where the winner was rated higher, with **rating ties counting 0.5** (Pass A detail — omitting this biases the statistic). 0.5 = no ordering signal, >0.5 = higher-rated picks win more; more power per game than bucket curves. Computed on the finalization score as primary; at-pick as a separate secondary (T3 — different, harder question, not blended).
- **AC-C-8:** Every G1 number ships with its confidence interval and N. The AUC's CI is computed via **bootstrap** (Pass A: the assumption-light standard at personal-sample sizes) — an AUC without its CI is exactly the false-precision this feature exists to avoid.
- **AC-C-9:** A coarse (≤3-bucket — all a personal sample supports) calibration curve is available as a secondary view, explicitly labeled as contaminated-by-non-draft-factors.

### F-C-4 — G2: patient report card (player-facing)
- **AC-C-10:** The headline is the confidence interval, not the point estimate. Rendering leads with the interval and the game count ("over your 47 matchmade games, the ordering effect is between −18pp and +26pp — not yet conclusive"), with the point estimate secondary and de-emphasized.
- **AC-C-11 (the misread guard — structural, not cosmetic):** The card must make it impossible to read "consistent with tracking" as a verdict. Below the game-count floor, it says plainly "sample too small to conclude" and shows the CI spanning no-effect. It never displays a bare accuracy percentage. This is the feature's version of "ranking heuristic, not a probability" — tested, not just styled.
- **AC-C-12:** A visible game counter and a CI that provably narrows as games accumulate — the honesty story made visible. The floors (T1) are **display-honesty gates, not trust thresholds**: crossing "30 games" must never render as "now meaningful."
- **AC-C-13:** The card leads with what it can't attribute (draft is one input among many), same placement as the scoring engine's disclosure and the phase panel's conditional framing.

## 4. Open items

- **OI-C-1:** Game-count display floors — below which G2 shows only "accumulating, n=X" with no estimate at all. Set a default (candidate: no estimate shown below ~20; CI-with-inconclusive-label thereafter), tune with real accumulation.
- **OI-C-2:** Outcome-fetch trigger — helper polls for pending outcomes on next launch? A background cadence? Simplest that isn't wasteful; the fetch is cheap so on-launch reconciliation likely suffices.
- **OI-C-3:** At-pick score definition — the score after *your* pick with partial enemy info, vs. the last pre-finalization score. Pick one, document it; they're subtly different at-pick moments.

## 5. Pre-implementation checklist (gates /plan)

- **PC-C-1:** ✅ Join-key observed (Match-V5 fetch matched 10/10, own-result resolved).
- **PC-C-2:** **Rotate `RIOT_KEY`** (it transited a chat) and re-set the env var — deferred by operator under time constraint; **must happen before F-C-2 code ships against the key**, while rotation is still a free one-click (no live dependency yet). Carried here so it can't be lost.
- **PC-C-3:** Confirm the M7 helper changes (preserve `gameId`/`queueId`; add `platform` source; add `/calibration-log` POST + rescope the read-only grep-test) don't regress M7's existing champ-select handling — changes to shipped helper code, so the M7 acceptance path reruns (store-rewrite regression discipline). The POST channel and validator preservation are **one foundation milestone** — logging is dead without both.

## 6. Process from here

```
[this spec] → Pass A COMPLETE (validator-discard confirmed; platform + rating-transport
gaps found and folded as AC-C-1/1b; matchmade correction; AUC ties/bootstrap details)
→ Pass A-lite on revision COMPLETE (hygiene only) → /plan → build
```

Foundation milestone (per PC-C-3): validator preservation + platform sourcing +
`/calibration-log` POST + invariant-test rescope land together — logging is dead
without all four. PC-C-2 (key rotation) gates the outcome-fetch milestone.
