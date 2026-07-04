# PC-M7-3 findings — live champ-select capture (2026-07-04, Normal Draft)

Instrument: disposable probe (`tools/pc-m7-3-probe.mjs`, deleted after this
record per its contract). 19 distinct snapshots at 2s polling across a full
real draft (BAN_PICK → FINALIZATION → GAME_STARTING). Raw dumps local-only
(gitignored — they contain real players' identifiers); the load-bearing
evidence is summarized here. Token redaction (AC-M7-11's mechanism) held
throughout: lockfile token absent from every output and dump.

## CHECK results (pass criteria were pre-defined in the probe)

1. **Enemy champions exposed: YES — 5/5.** `theirTeam[].championId`
   populates progressively as enemies LOCK (2 champs at t+14s, +1 at t+38s,
   +1 at t+48s, all 5 by FINALIZATION t+76s), mirrored by completed
   `actions` entries with `isAllyAction: false`. AC-M7-7's core assumption
   is now observation, not hypothesis.

2. **Enemy position hints: NO — 0/5 the entire draft** (allies: 5/5
   `assignedPosition` populated). Consequence for /plan: champion-role
   priors are **load-bearing** for enemy-role inference, not a secondary
   signal — there is no LCU position data for enemies to fall back on.
   (One mode, one game: Normal Draft. No reason to expect ranked differs on
   this field, but that is inference, not observation.)

3. **league-connect works against the live 2026 client** (PC-M7-2):
   `authenticate()` + requests succeeded despite the 2-year-stale RC.
   Hand-rolled control also worked in the same run. /plan's client choice
   is free preference (dependency weight vs ~50 owned lines), not forced.

4. **Hand-rolled path: YES** (HTTP 200s throughout — it took every snapshot).

5. **Websocket: reachable** via league-connect (OI-M7-2 data point; 2s
   polling also proved entirely sufficient — it caught every transition
   including sub-lock hover flickers).

## Bonus findings (unhypothesized, design-relevant)

- **Enemy pre-lock hovers are visible.** Uncompleted enemy pick actions
  carry the hovered championId: observed 412 (hover) → 111 (hover) → 111
  locked at one slot, and 27 → 14 → 27 → locked at another. Enemy *pick
  intent* streams in real time. Design option for M7/F8: show "enemy
  considering X" pre-lock — marked as intent, not fact, per the honesty
  standard. Caveat: observed in Normal Draft once; ranked hover visibility
  unverified.
- **Ban data lives in `actions`, not `session.bans`.** The `bans` object
  stayed `{myTeamBans:[], numBans:0, theirTeamBans:[]}` all draft while
  five completed enemy ban actions (with championIds) were present from
  t+0, plus a `ten_bans_reveal` action type. F8 must read actions.
- **`theirTeam` cellIds (5–9) do not encode roles** — ordering is pick-slot,
  not lane. Nothing about slot order should feed inference.
- **Ally-side data is rich:** `myTeam` carries full `assignedPosition` in
  matchmade (5/5) — the ally half of the board auto-fills with roles for
  free; inference is needed for enemies only.

## Consequences locked for /plan

1. LcuProvider maps: allies ← `myTeam` (championId + assignedPosition,
   complete); enemies ← `theirTeam.championId` as locks land; enemy roles ←
   prior-based inference (AC-M7-7/8), which now has no LCU fallback signal.
2. The lanes-distribution shard field (AC-M7-7's named work item) is
   confirmed prerequisite work — it is the ONLY role signal for enemies.
3. Poll-vs-websocket (OI-M7-2): 2s polling demonstrably sufficient for
   champ-select cadence; websocket remains the cleaner option, not the
   necessary one.
4. PC-M7-2 + PC-M7-3 both ✅ — /plan is unblocked on empirical gates.
