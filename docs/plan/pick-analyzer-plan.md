# Plan — LoL Pick Analyzer & Build Planner (v1)

**Phase:** /plan (follows spec as amended 2026-07-02)
**Status:** rev 2 — **passed adversarial review 2026-07-02** (operator pass) with three amendments, applied below: Gap A (Pages bootstrap precedes PC-6, in M1), Gap B (AC-3's data dependency made explicit in M2 + M3), PC-2r/PC-3 resequenced to M2's close; plus an OI-4 no-plateau fallback clause. **M0 authorized.** The phase gate held: no implementation code existed before this review.
**Author context:** Claude Code, in-repo — deliberately the same context that runs PC-6/PC-7 (handoff removal, D-review accepted); the compensating control is this review pass plus the phase gate.

## 0. Ground rules

- **The plan is a mapping from milestones to spec ACs.** The spec defines 21 ACs (AC-1 … AC-20 plus AC-16b). Every AC is claimed by exactly one milestone; an unclaimed AC is a plan bug. Coverage table in §3.
- A milestone's **definition-of-done** = its claimed ACs demonstrably satisfied (implemented, CI-gated where testable, verified against the AC's literal text) + its named PC/OI items resolved.
- Checklist state at plan time: PC-1 ✅, PC-4 ✅ (six-probe review); PC-2 ◐ (endpoint exists at `mcp-api.op.gg/mcp`; coverage check remains); PC-3, PC-5 open. **PC-6 and PC-7 live inside M1 by design:** PC-7's completion is *definitionally identical* to M1's completion, and PC-6 runs inside M1, before any frontend work can depend on AC-7's answer.
- Hard rules from CLAUDE.md apply throughout and are not restated per-task (politeness posture, fail-loud normalizer, advisory framing, read-only).

## 1. Milestones

### M0 — Scaffold (infrastructure only; closes no ACs — declared, not a bug)
pnpm monorepo per spec §3 layout (`apps/web`, `apps/pipeline`, `packages/core`, `packages/types`, `packages/qdata`); domain types in `packages/types` transcribed from the validated contracts (smoke-findings + addendum); CI gate: typecheck + unit tests on every push.
**DoD:** CI green on the skeleton. Explicitly closes zero ACs; every AC-bearing milestone starts at M1.
**Operator-parallel tasks (start here):** PC-2 remainder (op.gg MCP data-coverage check) and PC-3 (u.gg DevTools pattern capture) are **due by M2's close** *(resequenced per review: the breakage risk they mitigate peaks during M2 — the first production-volume contact with lolalytics — and a source break mid-M2 needs somewhere to fall)*. PC-5 (register Riot personal key — product description already drafted in spec §5) due by M6. These document the fallback chain; no code dependency.

### M1 — Deserializer + dual-mode fixtures + GH Actions dry-run (≡ PC-7)
All in `packages/qdata` + workflow files:
1. **Pages bootstrap (Gap A amendment — runs first):** enable GitHub Pages on the repo and deploy a minimal placeholder page via the Pages workflow. This is PC-6's previously unstated prerequisite (a CORS test "from a Pages origin" needs a Pages origin to exist), and it becomes the deploy seam M5 later reuses.
2. **Fixtures:** commit ≥2 raw captured payloads chosen to cover both interning modes (literal-leaf and ref-leaf rows). Candidates: the review's probe payloads (`p3`/`p4`/`p5`/`p6` class); if the scratchpad copies are gone, refetch fresh ones politely (4 requests, within posture).
3. **Deserializer:** leaf-level ref resolution; extraction of exactly the consumed tables; named post-resolution invariants per AC-9 (root `_entry` resolves; `time`/`timeWin` objects keyed "1"–"7", numeric, wins ≤ games; `team_h` ⊇ {id, wr, d1, d2, pr, n}; matchup tables non-empty for a known-popular champion).
4. **CI wiring:** fixture tests on every push; scheduled weekly refetch-and-diff job running **from GitHub Actions** (AC-10) — doubles as the D5 same-IP-class canary from day one.
5. **PC-6 task (after task 1; before any frontend work depends on AC-7):** publish a throwaway Release asset; one `fetch()` from the Pages-origin page; record the CORS result; select AC-7's path (Releases-direct vs Pages-branch mirror) and note the answer in the spec.
6. **Dry-run (PC-7):** a GH Actions workflow fetches synergy + build + counters for 2–3 champions (sequential, ≥2s, honest UA), deserializes, emits normalized shards as a workflow artifact. Success from GH's actual egress IP class settles D5's replication gap.
**DoD:** closes **AC-8, AC-9, AC-10**; PC-6 answered; PC-7 done — which *is* M1 done.
**Pre-committed failure branches:** dry-run blocked from GH IPs → D5's documented reversal (residential-context runner, same ≤2-per-cycle cadence); only M2's host changes, nothing else in this plan does. PC-6 fails → AC-7's pre-written fallback (current-patch shards mirrored to the Pages branch; Releases remain the archive); only M5's fetch path changes.

