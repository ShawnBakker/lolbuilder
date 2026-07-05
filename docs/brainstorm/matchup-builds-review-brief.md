# Review brief — matchup-builds brainstorm (outside pass)

**To the reviewer:** you are the outside pass on
`docs/brainstorm/matchup-builds-brainstorm.md`. CC drafted it, so per the
seam CC cannot review it — your job is to attack its reasoning before it
becomes a spec. This brief is self-contained; the brainstorm is short.

## Goal

Decide whether the brainstorm's framing survives scrutiny, and resolve (or
sharpen) its two open design questions so /spec can lock them.

## Pre-validated — do not re-litigate, evidence exists

- The vs-route works and its shape is known: TWO live captures, different
  role classes, different days (2026-07-03 aatrox/darius → committed
  fixture; 2026-07-05 lulu/blitzcrank → PC-MB-1 pass). One {pick,win}
  pair; items variant `{start, item1-3 singular, item4-6 lists}`; no
  `core` triple.
- Browsers cannot fetch lolalytics directly (no CORS — probed in M6a);
  the helper can. That asymmetry is the feature's architecture.
- Matchup samples are small (observed n = 16–246 per slot) — shrinkage +
  visible n are mandatory, and "insufficient" will be a common honest
  render.

## What to attack (in priority order)

1. **Q1 — who parses (§3):** CC leans helper-as-dumb-proxy (raw q-data to
   the frontend; frontend parses with qdata + a new extractor), on the
   argument that shape knowledge belongs in the auto-deploying artifact,
   not the manually-updated fleet. Attack: is shipping raw third-party
   payloads through the helper to the browser a worse surface than parsing
   helper-side? Is the qdata-in-browser bundle cost real? Is there a
   failure mode where frontend and helper disagree about a payload that
   proxying makes worse?
2. **The second outbound surface (§4):** the helper would fetch lolalytics
   — a genuine expansion of what the helper does on your machine. CC
   proposes: dedicated module, GET-only, slug-validated URL construction,
   a hard per-minute cap, invariant test rescoped the AC-C-1b way, one
   honest INSTALL.md sentence. Attack: is the slug validation sufficient
   to prevent the helper being used as a generic fetch proxy by anything
   that can reach 127.0.0.1? Should the allowlist be tighter (exact URL
   template, not just slugs)? Is the cap the right mechanism, and what
   number?
3. **Q2 — trigger/caching (§3):** fetch when pick + lane opponent are both
   known; cache per (pair, patch). Attack: re-picks and lane swaps mid-
   draft (opponent changes → second fetch — is the cap consistent with
   that?); manual-mode ergonomics; whether "quiet absence" degradation is
   honest enough or needs a "helper required for this panel" note.
4. **Politeness accounting (§4):** ~1 request per draft against D13's
   posture, from friends' machines rather than the pipeline. Attack: does
   distributing the request origin change the politeness calculus or the
   fallback story (if lolalytics blocks residential IPs, what does the
   panel do)?
5. **Honesty rendering (§5):** beside-never-replacing, n on every slot.
   Attack: is a side-by-side build panel at n=30 MORE misleading than
   nothing, even labeled? Should there be a floor below which the matchup
   panel refuses to render at all (the display-floor pattern from
   calibration)?

## Output contract

For each numbered item: verdict (stands / falls / sharpen-with-change) +
the reasoning. If Q1 or the cap resolves differently than CC's leaning,
say what /spec should lock instead. End with an overall
converges/does-not-converge call on sending this to /spec.

## Not in scope

One-click import (separate D11 register question), the pipeline (this
feature adds zero pipeline requests), F8, and anything about whether the
feature is worth building — the operator queued it; the question is HOW.
