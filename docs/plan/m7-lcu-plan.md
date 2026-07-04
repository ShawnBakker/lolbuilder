# Plan — M7: LCU Provider & Local Helper

**Phase:** /plan (follows M7 spec as revised + fact-checked, all three PCs closed)
**Inputs:** `docs/spec/m7-lcu-spec.md` (revised, Pass A + Pass A-lite complete), PC-M7-1/2/3 findings
**Status:** Draft for review — CC in-repo verification, then implement. Phase gate: no M7 code until this passes review by a context that did not write it.

## 0. Ground rules

- Plan is a mapping from milestones to spec ACs. Every AC (AC-M7-1 … AC-M7-15, incl. AC-M7-1b/2b) is claimed by exactly one milestone; an unclaimed AC is a plan bug. Coverage table in §4.
- A milestone's DoD = its claimed ACs demonstrably satisfied + its named OI items resolved.
- Hard lines (read-only, advisory-only, approved-endpoints, local-only, token-never-logged) apply throughout, not restated per task.
- **All three empirical gates are already closed** (PC-M7-1 PNA-pass, PC-M7-2 league-connect-works-or-hand-roll, PC-M7-3 payload-observed). Unlike v1's M1, M7 opens with its unknowns already resolved — the plan is execution against known facts, not discovery.

## 1. Design questions resolved (both settled here, per the "well-specified → decide in /plan, not Pass B" call)

### AC-M7-2b — override/live-update reconciliation: **RESOLVED — sticky-until-champion-changes.**
A user's manual role-correction on an enemy slot persists through subsequent LCU updates **until that slot's champion actually changes** (hover flicker or a genuine re-pick), at which point the override clears because it now describes a different champion.
**Why this and not the alternatives:** PC-M7-3 observed enemy hovers flickering in real time (Thresh→Nautilus, Singed→Sion→Singed). Two rejected options: (a) *overrides always clobbered by LCU* — would erase a correct human fix every 2s poll, unusable; (b) *overrides permanent* — would keep a stale role after the enemy genuinely swapped to a different champion needing different inference. Sticky-until-champion-changes is the only model that survives the flicker behavior the probe actually observed. The keying is on **(slot, championId)** — override is valid only while that pair holds.