### M2 — Full pipeline (`apps/pipeline`)
Trigger logic: daily version check vs DDragon manifest; full scrape on patch change + one day-7 refresh, **≤2 per patch cycle enforced in code** (AC-5's "trigger logic, not promises"); champion list derived from the manifest each run; resume-from-local-cache idempotence; all-champion scrape → shrinkage-ready shards (per champion-role) → GitHub Release tagged by patch (+ Pages mirror if PC-6 chose the fallback).
**Cross-lane data (Gap B amendment):** the scrape explicitly includes `?vslane=` counter variants — for each champion, matchup tables against each opposing lane it can plausibly face off-role (viable-lane set derived from Data Dragon role tags ∪ lolalytics lane availability) — so AC-3's flex scoring has real cross-lane cells in the shards. Without this task M5 would "close" AC-3 by table position while silently serving same-lane data for off-role picks.
**DoD:** closes **AC-4, AC-5, AC-6, AC-7**, and **lands AC-3's data dependency** (cross-lane tables present and non-empty in shards, spot-checked for a known flex pick). Exit demo: one full production run against the live patch, published, frontend-fetchable.
**Depends on:** M1.

### M3 — Scoring engine (`packages/core`) — runs in parallel with M2 against M1's fixtures
Logit-space composition (baseline, lane matchup, ally synergy d1/d2, enemy-side counterpart terms); per-source shrinkage constants as named, doc-commented values; `PickScore` with per-component contributions + min-sample-size confidence; pure functions, property tests (monotone in matchup WR; low-n convergence to baseline).
**Lane-aware signature (Gap B amendment — AC-3's engine-side half):** the scoring API takes the opponent's assigned lane as an explicit parameter and selects same-lane vs cross-lane (vslane) matchup cells accordingly; it never silently substitutes same-lane data for an off-role assignment.
**OI-3 resolves here, at the entry gate:** verify d1/d2 semantics against the site's published definitions *before* they enter the composite — they are percentage-point deltas until proven otherwise, never logit addends by assumption (the register's OI-3 exhibit is the cautionary case).
**OI-4 resolves here, at the exit gate:** sensitivity sweep k ∈ {10, 25, 50} per source over one full patch's data → set k_matchup, k_synergy. Stability metric (survived review — it measures ranking sensitivity to k, not accuracy, which is correct while calibration is v2): top-5 pick-ordering agreement across k values over a fixed benchmark of 20 synthetic drafts; constants chosen at the plateau. **No-plateau fallback (review-added):** if no clear plateau emerges, default both constants to k=50, document the non-resolution, and record it as a v2 calibration-feature dependency — do not block M3 on a metric that may not resolve cleanly.
**DoD:** closes **AC-11, AC-12, AC-13, AC-14**; OI-3 and OI-4 resolved. Note the sweep's data need: development proceeds on fixtures immediately after M1, but the OI-4 exit gate needs M2's first full dataset — M3 *finishes* after M2 even though it *starts* beside it.

### M4 — Phase analysis — parallel with M2/M3 against fixtures
Bucket-index grouping (early 1–2 / mid 3–4 / late 5–7) behind a single mapping constant; per-phase WR with the same shrinkage discipline; below-floor buckets render "insufficient data."
**OI-1 resolves here, where it's cheapest:** one browser session comparing payload buckets to the site's rendered graph → minute boundaries verified or labels stay relative.
**AC-16b gate:** semantics sanity check against known scaling profiles (hyperscaler rising bucket WR, lane bully falling) before any phase output reaches UI code.
**DoD:** closes **AC-15, AC-16, AC-16b**; OI-1 resolved either way (labels unlocked, or explicitly kept relative with the register noting why).

### M5 — Frontend (`apps/web`): draft board + honest-uncertainty UI
`DraftStateProvider` interface with `ManualProvider` as sole implementation; 10-slot role-assigned board with DDragon name search; shard prefetch on board-appearance; flex handling consuming vslane data when lane ≠ opponent lane; tiers + rounded value + n on every number; stale-patch banner from client-side manifest check; "what this can't tell you" disclosure including the phase-semantics conditional. Shard fetch path per PC-6's recorded answer. First task: **measure real shard sizes** (brainstorm §9.3's never-answered question) — if >150KB/shard, revisit sharding granularity in M2 (cheap; rebuilds are wholesale).
**DoD:** closes **AC-1, AC-2, AC-3, AC-17, AC-18, AC-19.** Exit demo: deployed to Pages, a full draft scored against the M2-published live dataset.
**Depends on:** M2 (real shards), M3 + M4 (something to render), M1's PC-6 answer.

