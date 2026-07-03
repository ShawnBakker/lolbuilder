# Brainstorm — M7: LCU Provider & Local Helper

**Phase:** /brainstorm (precedes M7 /spec)
**Date:** 2026-07-03
**Status:** Draft — proposals with reasoning, to be locked in /spec
**Builds on:** original brainstorm §8 (LCU seed), spec §F1 (provider seam), the PC-5 policy amendment (read-only/approved-endpoints, now reinforced by Riot's explicit clause)
**Why now:** dependency ordering, not just feature appeal — M7 upgrades the substrate F8 and calibration are designed against (bans arrive for free, calibration's local-log home appears, matchup-conditioned builds unblock). Every week it waits, the other two are designed against a worse foundation.

---

## 0. What v1 already put in place (so M7's scope is honest)

- `DraftStateProvider` interface exists; `ManualProvider` is its sole implementation. `LcuProvider` slots into the same contract — **the app does not change**, only a new provider is added.
- Enemy-role handling (vslane) already works end-to-end (Gap B). M7 feeds it *which* role each enemy is; the scoring already consumes that.
- Read-only / advisory-only / approved-endpoints are codified in CLAUDE.md and reinforced by the PC-5 amendment.
- Riot personal API key is registered and approved — the LCU-usage disclosure the client-API policy expects is satisfied.

So M7 is mostly about **the helper's shape and its distribution**, not the app. That's the frame.

## 1. The genuinely new problem this milestone introduces

Everything through M6b lived in infrastructure we control end-to-end: our repo, our Actions, our Pages deploy. **M7 is the first time code runs on someone else's machine** — a friend's Windows box, with their firewall, their antivirus, their "it's not working" with no logs we can see.

This is not a footnote. It's a new failure-mode class the project has never had to design for, and it deserves its own section (§5) rather than being discovered mid-build. The uncomfortable truth: the hardest part of M7 is not talking to the LCU (well-documented, `league-connect` handles it) — it's making a distributable local process that a non-technical friend can run without a debugging session over Discord.

## 2. How the LCU actually works (recap from §8, confirmed still current in policy)

- League Client runs a local HTTPS server on a random port; credentials in a lockfile at the install path.
- `/lol-champ-select/v1/session` → live draft (ally picks/bans/assigned roles, enemy picks as revealed); websocket for real-time updates.
- Browser **cannot** reach it directly: self-signed cert, no CORS, lockfile needs filesystem access. Hence a local helper is mandatory — this is the whole reason M7 is more than a frontend change.
- Enemy **role assignments are not exposed** — must be inferred (see §4).

## 3. The bridge decision (the core /spec choice)

From §8, three options — reframed now that v1 is real:

| Option | What it is | Distribution reality | Verdict |
|---|---|---|---|
| **Node helper via `league-connect`** | ~100-line local process, re-serves champ-select state on a localhost port with CORS so the existing Pages frontend can fetch it | `npx` or a run script — ugly, needs Node installed, but zero build pipeline | **v-next proof-of-flow.** Disposable, proves the whole chain works before investing in packaging |
| **Tauri shell** | Native app wrapping the existing web frontend; Rust side reads lockfile + LCU, frontend unchanged | Single signed-ish binary; unsigned = SmartScreen warning (tolerable for friends, ugly for strangers) | **The destination** if the tool sticks. Reuses reckon's ts-rs/specta muscle; a shipped Tauri app is real portfolio surface |
| **Electron** | Same idea, heavier | Big binary, no Rust credit | **Rejected** — dominated by Tauri for this profile |

**Proposed sequence (for /spec to confirm):** Node helper *first* as the disposable proof — it de-risks the LCU integration and the role-inference logic without committing to a packaging pipeline. Tauri *only if* the tool earns it with sustained use. Deciding the destination now (Tauri) but building the cheap proof first mirrors how this whole project has worked: prove the flow empirically before investing in the polished version. **Do not build both; do not skip to Tauri before the Node helper proves the flow.**

## 4. Enemy-role inference (the one real algorithmic problem)

LCU gives enemy champions but not their assigned roles. We need roles to pick the right vslane table. Approach from §8, now with real data behind it:

- **Signal 1 — champion-role priors:** our own dataset has pick-rate-by-role for every champion (the `pr` fields, per-lane). A champion that's 95% jungle is almost certainly jungle. This alone resolves most of a comp.
- **Signal 2 — pick order / position hints:** champ select sometimes exposes cell/position data even when role isn't final; use where available.
- **Fallback — manual drag-to-correct:** the UI already assigns roles to slots; the user can override any inferred role in one drag. Inference gets it ~90% right; the human fixes the rest in seconds.

**Honest limit to state in /spec:** inference will be wrong sometimes (flex picks, off-meta), and a wrong role silently selects the wrong vslane table — which is exactly the "silently wrong" class this project polices everywhere. So the inferred role must be **visibly marked as inferred** (not presented as certain) and trivially correctable, same honesty standard as the "no data" and partial-comp gates.

## 5. Distribution & failure-mode UX (the new-class section — do not skip)

The questions M7's spec must answer that no prior milestone needed:

- **Helper-not-running:** the Pages app must detect the helper's absence and degrade gracefully to manual entry — never hang, never show stale champ-select data, never imply it's connected when it isn't. (Mirrors the stale-banner "quiet when unverifiable" instinct, but here it's "fall back to manual, say so plainly.")
- **Antivirus / SmartScreen:** an unsigned local binary or an `npx` process opening a localhost port is exactly what security software flags. The spec needs an honest install story — what the friend will see, what to click, and a plain-language "here's what this does and doesn't do" (read-only, local-only, no account access) that a non-paranoid person can accept.
- **Lockfile access on Windows:** the helper needs to find the League install path and read the lockfile. Default paths cover most; the spec should handle the non-default-install case without a code change (config or auto-detect).
- **Version drift:** the LCU is unversioned and unsupported (Riot's words). Same fail-loud discipline as the qdata deserializer — if the champ-select payload shape changes, the helper should fail visibly and fall back to manual, not feed garbage into the board.
- **The connection model:** localhost port + CORS header so the existing hosted frontend can talk to a local process. Confirm this actually works from an `https://` Pages origin to an `http://localhost` helper (mixed-content rules may bite — this is an empirical check for /spec, same spirit as PC-6's CORS probe).

**Flag:** that last point (§5, mixed-content https-page → http-localhost) is a real potential blocker worth an early empirical probe *before* the spec commits to "hosted frontend + local helper." If browsers block it, the architecture shifts (helper serves the frontend too, or Tauri moves up the timeline). This is M7's PC-6 — the cheap check that must run before the spec locks.

## 6. What M7 unlocks (the dependency payoff, for the record)

- **Kills the last v1 UX complaint** — no more typing ten names; champ-select auto-populates.
- **Matchup-conditioned builds** — the CORS-blocked vs-route (spec amendment) becomes one fetch from the local helper (no browser CORS constraint), for the one real matchup, at champ-select time.
- **Bans for free** — F8's bans modeling shrinks from "design manual entry + provider" to "provider supplies them, manual is the degradation path."
- **Calibration's home** — the helper is the natural place for the small local JSON log (predicted-rating-at-lock-in vs. actual result) that the no-database decision flagged as the one feature needing local persistence.

## 7. Hard lines (inherited, non-negotiable, reinforced by PC-5 amendment)

- **Read-only.** No auto-pick, no auto-accept, no writes to any Riot surface. Ever.
- **Advisory-only output.** Never a commanded pick (Riot prohibits tools that "dictate decisions").
- **Approved endpoints only** — champ-select session reads are the tolerated category; nothing beyond it.
- **Local-only.** The helper talks to localhost and our Pages frontend; it phones nothing home, stores nothing off-machine.

## 8. Open questions for /spec

1. **§5 mixed-content probe** — does an https Pages page reach an http localhost helper? (M7's PC-6; run before spec locks.) If no → does the helper serve the frontend, or does Tauri move up?
2. Node-helper packaging for non-technical friends — `npx`, a batch script, a tiny installer? What's the least-friction thing that isn't a Discord debugging session?
3. Role-inference confidence threshold — at what prior does inference auto-assign vs. leave blank for manual? (Cheap to tune; needs a default.)
4. Does the helper poll or use the LCU websocket? (Websocket is cleaner/real-time; polling is simpler. §8 leaned websocket.)
5. Match-V5 own-results fetch (for calibration groundwork) — build the key-handling into the helper now as a stub, or defer entirely to the calibration milestone? (Leaning: stub the seam, don't build the feature.)

## 9. Process from here

```
[this doc] → §5 mixed-content probe (empirical, ~30 min — M7's PC-6) →
/spec (locks bridge choice, role-inference contract, distribution story,
failure-mode ACs) → /plan → /implement
```

No M7 code before its spec, and no spec before the mixed-content probe answers whether the hosted-frontend-plus-local-helper shape is even viable. Same gate discipline as everything since day one.

---

# In-repo review addendum (CC, 2026-07-03)

Draft reviewed from the repo view; carried to /spec with these additions:

1. **The lockfile is a credential — name it as one (§5/§7 gap).** §7's
   "local-only, phones nothing home" is necessary but not specific enough:
   the lockfile's auth token must never leave localhost, never be logged,
   and never appear in any diagnostic output a friend might paste into
   Discord. That last clause is the one §5's support-over-Discord reality
   makes load-bearing. Should become a named AC in /spec.

2. **Helper ↔ app version skew (§5 addition).** §5 covers LCU payload
   drift, but M7 creates three artifacts updating on different cadences on
   different machines (helper binary, Pages frontend, dataset patch). A
   trivial handshake closes it: the helper's health endpoint reports its
   version; the app warns on mismatch instead of failing mysteriously.

3. **Probe-method correction (§8 Q1).** The mixed-content question cannot
   be answered by curl — mixed-content and private-network rules are
   browser policy, not server behavior. The probe is: real https Pages
   page + real local http server + real browser. Artifacts shipped with
   this addendum: `tools/m7-probe-helper.mjs` (stub with correct CORS +
   preflight incl. `Access-Control-Allow-Private-Network: true`, so a
   failure indicts browser policy, not server misconfiguration) and the
   live page at `/m7-probe.html`.

   **Hypothesis, labeled as such (not observation):** modern browsers
   treat `http://127.0.0.1` and `http://localhost` as potentially
   trustworthy origins, EXEMPT from mixed-content blocking — so the plain
   fetch likely passes. The live risk is Chrome-family private/local
   network access enforcement (preflight requirement, and possibly a user
   permission prompt in recent versions), which is exactly what the stub's
   headers and the probe page's error reporting are built to surface.

   **Pass criteria (defined before running):** PASS = the probe page shows
   HTTP 200 + JSON from at least one of the two URL forms in the operator's
   daily browser (note which forms and any permission prompt). FAIL = both
   forms blocked; record the exact console/error text — the error class
   distinguishes mixed-content blocking from private-network enforcement
   and determines which way the architecture shifts.
