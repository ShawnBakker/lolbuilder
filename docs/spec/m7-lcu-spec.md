# Spec — M7: LCU Provider & Local Helper

**Phase:** /spec (follows M7 brainstorm + PC-6 probe resolution, 2026-07-03)
**Inputs:** `docs/brainstorm/m7-lcu-brainstorm.md`, PC-6 probe result (below)
**Status:** Revised after Pass A (in-repo review) + Pass A-lite (revision check). Pass B (independent non-Claude design review) optional per operator — see §Review-notes.

## 0. PC-6 resolved (the gate that let this spec open)

**Result: PASS, both forms.** From `https://shawnbakker.github.io/lolbuilder/m7-probe.html` (Chrome 134, Win64), with the stub helper running: HTTP 200 + JSON from both `http://127.0.0.1:27437` (136ms) and `http://localhost:27437` (434ms). No mixed-content block, no private-network-access block. The first probe attempt returned `ERR_CONNECTION_REFUSED` — diagnosed as helper-not-running, not policy; re-run with the helper up passed cleanly. Server-side corroboration (stub log): Chrome sent the private-network preflight for both URL forms and proceeded only after `Access-Control-Allow-Private-Network: true` — the pass went *through* the PNA gate, not around it.

**Consequence:** the cheap architecture is viable — **hosted https Pages frontend + local http helper, connected via CORS + PNA preflight.** The helper does NOT need to serve the frontend; Tauri does NOT need to move up. This is the load-bearing architectural fact the rest of the spec rests on.

