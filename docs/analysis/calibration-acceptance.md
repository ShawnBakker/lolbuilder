# Calibration acceptance record — C.0 → C.3 (chain complete 2026-07-06)

The pattern from `m7-acceptance.md`: every milestone's DoD, closed by
observation, with the evidence and the invariant evolutions in one place.

## Timeline

| Milestone | Closed | The observation that closed it |
|---|---|---|
| C.0 capture foundation | 2026-07-05 | Live ranked draft (gameId 5595476472) wrote both entries — frontend rating → local POST → validated, enriched (platform "NA1" resolved live), deduplicated, on disk with full provenance. Second draft (5595810920) then showed at-pick/finalization DIVERGING (4 vs 5 enemies visible, −0.287 vs −0.267) — the phase discriminator earning its keep in real data. |
| C.1 outcome fetch | 2026-07-06 | PC-C-2 cleared first (rotation verified by fingerprint + live 200; the artifact REFUSES the compromised key by SHA-256). First launch reconciled both games unprompted (LOSS, LOSS); automated gold@15 matched prior MANUAL computations exactly (−8137, −5926) — independent cross-validation. Relaunch: idempotent (2 lines, 0 refetches). |
| C.2 AUC engine | 2026-07-06 | Property tests (ordering → AUC 1 with CI excluding 0.5; shuffled → CI spans 0.5; ties exact; seed-deterministic) + the dev readout over the REAL log printing the honest state: "0W/2L, 0 pairs — INSUFFICIENT: no number is the honest output." |
| C.3 patient card | 2026-07-06 | Rendered-state tests (n=0 / below-floor / inconclusive / synthetic-conclusive / no-helper) + the STRUCTURAL misread guard: no percent sign in any card state, no estimate below the 20-outcome floor, non-attribution lead precedes every number. Live: the card renders the real log through GET /calibration-data. |

## The invariant evolutions (each named, none slid)

1. **AC-C-1b (C.0):** "read-only" tightened to what it always meant —
   no writes to any RIOT surface. The local calibration POST is a
   different category. Grep-tests rescoped accordingly.
2. **C.1:** outbound requests exist in exactly two modules, both GET-only:
   `lcu.ts` (loopback LCU) and `riot.ts` (official Match-V5). Filesystem
   writes in exactly two: the store and the reconciler. The key's VALUE
   can never reach a log call (process.env banned in diagnostics).
3. **Credential discipline:** the chat-transited key is refused by
   fingerprint in the artifact itself — rotation was verified, not
   trusted, and the key literal exists nowhere in the repo (tests exercise
   the gate through injected state).

## Data-integrity decisions that will matter in six months

- Entries carry **provenance** (`context`: patch + k values) — a k-tune is
  a stratification, not a silent dataset fork.
- Entries carry **information level** (`enemiesVisible`/`alliesVisible`) —
  at-pick analysis can stratify by pick position without re-measuring.
- Outcomes live in their **own append-only file**; the capture log is
  never rewritten. gold15/xp15 accumulate from day one for the parked
  intermediate-outcome analysis.
- Everything is schema-versioned (CALIBRATION_SCHEMA, OUTCOME_SCHEMA).

## Current meter state (at chain completion)

2 games · 4 predictions · 2 outcomes (0W/2L) · 0 orphans · both with
gold15/xp15. The card says "sample too small to conclude," which is the
system working. Power math says hundreds of games for a conclusive
ordering verdict; the intermediate-outcome path (parked, unblocked now
that C.1 stores gd@15) may show signal far sooner.

## What was deliberately NOT built

Auto-tuning from the signal (measuring ≠ retuning), win prediction,
multi-user anything, off-machine sync, a reliability percentage anywhere
in the player-facing card.
