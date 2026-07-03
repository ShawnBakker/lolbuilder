# Spec — LoL Pick Analyzer & Build Planner (v1)

**Phase:** /spec (follows brainstorm v2 + smoke-test FULL PASS, 2026-07-02)
**Inputs:** `docs/brainstorm/pick-analyzer-brainstorm.md`, `docs/brainstorm/smoke-findings.md`
**Status:** Draft for operator review. Locks architecture + feature set; /plan sequences the build.

## 1. Scope

A static web tool: enter a 10-champion draft (your pick, 4 allies, 5 enemies, roles); receive (a) an advisory pick assessment with early/mid/late and overall components, (b) the highest-WR build vs. the lane opponent, (c) rule-based counter-items vs. the enemy composition. Data refreshed per patch from validated lolalytics sources. Private, noncommercial, friends-only.

**Non-goals (inherited from brainstorm, final):** no public release; no database; no Riot API data ingestion (personal key registration only, for standing + future calibration); no ML draft model; no accounts; no automation of any Riot surface. Output is advisory — ranking heuristic framing, never a commanded pick.

## 2. Data contracts (validated, see smoke-findings.md)

| # | Source | Carries | Format | Notes |
|---|---|---|---|---|
| D1 | `a1.lolalytics.com/mega/?ep=build-team&v=1&patch=<16.NN>&c=<name>&lane=<lane>&tier=<tier>&queue=ranked&region=all` | Full pairwise synergy per teammate role (`team_h`: id, wr, d1, d2, pr, n) | Clean JSON, header-array | Open host, no headers needed, tier filter works via GET |
| D2 | `lolalytics.com/lol/<name>/build/q-data.json` | Baseline WR/PR/BR/n + tier grade, daily per-rank series, item sets (wr,n), runes, skills, `time`/`timeWin` 7 buckets, counter refs | Qwik object graph (`_objs`, base-36 refs) | Datacenter-accessible despite HTML bot wall |
| D3 | `lolalytics.com/lol/<name>/counters/q-data.json` (+`?lane=`, `?vslane=`) | Full per-opponent matchup tables: WR, Delta1, Delta2, avg-opponent baseline; 100-game source floor; cross-lane via vslane | Same as D2 | Pre-implementation checkbox PC-1 confirms shape |
| D4 | Data Dragon + Community Dragon | Champion/item/rune static data, id↔name↔display bridge, patch manifest | Clean JSON | Patch translation: live 26.NN ↔ ddragon 16.NN.1 ↔ lolalytics 16.NN |

**Fallback chain (documented, not built in v1):** u.gg CDN pattern (captured, PC-3) → op.gg MCP (existence check PC-2). Trigger: sustained D1–D3 breakage per brainstorm §6 downscope criterion.

## 3. Architecture (locked)

Static-first, zero servers, zero standing cost:

```
GitHub Actions (daily cron)
  └─ version check vs DDragon manifest ──(patch change or day-7 refresh)──►
     pipeline run: fetch D1–D4 → qwik-deserialize → normalize → shrink →
     emit sharded JSON (per champion-role) → publish as GitHub Release (tag = patch)
GitHub Pages: Vite+React static frontend
  └─ lazy-loads shards for the ≤10 champions on the board from releases/latest
```

**Infra decision rationale:** the smoke test proved every source serves datacenter IPs bare, removing the VPS's only load-bearing argument (IP hygiene). GH Actions cron drift (≤40min) is irrelevant at ~2 full runs per patch cycle (~4–5/month). Releases (not repo commits) hold data — prevents 0.5–2.4 GB/yr git-history bloat. The Oracle VPS is not part of this system; if it returns, it returns for Minecraft.

**Monorepo layout (pnpm):** `apps/web` (Vite+React), `apps/pipeline` (Node scripts), `packages/core` (scoring — pure, unit-tested), `packages/types` (domain types), `packages/qdata` (deserializer + golden fixtures).

## 4. Features & acceptance criteria

