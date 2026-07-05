# Plan — Calibration (prediction logging + honesty report)

**Phase:** /plan (follows calibration spec, revised + Pass A/A-lite complete)
**Inputs:** `docs/spec/calibration-spec.md`, PC-C-1 gate result (join PASS 10/10)
**Status:** Draft for review. Phase gate: no calibration code until this plan passes a review that did not write it.

## 0. Ground rules

- Mapping from milestones to spec ACs; all **14** ACs (C-1, C-1b, C-2 … C-13) claimed exactly once; an unclaimed AC is a plan bug. Table in §3.
- The value clock is a sequencing argument, stated once: **the log only accumulates from the day C.0 ships** — with hundreds of games needed for signal (spec §0), every week C.0 is early is a week more data at the far end. Foundation-first is not just dependency order; it is when the meter starts.
- PC-C-1 ✅ done. **PC-C-2 (rotate `RIOT_KEY`) is a hard gate on C.1** — the rotation must clear before outcome-fetch code ships against the key, while rotation is still a free one-click. PC-C-3's regression discipline is embedded in C.0's DoD.

## 1. Milestones

### C.0 — Capture foundation (the four-part path, one milestone — logging is dead without all four)

1. **Validator preservation:** `ValidSession` gains `gameId` + `queueId` (currently discarded, grep-confirmed); served through `/champ-select`.
2. **Platform sourcing:** one additional LCU GET (region/locale route) or config fallback — NOT from the session (dump-verified absent). Cached per helper session.
3. **`/calibration-log` POST** on the helper: origin-scoped + PNA like the GETs; body = the extended `CalibrationEntry`; writes the local JSON log (append-only, idempotent per `gameId`, matchmade-queues only — AC-C-3's filter at log time). The M7.5 seam stub becomes real here; its throw-test is replaced by real tests.
4. **Invariant rescope:** the read-only grep-test narrows to *outgoing LCU/Riot requests* (`lcu.ts`'s surface), helper docs updated to "no writes to any Riot surface" — the guarantee's meaning unchanged, wording tightened to what it always meant (AC-C-1b). The new POST handler must NOT be reachable from anything but the known origins.
5. **Frontend capture:** the web app computes and sends the entry at the two capture moments — at-pick (own pick locks; **OI-C-3 resolves here**, since the logger cannot ship without the definition — proposal: the score at the moment the local player's pick action completes, with whatever enemy info exists then) and FINALIZATION. Sent fire-and-forget; a missing helper must never affect the board (degradation intact).
6. **Log schema version field** in every entry (new, cheap, load-bearing later: this log is append-forever personal data crossing feature versions — an unversioned format orphans early games at the first change).

- **Closes:** AC-C-1, AC-C-1b, AC-C-2, AC-C-3.
- **DoD (the end-to-end proof, per review):** *a real rating, computed by the frontend during a live champ-select, POSTed to the helper, landing in the log file with its `gameId`, `queueId`, `platform`, phase discriminator, and schema version* — verified by reading the file. Not "each piece exists": the whole path, exercised once against reality. Plus: M7's acceptance path reruns green (helper suites + live degraded-state check — this touches shipped helper code), and the rescoped invariant tests pass with the POST present.

### C.1 — Outcome fetch (GATED: PC-C-2 rotation clears before this ships)

Helper-side reconciliation on launch (**OI-C-2 resolves here**: on-launch reconciliation, the simplest non-wasteful trigger — the fetch is cheap and a background cadence buys nothing for a log that grows by a few games a day): for each entry without an outcome, fetch `{platform}_{gameId}`, resolve own win/loss via participant match, record. Orphan handling per AC-C-5 (bounded retry window → marked orphaned, excluded); failures loud, store uncorrupted, retry clean (AC-C-6). Key from environment only.
- **Closes:** AC-C-4, AC-C-5, AC-C-6.
- **DoD:** a logged real game resolves to its recorded outcome end to end; a synthetic orphan ages out correctly; a 403 (wrong key) fails loud without corrupting the store. **Gate check in the milestone itself: assert the key in the environment is NOT the one that transited the chat** (rotation actually happened, not just intended).

### C.2 — G1: AUC engine (dev-facing diagnostic)

Pure statistic in `packages/core` (house rules: pure, zero I/O, deterministic tests): AUC over win/loss pairs with ties = 0.5; bootstrap CI (seeded RNG for test determinism); finalization-score primary, at-pick secondary, never blended; the ≤3-bucket curve as the secondary view with its contamination label.
- **Closes:** AC-C-7, AC-C-8, AC-C-9.
- **DoD:** property tests (known-ordering synthetic data → AUC > 0.5 with CI excluding 0.5; shuffled labels → CI spanning 0.5; tie handling exact); a dev-facing readout script over the real log.

### C.3 — G2: patient report card (player-facing)

The card in the web app, reading the helper's log through a GET: CI-first headline with game count, point estimate de-emphasized (AC-C-10); the misread guard **tested structurally** (AC-C-11 — below-floor renders exactly "sample too small to conclude" with the CI spanning no-effect; no bare accuracy percentage anywhere: a test greps the rendered output the way PickScore's closed-key-set test guards AC-13); visible counter + narrowing CI (AC-C-12); leads with what it can't attribute (AC-C-13). **OI-C-1 resolves here** (display floor default: no estimate below ~20 games; CI-with-inconclusive-label after).
- **Closes:** AC-C-10, AC-C-11, AC-C-12, AC-C-13.
- **DoD:** rendered states verified for n=0, n<floor, n≥floor-inconclusive, and (synthetic) n-large-conclusive; the misread-guard test fails if any rendering path shows a bare percentage.

## 2. Sequencing

```
C.0 (capture foundation) ─► C.1 (outcome fetch, PC-C-2-gated) ─► C.2 (AUC engine) ─► C.3 (card)
```
Strict chain — each consumes the prior's output (no log → nothing to fetch; no outcomes → nothing to rank; no statistic → nothing to render). No parallelism worth its coordination cost at this size.

## 3. AC coverage (14/14 — the plan-bug check)

| Milestone | ACs closed | OI/PC resolved |
|---|---|---|
| C.0 | AC-C-1, AC-C-1b, AC-C-2, AC-C-3 | OI-C-3; PC-C-3 (embedded in DoD) |
| C.1 | AC-C-4, AC-C-5, AC-C-6 | OI-C-2; PC-C-2 (gate, verified in DoD) |
| C.2 | AC-C-7, AC-C-8, AC-C-9 | — |
| C.3 | AC-C-10, AC-C-11, AC-C-12, AC-C-13 | OI-C-1 |

## 4. Risks for the reviewer to attack

1. **C.0 touches shipped helper code** (validator, server, invariant tests) — the M5-store-rewrite class. Mitigation is in the DoD: M7's suites rerun, live degraded-state recheck, and the end-to-end capture proof rather than per-piece assertions.
2. **The fire-and-forget capture could silently not fire** (helper absent at lock-in → no entry, forever). Accepted for v1: the log samples games-where-the-helper-ran, which is the population the tool advised anyway — but the card's game counter makes gaps visible. Named here so it's a decision, not a surprise.
3. **Bootstrap in a pure package needs seeded randomness** — tests must be deterministic; the RNG is a parameter, not a global.
4. **The at-pick definition (OI-C-3 proposal)** locks a measurement forever once games accumulate — changing it later forks the dataset (schema version field exists for exactly this, but avoid needing it).

## 5. Process from here

```
[this plan] → review by a context that didn't write it (coverage, sequencing,
and the declared hardest look: C.0's DoD proves the FULL capture path end to end)
→ /implement C.0 → … → calibration acceptance → the meter runs
```

---

## Review-notes (status)

- **Plan review (operator side, 2026-07-04): PASSED.** All four CC additions
  accepted (schema-version field, verified-not-trusted key rotation,
  OI-C-3 pulled to C.0, the named sampling decision); coverage 14/14 clean
  on first pass; strict-chain sequencing confirmed correct at this size;
  C.0's end-to-end DoD endorsed verbatim as the hardest-look item.
- **C.0 opens on ONE pending confirmation (operator's, not CC's):** the
  at-pick score definition (OI-C-3) becomes permanent the moment the first
  real entry is logged — changing it later forks the dataset. Proposed:
  "the score at the moment the local player's pick action completes."
  Alternatives named at review: after-all-allies-pick, or
  last-score-before-lock-in.
- **CC input on hardening the definition (whichever is chosen):** at-pick
  information varies enormously by pick position — a first-pick logs with
  0–2 enemies visible, a last-pick with 4–5 (observed in both live draft
  timelines). The at-pick curve therefore mixes low- and high-information
  predictions. Cheap de-risk: log an `enemiesVisible` count (and ally
  count) in every entry alongside the rating — context captured at the
  moment, so the at-pick analysis can be stratified by information level
  later WITHOUT forking the dataset. This does not change the definition
  choice; it makes any choice more future-proof, and it costs one integer.
