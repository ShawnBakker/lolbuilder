# Spec — M7: LCU Provider & Local Helper

**Phase:** /spec (follows M7 brainstorm + PC-6 probe resolution, 2026-07-03)
**Inputs:** `docs/brainstorm/m7-lcu-brainstorm.md`, PC-6 probe result (below)
**Status:** Draft for review. **Two review passes intended, doing different jobs:** (A) CC/Fable in-repo — verify every "already exists / already works" claim against real code, run any implied checks; (B) an independent non-Claude reviewer — pressure-test the design reasoning and framing, where same-model-family review is weakest. See §Review-notes.

## 0. PC-6 resolved (the gate that let this spec open)

**Result: PASS, both forms.** From `https://shawnbakker.github.io/lolbuilder/m7-probe.html` (Chrome 134, Win64), with the stub helper running: HTTP 200 + JSON from both `http://127.0.0.1:27437` (136ms) and `http://localhost:27437` (434ms). No mixed-content block, no private-network-access block. The first probe attempt returned `ERR_CONNECTION_REFUSED` — diagnosed as helper-not-running, not policy; re-run with the helper up passed cleanly.

**Consequence:** the cheap architecture is viable — **hosted https Pages frontend + local http helper, connected via CORS.** The helper does NOT need to serve the frontend; Tauri does NOT need to move up. This is the load-bearing architectural fact the rest of the spec rests on.