### F1 — Draft board (ManualProvider)
10-slot board, role-assigned, champion search via Data Dragon names. Produces a `DraftState`.
- AC-1: `DraftState` is produced only through the `DraftStateProvider` interface; `ManualProvider` is the sole v1 implementation. (The LCU provider is v2; the seam is v1.)
- AC-2: Every champion appearing on the board triggers immediate shard prefetch (champ-select speed requirement carried from brainstorm §8).
- AC-3: Flex handling: any champion may be assigned any role; scoring consumes cross-lane (vslane) matchup data when lane ≠ opponent lane. *(vslane empirically validated 2026-07-02 review probe 6: `?vslane=middle` flips route state and opponent set, min n=110.)*

### F2 — Data pipeline
- AC-4: Pipeline is idempotent per patch; re-runs resume from local fetch cache (politeness requirement).
- AC-5: Requests are sequential with ≥2s delay, honest UA; full-scrape cadence **≤2 per patch cycle** (patch day + one mid-patch refresh) enforced by the trigger logic, not by promises. *(Amended: the earlier "≤3×/month" phrasing didn't close against the 14-day cycle — 2 patches/month × 2 runs = 4/month. Per-cycle is the enforceable invariant.)*
- AC-6: Champion list is derived from Data Dragon's manifest each run — a new champion release requires zero code changes.
- AC-7: Output shards are versioned by patch and published as a GitHub Release; the frontend can pin or follow latest. **Gated on PC-6** (Release-asset CORS from a Pages origin is unverified — asset downloads redirect via objects.githubusercontent.com with historically inconsistent CORS). Fallback if PC-6 fails: pipeline additionally publishes the current patch's shards to the Pages branch; Releases remain the archive.

### F3 — q-data deserializer (`packages/qdata`)
- AC-8: Resolves the Qwik object graph mechanically (flat `_objs`, base-36 refs) for exactly the tables we consume — not a general Qwik deserializer. **Resolution must occur at leaf level, single hop**: every container slot (object field, array element) is a base-36 ref, and primitives exist only as top-level `_objs` entries *(corrected 2026-07-03: the earlier "mixed literal/ref interning" claim was an inference from a NaN, refuted at fixture scale — 8 payloads, 2 capture days, zero literal slots)*.
- AC-9: Named invariants fail loudly with the violated assumption in the message, and **run post-resolution** (pre-resolution type checks false-alarm on ref-valued leaves): root `_entry` resolves; every container slot is a canonical in-range base-36 ref (a non-string slot is a format violation — this is itself a drift alarm); `time`/`timeWin` present as objects keyed "1"–"7" whose values resolve to numeric games/wins with wins ≤ games; `team_h` columns ⊇ {id, wr, d1, d2, pr, n}; matchup tables non-empty for a known-popular champion.
- AC-10: Golden-fixture tests: ≥2 captured raw payloads committed and **verified uniformly ref-encoded** *(the earlier dual-interning-mode coverage requirement was voided when the mixed-interning claim was refuted, 2026-07-03)*; CI runs deserializer against fixtures; a scheduled weekly CI job refetches one live payload and diffs shape — running **from GitHub Actions** so it doubles as the D5 same-IP-class canary.

### F4 — Scoring engine (`packages/core`)
Composite pick assessment in logit space over: pick's role-baseline WR, lane matchup delta, ally synergy deltas (consuming precomputed d1/d2), enemy-side counterpart terms.
- AC-11: All rates pass through shrinkage toward role baseline before logit transform, with **per-source k**: synergy cells (no source floor, n=1 tails observed) get k_synergy≈50; matchup cells (source-floored at n≥100, min observed 101) get a smaller k_matchup — exact values set in /plan via a sensitivity sweep (OI-4). Each k is a named constant with a doc-comment explaining why. *(Amended: a single global k over-disciplines floored matchup cells — weight n/(n+50)=0.67 at n=101 — flattening the signal the tool exists to surface.)*
- AC-12: Output is a `PickScore` with per-component contributions exposed (for the UI to explain itself) and a `confidence` derived from min sample size across consumed cells.
- AC-13: Framing invariant: the engine's public API names the composite a `rating`, not a probability; conversion to a displayed percentage happens only in the UI layer alongside its uncertainty treatment (F6).
- AC-14: Pure functions, zero I/O, property-tested: score is monotone in matchup WR; extreme low-n inputs converge to baseline.

### F5 — Phase analysis (early/mid/late)
Derived from `time`/`timeWin` buckets.
- AC-15: Phase groups are defined over bucket indices (default: early = 1–2, mid = 3–4, late = 5–7) behind a single mapping constant; **open item OI-1** resolves actual minute boundaries before the mapping is labeled with minutes in the UI.
- AC-16: Per-phase WR is computed from bucket aggregates with the same shrinkage discipline; buckets with n below floor render as "insufficient data," never as a number.
- AC-16b: **Semantics sanity check** before F5 ships: bucket WR is conditional on the game *ending* in that bucket (a selection effect, not "strength during the phase"). Verify the measure behaves as expected against known scaling profiles — a hyperscaler (Kayle-type) shows monotonically rising bucket WR, a lane bully the opposite — before any phase label reaches the UI.

### F6 — Honest-uncertainty UI
- AC-17: No bare decimals. Ratings render as qualitative tiers + rounded value + sample size; every number is accompanied by the n it rests on.
- AC-18: Stale-data banner when dataset patch ≠ live patch (from DDragon manifest check client-side).
- AC-19: A visible "what this can't tell you" disclosure: ranking heuristic, correlated signals, tier/region caveats (text sourced from brainstorm §7), **and the phase-semantics conditional stated plainly: phase figures are "win rate of games that ended early/mid/late," not "strength during that phase."**

### F7 — Team-aware itemization
Rule-based layer over F4's build output: anti-heal ≥2 healers, MR/armor skew vs. AP/AD counts, anti-shield vs. shield reliance, tenacity vs. CC count — thresholds from Data Dragon tags + a small curated table.
- AC-20: Rules are data (JSON), not code; each recommendation carries its trigger explanation string.

## 5. Pre-implementation checklist (blocking /plan sign-off, not spec review)

- PC-1: ✅ DONE (2026-07-02 review probe 4): counters q-data HTTP 200, 81 matchup rows {cid, vsWr, n, d1, d2, allWr, defaultLane}, min n=101 (100-game floor corroborated).
- PC-2: ◐ PARTIAL — op.gg MCP existence confirmed via external sources at `mcp-api.op.gg/mcp`; remaining: verify it carries matchup/build-level data (fallback #2 is only real if it does).
- PC-3: u.gg DevTools pattern capture (documents fallback #1).
- PC-4: ✅ DONE (review probe 5): lulu build q-data same graph structure, same time/timeWin shape and semantics.
- PC-5: Register Riot personal API key (product description: private draft-analysis tool, small friend group; discloses future LCU champ-select reads + low-volume Match-V5 for own results).
- PC-6: **NEW** — Release-asset CORS: one `fetch()` of a Release asset from a Pages-origin page. If it fails, AC-7's fallback activates (spec already amended).
- PC-7: **NEW** — Full pipeline dry-run executed *from GitHub Actions* (fetch → deserialize → emit for 2–3 champions). Settles D5's single-observation gap on GH's actual egress IP class. Blocking for /plan sign-off.

## 6. Open items

- OI-1: `time` bucket → minute-boundary mapping (compare payload against the site's rendered graph once, during F5 implementation).
- OI-2: License — PolyForm Noncommercial (reckon pattern) vs MIT (Roguemouse pattern). Portfolio-signaling call, operator's.
- OI-3: Synergy d1/d2 exact semantics — consume as opaque normalized deltas until verified against the site's published formulas during F4; do not re-derive without checking. *(Reinforced 2026-07-02: an external LLM review confidently summed d1/d2 as logit-space addends — they are percentage-point deltas per the site's definitions. This open item exists to prevent exactly that.)*
- OI-4: Per-source shrinkage constants (k_matchup, k_synergy) — set in /plan via sensitivity sweep (k ∈ {10, 25, 50}) over one patch's ranking stability.

## 7. v2 seams honored by v1 (no v2 code)

`LcuProvider` (champ-select auto-fill via local helper), calibration logging (Match-V5 own-results vs predicted, needs PC-5), live build advisor (Game Client API, sanctioned), curve metrics over buckets (slope/peak — parked).
