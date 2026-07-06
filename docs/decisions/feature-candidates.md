# Feature candidates — the consolidated queue (status + gates)

**Purpose:** one place for every parked, queued, or gated candidate, so
nothing gets re-discovered or slides in ungated. Each entry names its
gate. Additions enter the build only through brainstorm → spec → plan.
(Created 2026-07-05, consolidating the post-M7 list, the market-landscape
grounding, and the expansion action items.)

## In flight

- Nothing in-build. **The calibration chain (C.0→C.3) closed 2026-07-06**
  (`calibration-acceptance.md`); v1.2.0 released; the meter is
  self-sustaining (2 games · 4 predictions · 2 outcomes at closure).
- **Three CC-drafted docs are out for outside review** (the seam:
  whoever writes a document doesn't review it): the matchup-builds
  review brief, the F8 pick-suggestion spec, and the
  intermediate-outcome brainstorm. Queue items 1–2 below and the
  intermediate-outcome candidate are blocked on those passes.

## Queued (order recommended, not forced)

1. **Matchup-conditioned builds** — the next new feature. Fully inside the
   hard lines; the CORS blocker dissolved when the helper shipped; the
   vs-route shape was live-validated (M6a) and the helper seam is stubbed
   (AC-M7-15). Brainstorm drafted 2026-07-05
   (`docs/brainstorm/matchup-builds-brainstorm.md`, CC-drafted → needs an
   outside review pass per the seam). Named invariant evolution required:
   a second outbound surface (lolalytics vs-route) alongside the LCU —
   the "no outgoing requests outside lcu.ts" test rescopes explicitly,
   the AC-C-1b pattern.
2. **F8 — pick suggestion** (candidate ranking). Brainstorm exists
   (`pick-suggestion-brainstorm.md`); spec drafted 2026-07-06
   (`docs/spec/pick-suggestion-spec.md`, CC-drafted → out for outside
   review per the seam). Bans modeling simplified by M7 (provider
   supplies them; manual entry is degradation).
3. **"Explain WHY" deepening** — first cut LANDED with the C.3 UI pass
   (`describeComponent`: per-component plain-language readings in the
   score table; live-verified 2026-07-06). Anything deeper rides the
   next frontend pass.
4. **Layout width / frontend pass** (v1 click-through backlog item) —
   width + Rift theme landed with C.3 (60→78rem, hextech panels).
   Remaining: panel layout rethink, App.tsx split.

## Parked (deliberate, with reopen conditions)

- **Post-game breakdown** — sanctioned (Match-V5), fits hard lines, but
  competes with calibration C.2/C.3 for the same data muscle. Reopen after
  the calibration chain lands. **Reopen condition met 2026-07-06** —
  eligible whenever the operator wants it; not auto-opened.
- **Hover display** ("enemy is considering X") — data observed (PC-M7-3),
  deliberately unbuilt: needs its own visibly-marked-as-hover honesty
  treatment. Reopen as its own small feature only.
- **Joint role assignment** — capture only
  (`joint-role-assignment-capture.md`); the brainstorm question is the
  joint-confidence threshold that preserves blank-beats-wrong.
- **Intermediate-outcome analysis** (gold@15 as a faster-converging G1
  diagnostic) — research done (`calibration-research.md`); C.1 stores
  gold15/xp15 from day one; brainstorm drafted 2026-07-06
  (`intermediate-outcome-brainstorm.md`, CC-drafted → out for outside
  review per the seam).

## Gated on a register decision (dormant until the operator opens it)

- **One-click build/rune import** — the market's most-praised feature,
  Riot-tolerated, and a WRITE to the LCU: against D11 as written
  ("no writes to any Riot surface, ever"). Sequence if ever wanted:
  D11 amendment first → helper write-invariant rescope + INSTALL promise
  rewrite → brainstorm. Ordering is firm; the values call is the
  operator's. (Surfaced by the market-landscape grounding, 2026-07-05.)

## Refused (standing, with the reason)

- **Named-player scouting / Smart Tags** — Riot red line (historic Riot
  IDs) + the shaming concern; PC-5 cross-check and the market report's
  own policy reading agree.
- **Live in-game overlay** — "measurable advantage" examples target it
  directly; also the footprint this project exists to avoid.

## Cheap standing action items (from expansion-decisions.md)

- **Origin allowlist in the helper** — landed 2026-07-05 (this commit);
  future domain migration is now a list edit, not a fleet break.
- **Manifest `schemaVersion`** — the day a second shard consumer appears.
- **Helper check-and-prompt update tier** — one version file + one log
  line, whenever convenient before the fleet grows.
- **Pages deploy-failure visibility** — a failed Pages deploy is
  currently invisible until someone looks (bitten 2026-07-06: the
  explain-why commit silently never shipped; two platform-side failures
  — `visual-verification-2026-07-06.md` F1). Cheap options: frontend
  shows its build sha next to the dataset date, and/or a notification
  on `pages.yml` failure. Also on record there: recovery for a failed
  Pages deploy is `workflow_dispatch`, never "re-run failed jobs"
  (duplicate-artifact hard fail).