### M6 — Team-aware itemization + v1 wrap
Rule layer over the stats build: anti-heal (≥2 healers), MR/armor skew (AP/AD counts), anti-shield, tenacity (CC count) — rules as JSON carrying trigger-explanation strings; thresholds from DDragon tags + small curated table.
**DoD:** closes **AC-20.** v1 acceptance sweep: every AC re-verified against the deployed tool; operator decides OI-2 (license) at tag time; PC-5 confirmed done (due here; PC-2r/PC-3 were due at M2's close per the resequencing).

## 2. Sequencing

```
M0 ─► M1 ─►─ M2 ────────►─ M5 ─► M6
        └►─ M3 (starts on fixtures; OI-4 exit gate needs M2 data) ─►┘
        └►─ M4 (starts on fixtures; full-data check after M2) ──►┘
Operator-parallel: PC-2r, PC-3 (due by M2 close); PC-5 (due by M6)
```

## 3. AC coverage table (21/21 — the plan-bug check)

| Milestone | ACs closed | PC/OI resolved |
|---|---|---|
| M0 | *none (declared)* | — (hosts operator-parallel PC-2r/PC-3/PC-5) |
| M1 | AC-8, AC-9, AC-10 | PC-6, PC-7 (≡ M1) |
| M2 | AC-4, AC-5, AC-6, AC-7 | — |
| M3 | AC-11, AC-12, AC-13, AC-14 | OI-3 (entry), OI-4 (exit) |
| M4 | AC-15, AC-16, AC-16b | OI-1 |
| M5 | AC-1, AC-2, AC-3†, AC-17, AC-18, AC-19 | — |
| M6 | AC-20 | OI-2 (operator) |

† AC-3 closes in M5 (UI consumption) but is load-bearing across three milestones: M2 fetches the cross-lane cells, M3's API selects them by opponent lane, M5 renders them (Gap B amendment). Table position alone would hide that dependency chain — hence this note.

## 4. Risks for the reviewer to attack

1. **Fixture-representativeness bet.** M3/M4 develop against M1's fixtures while M2 is still building; if payload shape drifts between fixture capture and M2's first full run, M3/M4 rework. Mitigation already structural: the weekly drift canary starts the moment M1 lands, and fixtures are ≤ days old at M3/M4 start.
2. **OI-4's stability metric is a proposal, not a decision.** Top-5 ordering agreement over 20 benchmark drafts is defensible but arbitrary in size and construction; if the reviewer wants a different metric (rank correlation, larger benchmark), now is the cheap moment.
3. **M5 is the widest milestone** (6 ACs, all UI). If it drags, the honest split is board+scoring display (AC-1/2/3/17) then banner+disclosure (AC-18/19) — noted so a future split is a plan amendment, not scope drift.
4. **Author-executes-own-plan** is accepted by coordination decision; the control is this review plus the per-milestone AC verification being mechanical (the ACs are written to be checkable, not vibes).
