# Feature Brainstorm — Pick Suggestion (candidate ranking)

**Status:** New scope, not yet spec'd. Distinct from v1's F2 (evaluate one chosen pick).
**Trigger:** Operator request, 2026-07-03, mid-M6. Explicitly NOT folded into M6a/M6b — needs its own brainstorm→spec pass per project discipline (the thing this whole project has been careful never to skip).

## 1. What this is, concretely

Given a partial draft (some allies locked, some enemies locked, a role still open on your side), rank the viable champions for that role by predicted quality — not "is Aatrox good here" (v1, built) but "who should I consider here" (this feature).

## 2. Why this isn't a small addition to F2

- **Policy framing is tighter.** D11's line is "advisory, never dictate." A ranked list with reasoning per candidate stays on the right side of that line; a single spotlighted "play this" does not. This needs to be a named AC, not inherited.
- **Perf model breaks.** F1/M5 assume ≤10 shard fetches (the champions actually on the board). Suggestion requires scoring the full undrafted/unbanned pool for one role — 30-40 candidates, ~2-4MB, exactly when the user has the least time to wait.
- **Input shape may not exist yet.** Needs: which role is open, which champions are banned (10 slots' worth, currently not modeled anywhere), and the partial ally/enemy state (already modeled). Bans specifically are new — F1 never needed them since v1 only evaluates already-made picks.

## 3. Options for the perf problem (needs a decision, not a default)

**A. Pre-aggregated role tier shard.** Pipeline emits one small per-role, per-patch file (role baseline WR + pick/ban rate, no matchup-specific data) alongside the existing per-champion shards. Instant coarse ranking on load; full per-candidate scoring (existing engine, existing shards) fetched lazily only for whichever candidates the user expands. Cheap pipeline addition (M2-family, near-free re-emit like M6a). Recommended default.

**B. Score everything client-side on demand.** Simplest to build, worst UX — a multi-MB fetch burst at exactly the wrong moment (mid pick-timer).

**C. Cap the candidate pool.** Only rank the top-N by raw pick rate in that role, fetch those N shards. Cheaper than B, less honest than A (a low-pick-rate hidden gem never surfaces).

## 4. Draft-state extension needed

- Add a `bans: ChampionRef[]` (≤10) to whatever input this feature consumes — new, not currently in `DraftState`.
- Add an explicit "role to fill" — may already be inferable from an empty ally slot with an assigned role; confirm before assuming.
- Decide: extend `DraftState` itself (affects the provider seam, AC-1) or a sibling type consumed only by this feature. Leaning sibling — keeps v1's contract untouched, per the project's habit of not smuggling scope into stable interfaces.

## 5. Recommended shape for /spec

- New feature ID (F8), own AC set, explicitly building on F2/F4's scoring engine (packages/core) rather than duplicating it — `scorePick` already exists and takes a champion + draft context; this is a loop over candidates calling the same function, not new scoring logic.
- AC requiring reasoning-per-candidate in the output (policy framing, §1 above) — never a single "the pick" field.
- AC naming which perf option (§3) was chosen and why.
- Explicit bans modeling as its own small AC — first time the project has needed to represent bans at all.

## 6. Not yet decided (for /spec, not here)

- How many candidates shown by default (5? 10? all with a "show more")?
- Does role-tier-shard (option A) get its own cache/refresh cadence, or piggyback the existing per-patch pipeline run exactly?
- Any interaction with the v2 LCU provider — champ-select bans are known live from the client; this feature gets much better once that lands. Worth designing so it degrades gracefully (manual ban entry now, auto-populated later) rather than assuming LCU from day one.