### Board-source abstraction shape: **RESOLVED — lift the seven concrete call sites into the provider contract.**
PC-A-lite enumerated seven call sites across five methods (`version()` :13, `slots()` :50/:127, `assign()` :80/:155, `nextEmpty()` :85, `setLane()` :138) plus a module-level singleton. The abstraction lifts exactly these five methods into a `BoardSource` contract both `ManualProvider` and `LcuProvider` satisfy; the singleton becomes a selected-provider reference. Scope is bounded to those seven sites — /plan mandates a **multiline-aware** re-count at implementation start (the :127 site was a single-line-grep miss; do not trust a grep that can't see `provider\n  .slots()`).

## 2. Milestones

### M7.0 — Lanes-prior shard field (data prerequisite, M6a-family)
The one piece of data AC-M7-7 needs that doesn't exist yet. Per-lane pick distribution (`lanes` field, fixture-verified present in the counters payload: Aatrox 78.9/18.4/1.8/0.1/0.7) → new extractor + shard field + zero-request cache re-emit.
- **Closes:** the data dependency under AC-M7-7 (not the AC itself — that's M7.3).
- **DoD:** every shard carries `lanes` (per-role pick share); re-emit is zero-live-request (cache hits only, like M6a's builds/damage additions); extractor has fail-loud invariants + a fixture test.
- **Why first:** M7.3's inference can't be built or tested without it, and it's the cheapest milestone (known pattern, no new scraping). Opens M7 the way M1's fixtures opened v1.

### M7.1 — Board-source abstraction (the bounded app change)
The retracted-"no app change" correction, made real. Lift the seven call sites into `BoardSource`; `ManualProvider` implements it unchanged in behavior; the board consumes `BoardSource` instead of the concrete singleton.
- **Closes:** AC-M7-1, AC-M7-1b.
- **DoD:** multiline-aware re-count confirms the site list (seven, or a corrected number stated with evidence); board renders identically under `ManualProvider` through the new abstraction; **v1's existing web tests still green** (this refactors shipped code — the regression surface from the M5 store-rewrite lesson applies; rerun AC-1/AC-2's suites, not just new ones).
- **Depends on:** nothing (pure refactor of existing code). Can run parallel to M7.0.

### M7.2 — Local helper: connect, read, re-serve
The LCU client. lockfile → auth → `/lol-champ-select/v1/session` read → re-serve on `127.0.0.1:27437` with CORS + PNA header.
- **league-connect vs hand-roll:** PC-M7-2 proved both work. **Decision: hand-roll the ~50-line client.** Rationale — a 2-year-stale RC as a load-bearing dependency violates the project's own PC-3 liveness standard even though it currently works; the protocol surface is ~50 lines we fully understand; zero dependency-drift risk on a component running on friends' machines where we can't push fixes easily. league-connect stays a reference, not a dependency. (This is the free choice PC-M7-2 unlocked, decided toward the project's dependency-minimalism habit.)
- **Closes:** AC-M7-3 (read-only, grep-invariant), AC-M7-6 (fail-loud on unrecognized payload shape — the helper-side half; the fall-back-to-manual half is exercised under AC-M7-9 in M7.4), AC-M7-4 (CORS + **PNA preflight header** — load-bearing per PC-M7-1's server log), AC-M7-5 (lockfile default path + config override), AC-M7-11 (token redactor — mechanism already proven live across 19 snapshots; port it in as the single sanitizing formatter all output routes through), AC-M7-12 (local-only).
- **DoD:** helper connects to live client, re-serves champ-select JSON to the Pages origin through the PNA gate, redactor test injects a sentinel token into every failure path and asserts absence; read-only grep-invariant holds (zero write methods to any LCU endpoint).
- **Depends on:** nothing external. The PC-M7-3 probe is the reference implementation for the read half.

### M7.3 — Enemy-role inference (enemies-only, priors-load-bearing)
PC-M7-3 settled the shape: enemy champions exposed on lock, **positions absent (0/5)**, allies arrive with roles complete. So inference is **enemies-only** and leans entirely on the M7.0 lanes-priors (no LCU position signal to lean on).
- **Closes:** AC-M7-7 (inference from priors + threshold), AC-M7-8 (inferred roles visibly marked + one-action correctable), AC-M7-2b (reconciliation — sticky-until-champion-changes, §1).
- **DoD:** inference assigns enemy roles from `lanes` priors above the OI-M7-1 threshold, leaves ambiguous ones blank; every inferred role renders visibly-as-inferred (not certain); drag-correction works and survives poll updates per the sticky model; a wrong inference is never silently consumed by the vslane selection — it's visible and fixable first.
- **Depends on:** M7.0 (priors), M7.2 (a source of enemy champions to infer from).

### M7.4 — LcuProvider + graceful degradation + version handshake
Wire it together: `LcuProvider` implements `BoardSource`, polls the helper (2s — PC-M7-3 showed 2s polling caught every transition incl. hover flickers, so **polling, not websocket**, per OI-M7-2 resolved), populates the board, degrades to manual when the helper is absent.
- **Closes:** AC-M7-2 (explicit user-visible provider selection), AC-M7-9 (graceful degradation — helper absent/erroring/not-in-champ-select → manual, stated plainly, never hangs, never stale-implied-live), AC-M7-10 (connection state always legible), AC-M7-14 (helper↔app version handshake — mismatch surfaced, not silently tolerated).
- **DoD:** with helper running + a live champ-select, the board auto-populates enemy champions (+ inferred roles from M7.3, + ally roles direct); with helper absent, the app is exactly v1's manual board with a plain "not connected" state; version mismatch shows an explained banner, not a malfunction.
- **Depends on:** M7.1 (BoardSource), M7.2 (helper), M7.3 (inference).

### M7.5 — Distribution & install story + seam stubs + wrap
- **Closes:** AC-M7-13 (honest install-story doc — what SmartScreen/AV shows, what to click, plain-language what-it-does-and-doesn't), AC-M7-15 (seam stubs: matchup-conditioned build fetch via vs-route, calibration local-log — clearly-marked unimplemented, so the next milestones don't re-architect the helper).
- **DoD:** a non-technical friend can follow the install doc without a Discord debugging session; both seams exist as marked TODOs with the interface shape sketched, zero feature behind either; M7 acceptance sweep re-verifies every AC against the running system.
- **OI-M7-3** (packaging: npx / batch / installer) resolves here — pick the least-friction option that isn't a debugging session; likely a run script + the install doc for v-next, Tauri deferred.

## 3. Sequencing

```
M7.0 (lanes prior) ──┐
                     ├─► M7.3 (inference) ──┐
M7.2 (helper) ───────┘                      ├─► M7.4 (provider + degrade) ─► M7.5 (wrap)
M7.1 (board-source) ────────────────────────┘
```
M7.0, M7.1, M7.2 all open immediately (no cross-deps). M7.3 needs M7.0+M7.2. M7.4 needs M7.1+M7.2+M7.3. M7.5 last.

## 4. AC coverage (15 ACs + 1b/2b = 17 — the plan-bug check)

| Milestone | ACs closed |
|---|---|
| M7.0 | (AC-M7-7 data dependency — AC itself closes in M7.3) |
| M7.1 | AC-M7-1, AC-M7-1b |
| M7.2 | AC-M7-3, AC-M7-4, AC-M7-5, AC-M7-6, AC-M7-11, AC-M7-12 |
| M7.3 | AC-M7-7, AC-M7-8, AC-M7-2b |
| M7.4 | AC-M7-2, AC-M7-9, AC-M7-10, AC-M7-14 |
| M7.5 | AC-M7-13, AC-M7-15 |

All 17 claimed. OI-M7-1 (threshold) resolves in M7.3; OI-M7-2 (poll vs ws) **already resolved → polling**; OI-M7-3 (packaging) resolves in M7.5.

## 5. Risks for the reviewer to attack

1. **M7.1 is a refactor of shipped, working v1 code** — the same regression class as the M5 store-rewrite (green CI on suites that don't touch the changed plumbing). Mitigation: the DoD explicitly requires rerunning AC-1/AC-2's existing suites, not just new tests, and the multiline-aware re-count before touching the sites.
2. **Hover data is a capability the spec didn't plan for** (enemy pre-lock hovers visible in uncompleted actions). It's tempting to build "enemy is hovering X" into M7.4. **Recommend NOT** in this milestone — it's genuine new scope (a hover is not a lock; players fake/switch; it needs its own visibly-marked-as-hover honesty treatment). Log it as a post-M7 candidate, don't let it expand M7.4. Flagging because it's the exact kind of appealing-adjacent-feature that causes scope creep.
3. **Hand-roll decision (M7.2)** trades a working-but-stale dependency for ~50 lines we own. If the hand-roll hits an LCU auth edge case league-connect already handles, that's rework. Mitigation: league-connect remains the reference; if the hand-roll fights us, falling back to the (proven-working) dependency is a documented escape, not a restart.
4. **enemies-only inference leans 100% on lanes-priors** (no LCU position signal). If a champion's `lanes` distribution is genuinely ambiguous (true flex, ~50/50 two roles), inference leaves it blank and the user assigns — which is correct behavior, but means flex-heavy enemy comps get more manual assignment. Not a bug; a known characteristic to state in the install doc so it's not surprising.

## 6. Process from here

```
[this plan] → CC in-repo review (verify the seven-site count with multiline search;
confirm M7.0's lanes field is really extractable as claimed; sanity the coverage table)
→ /implement M7.0–M7.5 in sequence → M7 acceptance sweep → M7 tag
```
Phase gate holds: no implementation until this plan passes a review that didn't write it.

---

# In-repo review (CC, 2026-07-04)

The three requested verifications, plus one coverage bug found and fixed inline (attributed here, contest if wrong):

1. **Seven-site count: CONFIRMED fresh** with a multiline-aware search —
   7 total: `version()`×1, `slots()`×2, `assign()`×2, `nextEmpty()`×1,
   `setLane()`×1. Matches §1's enumeration exactly.

2. **M7.0 lanes extractability: CONFIRMED, three payloads.** Exactly one
   `lanes` host per counters payload (clean exactly-one invariant, M6a
   pattern); values sum to ~99.9; internally consistent across the vslane
   variant (same champion → identical distribution); second champion
   sanity-checks against reality (Kha'Zix: 99.3% jungle). The extractor is
   as cheap as the plan claims.

3. **Coverage table: WAS a plan bug — AC-M7-6 was claimed by no milestone**
   (rows summed to 16/17 under the plan's own §0 rule). Fixed inline:
   assigned to M7.2 (payload-shape validation is helper code), with the
   fall-back-to-manual half exercised under AC-M7-9 in M7.4. Both the M7.2
   closes-list and the table row are amended above. All 17 now claimed.

Design resolutions reviewed against the recorded evidence (not re-opened):
sticky-until-champion-changes matches the observed hover flicker; polling
matches the probe's demonstrated 2s sufficiency; the hand-roll decision is
the free choice PC-M7-2 created, pointed at the project's own PC-3 liveness
standard — all three consistent with their cited evidence. Risk #2 (hover
scope creep) endorsed from this side too: hold that line.

**Verdict: plan passes in-repo review with the AC-M7-6 fix. /implement
opens on M7.0 (+ M7.1/M7.2 in parallel per §3).**
