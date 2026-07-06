# Spec — F8: pick suggestion (candidate ranking for the open slot)

**Phase:** /spec (follows `pick-suggestion-brainstorm.md` + its in-repo
grounding addendum, 2026-07-05)
**Drafted by:** CC. **Per the seam: needs an OUTSIDE review pass** —
what-to-attack list in §7.
**Status:** Draft for review, then /plan.

## 0. Confirmed foundations (from the brainstorm + grounding)

- **Bans are already transported** (PC-M7-3: they live in the actions
  array; the helper validates and serves them today). LCU-mode ban input
  is a provider read; only manual entry and the input type are new work.
- **The candidate pool has a principled definition:** M7.0's `lanes`
  field (per-champion role pick-share) — the same prior inference uses.
- **The scoring loop is proven code:** the OI-4 sensitivity sweep is
  literally "loop candidates, call scorePick" over real shards.
- **Off-role WR was never validated** (`?lane=` unprobed): coarse ranking
  may only claim what shards know — the default-lane baseline.
- **DraftState is calibration-logged verbatim** — it must NOT be extended
  (an append-forever store would churn). Sibling input type, decided.

## 1. Scope

Given the current board (allies, enemies, bans) and the open lane, present
a **ranked shortlist of viable candidates with per-candidate reasoning and
sample sizes** — several options with tradeoffs, never a single commanded
pick (the advisory-framing hard line, and Riot's stated preference:
"highlight decisions… give multiple choices").

**Non-goals:** no auto-anything; no off-role WR claims; no enemy-pick
prediction; no "best pick" superlative anywhere in the UI; no coverage
promise (a champion missing from the pool is absence, not judgment).

## 2. Input type (sibling, not extension)

```ts
interface SuggestionContext {
  allies: SlotRef[];      // WITHOUT the open slot
  enemies: SlotRef[];     // role-known only, as everywhere
  bans: ChampionId[];     // ≤10; deduped; empty = none known
  openLane: Lane;
}
```
`DraftState` is untouched. Per candidate, the engine consumes a normal
`DraftState` built as `{ pick: {cid: candidate, lane: openLane}, allies,
enemies }` — the existing contract, unchanged.

## 3. Features & acceptance criteria

### F-S-1 — Candidate pool (viability, exclusions)
- **AC-S-1:** pool = champions whose `lanes[openLane]` share ≥ the pool
  floor (OI-S-1), minus every picked cid (both teams) and every banned
  cid. Exclusions are absolute: a banned/picked champion never renders,
  in any state, even mid-data-load.
- **AC-S-2:** flex champions whose share clears the floor appear in the
  pool for multiple lanes; their coarse row shows the SHARE, and shows a
  win rate ONLY when their default lane equals the open lane (the
  validated-data boundary from grounding note #4). No off-role WR, ever.

### F-S-2 — Two-stage ranking (coarse instantly, full lazily)
- **AC-S-3:** a per-role **tier shard** (pipeline addition, M2-family:
  one small file per lane per patch, fields per OI-S-2) renders a coarse
  list instantly on panel open — no per-champion shard fetches for the
  coarse view.
- **AC-S-4:** the top-K (OI-S-3) candidates — and any candidate the user
  expands — get **full engine scoring** against the real board: fetch the
  candidate's shard, build the DraftState, scorePick. The displayed
  ranking re-orders as full scores arrive, visibly (a "scored vs your
  board" marker distinguishes engine-ranked rows from coarse-ranked ones —
  two different claims, never visually conflated).
- **AC-S-5:** full-scored rows show tier + confidence + the top
  contributing reasons via the existing `describeComponent` language,
  with sample sizes. Coarse rows show only baseline facts + share.

### F-S-3 — Bans input
- **AC-S-6:** LCU mode: bans populate automatically from the session's
  completed ban actions (both teams' bans exclude — a champion banned by
  either side is unavailable). Manual mode: a ban entry strip (same
  search-assign flow as slots) with visible chips; clearing the board
  clears bans.
- **AC-S-7:** ban state changes re-filter the pool immediately; a
  suggestion for a just-banned champion must not survive one render.

### F-S-4 — Advisory framing (structural)
- **AC-S-8:** the panel always renders ≥3 candidates when the pool allows
  (never exactly one); the heading is descriptive ("candidates for
  support"), and no UI string contains a superlative or imperative
  ("best," "pick this," "should"). Enforced the closed-set way: a test
  greps the panel's rendered output and its source strings.
- **AC-S-9:** every displayed number carries its n or confidence label,
  per house rules; coarse rows are visibly coarse (AC-S-4's marker).

## 4. Open items (resolve at /plan)

- **OI-S-1:** pool share floor (candidate: ≥5% — Sion's 5% jungle share
  in live data is a real flex; tune against pool sizes per lane).
- **OI-S-2:** tier-shard fields — proposal: `{cid, share, defaultLane,
  wr (default-lane only), n, br}`; ~40 rows × 5 lanes, one file each.
- **OI-S-3:** K for auto full-scoring (candidate: 8 — bounded fetch burst
  ≈ 8 × ~70KB; measure at /plan per PC-S-2).
- **OI-S-4:** panel placement (below the board? replaces the score panel
  while the pick slot is empty? — UX call at /plan).

## 5. Pre-implementation checklist (gates /implement)

- **PC-S-1:** tier-shard pipeline addition proves the M2-family property:
  zero-live-request re-emit from cache, verified before merge.
- **PC-S-2:** measure the top-K fetch burst (size + latency) against the
  deployed Pages origin before fixing K.
- **PC-S-3:** frontend store/flow changes rerun the AC-1/AC-2 search-flow
  regression suite (the store-rewrite discipline).

## 6. Process

```
[this spec] → OUTSIDE review → /plan (locks OI-S-1..4) → build
```

## 7. Review handoff — what to attack

1. **The two-stage claim discipline (AC-S-4):** is "coarse-ranked vs
   engine-ranked, visually distinct" honest enough, or does showing ANY
   coarse ordering invite the misread that it's a recommendation?
   Alternative: unranked-alphabetical coarse list until full scores exist.
2. **AC-S-2's no-off-role-WR line:** it makes flex rows visibly thinner
   (share only). Right call, or should the panel say why ("win rate not
   shown: no validated off-role data")?
3. **The pool definition:** lanes-share as the sole viability signal —
   misses niche-but-real picks below the floor. Acceptable absence, or
   does the panel need an "add any champion" escape hatch (which
   full-scores whatever the user names)?
4. **AC-S-8's structural framing test:** sufficient as stated, or should
   the ban on superlatives extend to the ordering itself (see #1)?
5. **Scope check:** is a ban-entry UI in manual mode worth its surface,
   given LCU mode populates bans for free and manual users can just not
   enter bans (pool merely includes banned champs)? Cheaper cut?
```
