# Brainstorm — Matchup-conditioned builds (the vs-route feature)

**Phase:** /brainstorm (precedes /spec)
**Date:** 2026-07-05
**Drafted by:** CC (in-repo). **Per the seam: this draft needs an OUTSIDE
review pass** — the drafter doesn't review its own reasoning.
**Builds on:** the spec §1 amendment (named this a v2/LCU feature when CORS
blocked it in v1), the M6a vs-route validation (live-probed 2026-07-03),
the helper's stubbed seam (AC-M7-15, seam 1 — the last stub in seams.ts),
and the market-landscape grounding (draft-conditioned builds are the
category's named gap — a demand signal for work we'd already promised).

## 1. What it is

Beside the champion-level highest-win build (M6b), show the build
conditioned on YOUR actual lane opponent: fetched live at champ-select
time from lolalytics' vs-route (`/lol/<us>/vs/<them>/build/q-data.json`),
one polite request for the one real matchup. The blocker that deferred
this in v1 — browsers can't fetch lolalytics (no CORS, verified) — is
gone: the helper fetches it.

## 2. What is already known (validated, not assumed)

- **Route + shape observed live (2026-07-03):** HTTP 200, Qwik `_objs`
  graph, one `{pick, win}` pair — but the items structure is a VARIANT of
  the build-route shape: `{start, item1, item2, item3, item4[], item5[],
  item6[]}` — singular best-per-slot for 1–3, option lists for 4–6, and
  NO `core` triple. A dedicated extractor is required; `extractBuilds`
  will correctly reject this shape (its `builds-items` invariant demands
  `core`).
- **Samples are matchup-small:** observed n = 16–246 per slot. Shrinkage
  + visible n are mandatory; sparse matchups may render largely
  "insufficient" — that's the honest output, same as everywhere.
- **The captured payload is now a committed fixture**
  (`aatrox-vs-darius-build.q-data.json`) — the extractor's golden test
  material exists before the extractor.

## 3. The two design questions for /spec

### Q1 — Who parses: helper-as-proxy vs helper-parses?
- **(a) Helper proxies raw** (lean): helper fetches, returns the raw
  q-data; the FRONTEND parses with the existing qdata machinery + the new
  vs-extractor. Costs: web app gains a qdata dependency (dependency-free
  TS, small); validation UX reuses the frontend's existing error states.
- **(b) Helper parses**: helper bundles qdata (esbuild handles workspace
  imports; it already imports types) and serves normalized JSON. Costs:
  validation logic ships in two artifacts with different update cadences
  (the fleet-staleness axis).
- **Lean: (a)** — the helper stays a dumb pipe with exactly one new
  fetch; all shape knowledge stays in the artifact that auto-updates
  (the Pages frontend). The fleet-update research (expansion-decisions)
  argues the same direction: put drift-prone logic where deployment is
  free.

### Q2 — When to fetch, and for whom?
- Trigger: when the draft has BOTH our locked pick and a role-known lane
  opponent (same lane as the pick). One fetch per (pair, patch), cached.
- Works in BOTH modes: LCU-live (automatic) and manual (the board knows
  the lane opponent once entered) — the feature is not LCU-gated, only
  helper-gated. Degradation: no helper → champion-level build only, a
  quiet absence (the M6b panel already stands alone).

## 4. The named invariant evolution (do NOT let this slide in silently)

The helper currently enforces "no module besides lcu.ts makes outgoing
requests" — a grep-test invariant. This feature adds a SECOND outbound
surface: lolalytics' vs-route. The AC-C-1b pattern applies — rescope the
invariant explicitly, don't erode it:
- Outbound requests permitted from exactly two modules: `lcu.ts`
  (loopback LCU, GET only) and the new vs-fetch module (lolalytics
  vs-route ONLY, GET only, slug-validated URL construction — `^[a-z0-9]+$`
  on both slugs so no request-forging through the helper).
- **D13 politeness now binds the helper too:** honest UA, and the natural
  rate is ~1 request per draft — orders of magnitude inside the posture,
  but the spec should say it, and the helper should refuse to fetch more
  than a small per-minute cap regardless of what the frontend asks.
- INSTALL.md gains one honest sentence: the helper also fetches one
  build page per game from the same public stats site the tool's data
  comes from.

## 5. Honesty requirements (inherited, applied)

- Matchup builds render BESIDE the champion-level build, never replacing
  it; each slot shows its n; below-floor slots render "insufficient" —
  at n=16-class samples this will be common and the display must make
  small-sample-ness impossible to miss.
- The panel names its conditioning plainly: "vs Darius specifically —
  small samples, use judgment" class labeling, per the house style.

## 6. Pre-spec checklist

- **PC-MB-1: ✅ PASSED (2026-07-05).** Second pair probed live (lulu vs
  blitzcrank — support class, vs the fixture's top-lane pair): HTTP 200,
  exactly one {pick,win} pair, the item1-6+start variant present, ZERO
  core-bearing keysets. Shape stable across role classes and days.
- **PC-MB-2:** decide Q1 (proxy vs parse) — spec locks it.
- **PC-MB-3:** confirm the per-minute fetch cap value.

## 7. Process

```
[this doc] → OUTSIDE review pass (CC drafted; seam requires a reviewer who
didn't) → /spec (locks Q1/Q2, the invariant rescope, the cap) → /plan → build
```