**Two caveats carried forward (design them in, don't rediscover them):**
- **One-browser evidence.** Chrome 134 on the developer's machine. Chrome's Private-Network-Access enforcement tightens across versions; Firefox/Safari differ. Validated for the likely-dominant browser of the friend group; a friend on another browser is an untested surface. AC-M7-9 covers graceful failure so an unsupported browser degrades to manual, not breakage.
- **`127.0.0.1` preferred over `localhost`** — 3x faster in the probe (DNS resolution of `localhost`), and avoids IPv4/IPv6 resolution ambiguity. The helper and frontend should use `127.0.0.1` as the canonical address, `localhost` as a fallback only.

## 1. Scope

Add an `LcuProvider` implementation of the existing `DraftStateProvider` interface plus a local helper process that reads League champ-select state and re-serves it to the hosted frontend. Auto-populates the draft board from a live game; falls back cleanly to manual entry whenever the helper is absent, the client isn't running, or anything is uncertain.

**Non-goals (M7):**
- No Tauri packaging (destination decided, not built this milestone — §Bridge).
- No writes to any Riot surface, ever (hard line, §7 brainstorm).
- No matchup-conditioned build *feature* — M7 makes it *possible* (helper can fetch the vs-route with no browser CORS constraint), but building it is a separate milestone. M7 may stub the seam.
- No calibration feature — M7 may stub the local-log seam, nothing more.
- No account/summoner data. Champ-select session reads only.

## 2. Architecture (locked by PC-6)

```
League Client (local, unsupported LCU API)
   │  lockfile auth, self-signed cert, random port
   ▼
Local helper (Node, league-connect)  ── reads /lol-champ-select/v1/session
   │  re-serves on http://127.0.0.1:27437 with CORS for the Pages origin
   ▼
Hosted frontend (https GitHub Pages, unchanged app)
   │  new LcuProvider polls/subscribes the helper; existing board consumes DraftState
   ▼
Existing scoring + vslane (Gap B) — unchanged, already consumes per-enemy roles
```

**Empirically grounded (CC verify against repo):** the `DraftStateProvider` seam exists with `ManualProvider` as sole implementation; vslane role-consumption works end-to-end; the app consumes `DraftState` without caring how it's produced. *If any of these is not literally true in the code, this spec's "app doesn't change" premise is wrong and needs revisiting — that's exactly what review pass A checks.*

## 3. The bridge decision (locked)

**Node helper via `league-connect`, this milestone. Tauri is the named destination but not built now.** Rationale carried from brainstorm §3: build the disposable proof-of-flow first, de-risk LCU + role-inference without a packaging pipeline, upgrade to Tauri only if sustained use earns it. Electron rejected. **Do not build both; do not skip to Tauri.**

## 4. Features & acceptance criteria

### F-M7-1 — LcuProvider
- **AC-M7-1:** `LcuProvider` implements `DraftStateProvider` with no change to the interface or to any app code that consumes `DraftState`. (Review A: verify the interface is real and unchanged.)
- **AC-M7-2:** Provider selection (manual vs LCU) is explicit and user-visible — the user always knows which mode they're in; the app never silently switches.

### F-M7-2 — Local helper (Node, league-connect)
- **AC-M7-3:** Helper reads `/lol-champ-select/v1/session` read-only; makes zero writes to any Riot endpoint (grep-able invariant, testable).
- **AC-M7-4:** Helper re-serves champ-select state on `http://127.0.0.1:27437` with CORS headers scoped to the Pages origin; `localhost` accepted as fallback.
- **AC-M7-5:** Helper resolves the lockfile from the default Windows install path, with a config override for non-default installs — no code change required to point at a different install. (§5 lockfile bullet.)
- **AC-M7-6:** On champ-select payload shape it doesn't recognize (LCU version drift), the helper fails loudly and the provider falls back to manual — never feeds unrecognized/garbage data to the board. (Same fail-loud discipline as the qdata deserializer; named invariant.)

### F-M7-3 — Enemy-role inference
- **AC-M7-7:** Enemy roles are inferred from champion-role priors (dataset `pr`-by-lane) plus any position hints the LCU exposes; a confidence threshold (named constant, tunable — OI-M7-1) decides auto-assign vs. leave-blank-for-manual.
- **AC-M7-8:** Every inferred role is **visibly marked as inferred** in the UI (not presented as certain) and correctable in one action. A wrong inference must never silently select the wrong vslane table without the user being able to see and fix it. (The project's core honesty standard, applied here.)

### F-M7-4 — Graceful degradation (the new-class requirement)
- **AC-M7-9:** When the helper is absent/unreachable/erroring, or the client isn't in champ-select, the app degrades to manual entry, states plainly that it's not connected, and never hangs, never shows stale champ-select data, never implies a connection that isn't live. (Mirrors the stale-banner "quiet when unverifiable" instinct.)
- **AC-M7-10:** Connection state is always legible — the user can tell at a glance whether they're seeing live champ-select data or manual/stale state.

### F-M7-5 — Security & privacy of the helper (elevated to AC, per CC addendum)
- **AC-M7-11:** The LCU lockfile token never appears in any log, diagnostic output, error message, or anything a user might copy-paste for support. (CC's addendum caught this: §5's paste-into-Discord support reality means a naive error dump could leak the auth credential. Testable: assert no diagnostic path emits the token.)
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
- **PC-M7-2:** Confirm `league-connect` (or equivalent) is current and maintained for the LCU version live in mid-2026 — same "is the dependency alive" check that resolved PC-3 for u.gg. (Review A / a quick check.)
- **PC-M7-3:** Confirm the LCU champ-select session payload actually exposes what AC-M7-7 assumes (enemy champions always; position hints sometimes). This is an empirical check against a real champ-select — the M7 analog of reading a real qdata payload before trusting its shape. Cannot be done from assumption; needs a live client.

## 7. Hard lines (inherited, non-negotiable)

Read-only. Advisory-only. Approved endpoints only. Local-only. All four carried verbatim from brainstorm §7 and reinforced by the PC-5 policy amendment. No M7 code relaxes any of these.

## Review-notes (the two-pass intent, stated so it's not skipped)

- **Pass A — CC/Fable, in-repo (empirical grounding):** verify every claim marked "already exists / already works / unchanged" against real code — the `DraftStateProvider` interface, `ManualProvider` as sole impl, vslane role consumption, the app-consumes-DraftState-agnostically premise. Run PC-M7-2. Flag any AC that assumes code behavior that isn't actually there. CC's value here is ground-truth access, not independent perspective — it authored the brainstorm, so it is *not* the independence check.
- **Pass B — independent non-Claude reviewer (design/framing):** pressure-test the reasoning — is the bridge decision sound, is the role-inference honesty gate sufficient, is the graceful-degradation model complete, does the security AC set actually cover the leak paths. This is where same-model-family review is weakest and an outside model earns its place, same as the pass that caught the d1/d2 logit error. Give it *only* this spec + the brainstorm, no adjacent contamination (D16).
```

---

# Pass A findings (CC, in-repo, 2026-07-03) — repo-accuracy review

Scope held to empirical grounding per §Review-notes: claims vs. code, plus
the two checkable PC items. Design judgments deferred to Pass B.

## Premise verification (§2's "CC verify against repo" block)

1. **`DraftStateProvider` seam exists, `ManualProvider` sole implementation — CONFIRMED.**
   `apps/web/src/provider.ts`: interface is exactly `{getDraftState(), subscribe()}`;
   one implementing class in the codebase.

2. **vslane role-consumption end-to-end — CONFIRMED.** `selectCells` reads
   `matchupsVsLane[enemy.lane]` with no same-lane substitution (tested), and
   two exit demos on production data exercised a real flex lookup.

3. **"The app consumes DraftState agnostically" — HALF-TRUE, and the false
   half matters.** The *scoring path* is agnostic (consumes `getDraftState()`
   only). The *board UI* is coupled to the concrete `ManualProvider` at six
   call sites across five methods that are NOT on the interface:
   `version()` (App.tsx:13), `slots()` (:50, :127), `assign()` (:80, :155),
   `nextEmpty()` (:85), `setLane()` (:138) — plus a module-level
   `new ManualProvider()` singleton. Consequences:
   - **AC-M7-1 as written is satisfiable only for the scoring path.** M7
     includes a bounded app change: provider selection (AC-M7-2 already
     implies it) plus a board-source abstraction, and the spec should say so
     instead of "the app does not change."
   - **AC-M7-8 hides a reconciliation model the spec doesn't name:**
     one-action role correction means `LcuProvider` must accept user
     mutations *layered over live LCU updates* (does a user override survive
     the next websocket event? what resets it?). That is a real design
     question — flagged here because the code makes it unavoidable, routed
     to Pass B / spec revision because it's judgment, not fact.

## AC/PC checks

4. **AC-M7-7's data premise is NOT in the dataset.** No shard, extractor, or
   type carries per-lane pick distribution; `baseline.pr`/`defaultLane` cover
   the default lane only. The *source* has exactly the needed shape — the
   counters payload's `lanes` field (verified in fixture: Aatrox
   `{top:78.9, jungle:18.4, middle:1.8, bottom:0.1, support:0.7}`) — so this
   is an M2-family addition (small extractor + shard field + near-free
   cache re-emit, same class as damage/builds), not a blocker. The spec must
   name it as a work item rather than assume the priors exist.

5. **PC-M7-2 FAILS as stated.** `league-connect` latest is `6.0.0-rc13`,
   last published **2024-06-03** — an RC, 2+ years stale by mid-2026. By the
   project's own PC-3 liveness standard, "current and maintained" is not
   true. Not necessarily fatal: the LCU protocol surface the helper needs is
   small (lockfile read → basic auth → https to localhost with a self-signed
   cert), so the honest options are (a) empirically verify the stale lib
   still works against the live client (part of PC-M7-3's live session), or
   (b) hand-roll the ~50-line protocol using it as a reference. §3's bridge
   wording should not assert a maintained dependency that isn't.

6. **AC-M7-4 is missing its load-bearing header.** Server-side probe log
   (stub, 2026-07-03): Chrome sent the private-network preflight
   (`Access-Control-Request-Private-Network: true`) for BOTH URL forms and
   proceeded only after the stub answered
   `Access-Control-Allow-Private-Network: true`. The PASS went *through*
   that gate, not around it. AC-M7-4 must require this preflight response
   explicitly, alongside the origin-scoped CORS it already names.

7. **AC-M7-11 is testable IFF the mechanism is named:** all helper
   logging/diagnostics must route through one sanitizing formatter; then a
   unit test injects a known token into every failure path and asserts no
   output contains it. Without centralized diagnostics the AC is a
   code-review promise, not a test. Recommend the AC name the mechanism.

8. **PC-M7-3 — correctly scoped; nothing in the repo can verify it.**
   Agreed it gates /plan trusting AC-M7-7's position-hint claims.

## Hygiene

9. §0's "3x faster" is one paired sample (136ms vs 434ms, single page load,
   plausibly first-resolution cost on `localhost`) — keep the 127.0.0.1
   preference, soften the ratio to what was observed once. Stray trailing
   code fences removed on landing.

**Net:** the architecture premise (PC-6) is solid and corroborated
server-side; the seam premise is true at the type level and half-true at the
app level; two spec corrections required before /plan (AC-M7-1 scope +
lanes-prior work item), one PC re-scoped (PC-M7-2 → verify-or-hand-roll),
one AC hardened (M7-4 PNA header), one AC given its test mechanism (M7-11).
