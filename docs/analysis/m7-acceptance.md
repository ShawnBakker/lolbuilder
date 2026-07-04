# M7 acceptance record — 2026-07-04

All 17 ACs verified; the live-observed subset was observed against a real
ranked client, not argued from tests. OI-M7-1 (threshold 60), OI-M7-2
(polling), OI-M7-3 (single-file bundle + bat + install doc) all resolved.

## Live evidence (operator captures + helper/watcher instruments)

- **Ally auto-populate with roles** — three-phase capture (BAN_PICK →
  FINALIZATION), including live mid-draft position swaps.
- **Enemy reveal + inference** — two real drafts. Draft 1: 5/5 enemies,
  badges verified against shard data to the digit (Ezreal 96, Akali 69,
  Jax 73, Rengar 91). Draft 2: two genuine below-threshold flexes (Sylas,
  Tryndamere) correctly left "role needed" — the blank-beats-wrong case
  observed in the wild, closing the earlier retraction.
- **Manual correction stickiness** — observed surviving the 2s poll cycle
  and clearing the inferred marking (AC-M7-8 + AC-M7-2b live).
- **Graceful degradation** — observed live in three distinct states.
- **Helper logs silent across every session** — all real payloads passed
  AC-M7-6's invariants; nothing needed redaction (AC-M7-11 held live).
- **The distribution artifact itself was live-tested** — the second draft
  ran the bundled `helper.mjs`, not the dev build.

## The incident worth remembering (found BY this acceptance process)

Draft 1 showed Vel'Koz as "role needed"; three reviewers read it as the
honesty threshold firing on a flex. The shard cross-check refuted it:
Vel'Koz's support share (63.6%) clears the bar — the true cause was a
render bug (change-detection keyed on the session, blind to shard arrivals;
the recomputed inference never notified React; the UI froze on the stale
pre-shard state). A bug wearing the honesty feature's label. Fixed
(`adf2abe`: signature the derived slots), regression-tested with the exact
live sequence plus the real five-enemy comp, redeployed (hash-verified),
and re-observed correct in draft 2. Caught by the third instrument —
verifying the screenshots' numbers against the data — after tests, live
run, and review had all passed it.

## Post-M7 candidates on record (none opened)

Matchup-conditioned builds (seam stubbed), calibration log (seam stubbed),
hover display (deliberately not built — scope line held), F8 pick
suggestion (brainstorm exists), joint role assignment (capture only).