**Two caveats carried forward (design them in, don't rediscover them):**
- **One-browser evidence.** Chrome 134 on the developer's machine. Chrome's Private-Network-Access enforcement tightens across versions; Firefox/Safari differ. Validated for the likely-dominant browser of the friend group; a friend on another browser is an untested surface. AC-M7-9 covers graceful failure so an unsupported browser degrades to manual, not breakage.
- **`127.0.0.1` preferred over `localhost`** — the single probe run showed `127.0.0.1` resolving faster (likely `localhost` DNS; one sample, not a benchmark) and it avoids IPv4/IPv6 ambiguity. Canonical address `127.0.0.1`, `localhost` fallback only.

## 1. Scope

Add an `LcuProvider` implementation of the existing `DraftStateProvider` interface plus a local helper process that reads League champ-select state and re-serves it to the hosted frontend, **plus a bounded board-source abstraction in the app (AC-M7-1b — Pass A finding)**. Auto-populates the draft board from a live game; falls back cleanly to manual entry whenever the helper is absent, the client isn't running, or anything is uncertain.

**Non-goals (M7):**
- No Tauri packaging (destination decided, not built this milestone — §Bridge).
- No writes to any Riot surface, ever (hard line, §7 brainstorm).
- No matchup-conditioned build *feature* — M7 makes it *possible* (helper can fetch the vs-route with no browser CORS constraint), but building it is a separate milestone. M7 may stub the seam.
- No calibration feature — M7 may stub the local-log seam, nothing more.
- No account/summoner data. Champ-select session reads only.

## 2. Architecture (locked by PC-6; premise block corrected by Pass A)

```
League Client (local, unsupported LCU API)
   │  lockfile auth, self-signed cert, random port
   ▼
Local helper (Node — league-connect IF verified live, else hand-rolled; PC-M7-2)
   │  reads /lol-champ-select/v1/session
   │  re-serves on http://127.0.0.1:27437 — CORS for the Pages origin + PNA preflight
   ▼
Hosted frontend (https GitHub Pages; app change bounded to AC-M7-1b)
   │  new LcuProvider + board-source abstraction; scoring consumes DraftState as-is
   ▼
Existing scoring + vslane (Gap B) — unchanged, already consumes per-enemy roles
```

**Premise state after Pass A (verified against code, 2026-07-03):** the `DraftStateProvider` interface exists exactly as `{getDraftState(), subscribe()}` with `ManualProvider` as sole implementation ✓; vslane role-consumption works end-to-end ✓; the *scoring path* consumes `DraftState` agnostically ✓; the *board UI* is coupled to concrete `ManualProvider` methods (see AC-M7-1) — the original "app doesn't change" premise was half-false and is retracted.

## 3. The bridge decision (locked)

**Node helper this milestone (LCU client via `league-connect` *if verified against the live LCU*, else hand-rolled ~50-line client — PC-M7-2). Tauri is the named destination, not built now.** Rationale carried from brainstorm §3: build the disposable proof-of-flow first, de-risk LCU + role-inference without a packaging pipeline, upgrade to Tauri only if sustained use earns it. Electron rejected. **Do not build both; do not skip to Tauri.**

## 4. Features & acceptance criteria

### F-M7-1 — LcuProvider
- **AC-M7-1 (CORRECTED by Pass A):** `LcuProvider` implements `DraftStateProvider` without changing the *interface*. The "no app change" claim in the original draft was **half-false and is retracted**: the scoring path is provider-agnostic (touches only `getDraftState()`), but the **board UI is coupled to concrete `ManualProvider` methods at seven call sites across five non-interface methods** — `version()` (App.tsx:13), `slots()` (:50, :127), `assign()` (:80, :155), `nextEmpty()` (:85), `setLane()` (:138) — plus a module-level singleton. Therefore M7 **necessarily includes a bounded app change**: a board-source abstraction so the board can be driven by either provider. Real work, named here, not assumed away. *(Count corrected six→seven in Pass A-lite: the `slots()` call at :127 is split across lines and single-line greps miss it — enumerate from this list in /plan, and count with a multiline-aware search.)*
- **AC-M7-1b (NEW):** The board-source abstraction lifts the five concrete methods the board depends on into a contract both providers satisfy. Scope bounded to the seven call sites enumerated in AC-M7-1; /plan carries the enumeration so the change cannot sprawl.
- **AC-M7-2:** Provider selection (manual vs LCU) is explicit and user-visible — the user always knows which mode they're in; the app never silently switches.
- **AC-M7-2b (NEW — reconciliation, routed to Pass B or /plan):** Because AC-M7-8 lets the user drag-correct an inferred role and the LCU pushes live updates, the provider must define what happens to a user override when the next websocket event arrives — does it survive or get clobbered? Pass A surfaced this; it is not resolved here. Proposal for review (not a decision): overrides are sticky per-slot until that slot's champion actually changes in champ-select, at which point the override clears because it is now a different pick.

### F-M7-2 — Local helper (Node)
- **AC-M7-3:** Helper reads `/lol-champ-select/v1/session` read-only; makes zero writes to any Riot endpoint (grep-able invariant, testable).
- **AC-M7-4 (HARDENED by Pass A evidence):** Helper re-serves champ-select state on `http://127.0.0.1:27437` with CORS scoped to the Pages origin (`localhost` fallback) **and must answer the Chrome private-network preflight with `Access-Control-Allow-Private-Network: true`.** Pass A's stub log confirmed Chrome sent the PNA preflight for both URL forms and proceeded only after that header — PC-6 passed *through* the PNA gate, not around it. Load-bearing, not optional.
- **AC-M7-5:** Helper resolves the lockfile from the default Windows install path, with a config override for non-default installs — no code change required to point at a different install. (§5 lockfile bullet.)
- **AC-M7-6:** On champ-select payload shape it doesn't recognize (LCU version drift), the helper fails loudly and the provider falls back to manual — never feeds unrecognized/garbage data to the board. (Same fail-loud discipline as the qdata deserializer; named invariant.)

### F-M7-3 — Enemy-role inference
- **AC-M7-7 (CORRECTED by Pass A):** Enemy roles are inferred from champion-role priors plus any LCU position hints; a confidence threshold (named constant, tunable — OI-M7-1) decides auto-assign vs. leave-blank. **Data-premise correction:** shards do NOT currently carry per-lane pick distributions — only default-lane `pr`. The source has the needed shape (counters payload `lanes` field, fixture-verified: Aatrox 78.9/18.4/1.8/0.1/0.7), so this is a **named work item**: small extractor + new shard field + zero-request cache re-emit (M6a pattern). AC-M7-7 depends on that shard-field addition landing first.
- **AC-M7-8:** Every inferred role is **visibly marked as inferred** in the UI (not presented as certain) and correctable in one action. A wrong inference must never silently select the wrong vslane table without the user being able to see and fix it. (The project's core honesty standard, applied here.)

### F-M7-4 — Graceful degradation (the new-class requirement)
- **AC-M7-9:** When the helper is absent/unreachable/erroring, or the client isn't in champ-select, the app degrades to manual entry, states plainly that it's not connected, and never hangs, never shows stale champ-select data, never implies a connection that isn't live. (Mirrors the stale-banner "quiet when unverifiable" instinct.)
- **AC-M7-10:** Connection state is always legible — the user can tell at a glance whether they're seeing live champ-select data or manual/stale state.

### F-M7-5 — Security & privacy of the helper (elevated to AC, per CC addendum)
- **AC-M7-11 (TEST MECHANISM NAMED, per Pass A):** The lockfile token never appears in any log, diagnostic, error, or copy-pasteable support output. Genuinely testable only if **all helper diagnostics route through one sanitizing formatter**; then a test injects a sentinel token into every failure path and asserts redaction. Without that centralization it is an unenforceable promise. So the AC is: (a) all diagnostic output flows through one sanitizer redacting anything matching the lockfile-token shape; (b) a test injects a sentinel into each failure path and asserts absence. The mechanism is the AC.
- **AC-M7-12:** The helper is local-only — connects to the League client and the Pages frontend, phones nothing home, persists nothing off-machine. (Except the explicitly-scoped calibration log seam, F-M7-7, if stubbed.)
- **AC-M7-13:** An honest install-story doc ships with the helper: what security software will show, what to click, and a plain-language "what this does and does not do" (read-only, local-only, no account access) a non-technical friend can read and accept.

### F-M7-6 — Helper↔app version handshake (per CC addendum)
- **AC-M7-14:** Helper and frontend exchange a version identifier on connect; a mismatch is surfaced (not silently tolerated), because three artifacts now update on different cadences on different machines (Pages frontend auto-updates; the friend's local helper does not). A stale helper against a newer frontend must be a visible, explained state — not a mysterious malfunction.

### F-M7-7 — Seam stubs (no features, just don't wall them off)
- **AC-M7-15:** The helper leaves a clearly-marked, unimplemented seam for (a) matchup-conditioned build fetch via the vs-route (no browser CORS constraint from the helper) and (b) the calibration local-log. Stubs only — building either is out of M7 scope. This exists so the next milestones don't require re-architecting the helper.

## 5. Open items

- **OI-M7-1:** Role-inference confidence threshold — the prior at which inference auto-assigns vs. leaves blank. Set a default in /plan; tune with real champ-select observation.
- **OI-M7-2:** Poll vs. websocket for the helper↔LCU connection. Brainstorm §8 leaned websocket (real-time, cleaner); polling is simpler. Decide in /plan; the champ-select-speed argument (≈30s windows) favors websocket but polling at 1-2s may suffice.
- **OI-M7-3:** Helper packaging for non-technical friends — `npx`, batch script, tiny installer. The least-friction option that isn't a Discord debugging session. Likely /plan-time, possibly its own small milestone.

## 6. Pre-implementation checklist (gates /plan sign-off)

- **PC-M7-1:** ✅ DONE — mixed-content/PNA probe passed (PC-6 above).
- **PC-M7-2:** ✅ RESOLVED (2026-07-04, live probe): the stale `league-connect` RC **works against the live client** (authenticate + requests), and the hand-rolled ~50-line control worked in the same run — /plan's choice is free preference, not necessity. Evidence: `docs/analysis/pc-m7-3-findings.md`.
- **PC-M7-3:** ✅ RESOLVED (2026-07-04, real Normal Draft, 19-snapshot capture): enemy champions ARE exposed (5/5, progressively on lock, via `theirTeam` + completed enemy actions); enemy position hints are ABSENT (0/5 the whole draft, allies 5/5) — **champion-role priors are load-bearing for inference, with no LCU fallback**. Bonus findings (enemy pre-lock hovers visible via uncompleted actions; bans live in `actions` not `session.bans`; ally side arrives complete with roles): `docs/analysis/pc-m7-3-findings.md`. AC-M7-7's lanes-distribution shard field is confirmed prerequisite work.

## 7. Hard lines (inherited, non-negotiable)

Read-only. Advisory-only. Approved endpoints only. Local-only. All four carried verbatim from brainstorm §7 and reinforced by the PC-5 policy amendment. No M7 code relaxes any of these.

## Review-notes (the two-pass intent, and where each stands)

- **Pass A — CC/Fable, in-repo: ✅ COMPLETE.** Five corrections, all folded above: AC-M7-1 scope (board coupling), AC-M7-7 data premise (lanes field not yet in shards), PC-M7-2 (league-connect stale), AC-M7-4 (PNA preflight load-bearing), AC-M7-11 (test mechanism). Two design questions raised: AC-M7-2b (reconciliation) and the board-source abstraction's shape. Confirmed clean: seam exists as typed, ManualProvider sole impl, vslane real end-to-end, PC-6 corroborated by server log, PC-M7-3 correctly unverifiable-from-repo.
- **Pass A-lite (revision check, CC): ✅ COMPLETE.** Two corrections to the revision itself: the call-site count is **seven**, not six (the `slots()` call at App.tsx:127 splits across lines; single-line greps miss it — both the original finding and the revision inherited the undercount), and §2's diagram/premise block still carried the retracted "unchanged app" claim — both fixed in this document. All other revisions verified faithful to the Pass A evidence (fixture numbers, npm dates, log contents match).
- **Pass B — independent non-Claude reviewer (design/framing), OPTIONAL per operator:** pressure-test the reasoning — the bridge decision, the role-inference honesty gate, the graceful-degradation model, the security AC set, and especially AC-M7-2b's reconciliation proposal. This is where same-model-family review is weakest. Give it *only* this spec + the brainstorm, no adjacent contamination (D16).
