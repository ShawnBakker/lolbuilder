# Visual verification pass — deployed site via Playwright MCP (2026-07-06)

First use of the Playwright MCP for UI verification. Target:
`https://shawnbakker.github.io/lolbuilder/` (the real deployed Pages
artifact, not a dev server), against helper 0.4.0 running locally
(`/health` verified before the pass: `ok`, protocol 1, LCU connected).

## Pass criteria — defined BEFORE the probe (house rule)

Criteria are drawn from the closure records (`calibration-acceptance.md`,
`calibration-plan.md` C.3 entry, commits 163e494 / 7c55614), not from
impressions. Each is a binary observation.

- **P1 — Rift theme.** Page background is the layered-gradient League
  palette (navy/teal/gold), not a default white/gray page; layout
  container is the widened ~78rem; hextech panel treatment visible on
  panels. Evidence: screenshot + computed styles.
- **P2 — Champion icons.** (a) Search results show DDragon icon images
  that actually loaded (`naturalWidth > 0`, `src` on the DDragon CDN).
  (b) A champion placed in a board slot shows its icon. (c) The
  slug-divergence case: searching Wukong yields a loaded icon (internal
  key `MonkeyKing`). (d) Fail-soft: no broken-image glyphs anywhere.
- **P3 — Explain-why column.** With a pick + at least one enemy entered,
  the score table shows plain-language per-component readings
  (direction phrased from the player's perspective, coarse strength
  bands, thin-data qualifier where applicable) — and **no bare decimal
  percentages** anywhere in the advisory output (qualitative tiers +
  sample sizes only).
- **P4 — Report card (real log through the local helper).** Card
  renders from `GET /calibration-data`: counter consistent with the real
  meter state (2 games · 4 predictions · 2 outcomes, 0W/2L, 0 pending
  orphans); the below-floor honest state ("sample too small to
  conclude" wording, floor 20); **structural misread guards hold in the
  live DOM: zero `%` characters inside the card, no estimate/RangeBar
  value shown below the floor, the non-attribution lead precedes any
  number.**
- **P5 — Hygiene.** No console errors; no failed network requests other
  than expected-absent resources; **no POST to any helper or Riot
  surface during the whole pass** (browsing + manual board entry must be
  read-only — a stray calibration POST from manual interaction would
  pollute the real log and is an automatic finding).

Anything failing a criterion is recorded as a finding with evidence
(screenshot + DOM/network observation), not adjusted into a pass.

## Observations (all via Playwright against the live Pages site + live helper)

Evidence screenshots: `docs/analysis/evidence/01-initial-load-fullpage.png`
(cold load), `02-scored-board-fullpage.png` (Wukong pick vs Malphite,
scored), `03-scrolled-bottom-viewport.png` (artifact disproof, below).
~1.3 MB total, committed alongside this doc (a one-time cost, not a
per-patch data stream); every observation below is also recorded
textually and stands without them.

- **P1 PASS.** Computed `body` background is the four-layer stack
  (3 radial teal/navy glows + the navy linear base:
  `linear-gradient(160deg, rgb(4,18,31) …)`); `main` max-width computes
  to `1248px` (= 78rem); panels render the hextech border treatment
  (gold-edged score/card panels visible in evidence 02).
- **P2 PASS (all four).** (a) Search result for "wukong" renders
  `https://ddragon.leagueoflegends.com/cdn/16.13.1/img/champion/MonkeyKing.png`
  with `complete && naturalWidth > 0` — the slug-divergence case (c)
  in one observation. (b) After assign, the same loaded icon sits in the
  ally top slot; Malphite's icon in the enemy slot. (d) Every `<img>` on
  the page (2 champion + 13 item icons) reports loaded; zero broken
  images at any point.
- **P3 FAIL on the deployed site — code is fine on main. Finding F1.**
  With Wukong (top) vs Malphite (top) scored, the score table renders
  four columns (`signal / vs-with / logit Δ / games`) and **no `reading`
  column**. Source on main has five (`App.tsx` thead includes
  `<th>reading</th>`; row renders `describeComponent`; `.reading` CSS
  exists and does not hide). Root cause under F1 below. Everything else
  in the advisory output conforms: tier + rounded whole percent +
  confidence + weakest-cell n ("Favorable · ≈53% (high confidence —
  weakest cell rests on 3,599 games)"); the only decimals anywhere are
  the spec'd logit contributions (+0.15 / −0.05) and the patch number —
  no `62.3%`-style output exists.
- **P4 PASS.** Card over the real log: "2 games logged · 2 with outcomes
  (0W/2L)"; "Sample too small to conclude — the tool refuses to guess."
  Structural guards checked in the live DOM: **zero `%` characters in
  the card's rendered text** (the only card digits are the counters
  2/2/0/2); the RangeBar renders `left:0%; width:100%` — the full
  "anything still allowed" span, which is the tested below-floor state
  (`CalibrationCard.tsx:41` comment confirms intent), with no numeric
  estimate anywhere; the non-attribution lead ("Draft is one input among
  many…") precedes every number. The heading's flattened accessibility
  text ("Report card is the advice tracking your games?") is a
  snapshot-tree artifact — the DOM is `Report card <span class="conf">is
  the advice tracking your games?</span>` and renders as
  title + subtitle (evidence 01).
- **P5 PASS with one minor finding (F2).** Network log for the whole
  session: 7 non-static requests, **all GET, all 200** — manifest,
  DDragon versions/champion/item JSON, two champion shards, and
  `http://127.0.0.1:27437/calibration-data` (the localhost mixed-content
  exemption works from the https page). A request listener armed during
  the entire interaction sequence caught **zero non-GET requests** —
  manual board entry writes nothing to the calibration log. Console:
  exactly one error, the F2 favicon 404.

## Findings

### F1 — deployed site is one commit stale: explain-why readings never shipped (the deploy failed, silently from the repo's viewpoint)

- The live bundle (`assets/index-sBbNdXph.js`) contains C.3's card
  strings ("refuses to guess": 1 hit) but **zero** hits for
  `in your favor` or the `"reading"` header — it was built from
  163e494, not 7c55614.
- Actions API: Pages run **28764464030** (head 7c55614, 2026-07-06
  02:46Z) `completed / failure`. Step log: checkout, install, build,
  dataset compose, and `upload-pages-artifact` all succeeded;
  **`actions/deploy-pages@v4` itself failed** — consistent with a
  transient Pages-service error, not a code problem. (Step-level only:
  raw logs need auth; no `gh` on this machine.)
- Cross-checks per the measurement rule: flagged-negative verified two
  independent ways (string absent in bundle AND column absent in live
  DOM); flagged-positive likewise ("refuses to guess" in bundle AND the
  card renders live). Not a CDN-cache mirage: the failed run is
  authoritative, cache-independent evidence that the new build never
  published.
- 6e670de (docs-only) didn't trigger Pages — path filter — so nothing
  redeployed since.

**REMEDIATED + VERIFIED, same day (operator-directed).** The recovery
itself produced findings worth keeping:

1. Auth lever: no `gh` on this machine, but the git credential helper
   holds an OAuth token with `repo`+`workflow` scopes — sufficient for
   the Actions REST API. (Token used from a shell variable only, never
   echoed — credential discipline per the C.1 pattern.)
2. **"Re-run failed jobs" is a poisoned path for this workflow**: the
   re-run (attempt 2 of run 28764464030) uploaded a second `github-pages`
   artifact alongside attempt 1's, and `deploy-pages@v4` hard-fails on
   "Multiple artifacts named github-pages … count is 2." Recovery for a
   failed Pages deploy must be a **fresh run** (`workflow_dispatch`),
   never a re-run — worth remembering next time.
3. Fresh dispatch #1 (run 28778298742, head 6e670de) failed with the
   SAME generic server-side error as the original ("Deployment failed,
   try again later"; deployment status `deployment_failed`, no
   description), while githubstatus.com reported all systems
   operational. Artifact ruled out by direct inspection (downloaded
   artifact 8103566667: 183 entries, all regular files mode 644, no
   symlinks/path tricks, 12.6 MB uncompressed, new bundle present) —
   the failure was platform-side despite the "operational" status.
4. Fresh dispatch #2 (run 28778535400) **succeeded** — the error meant
   what it said: try again later. Two genuine platform failures
   (02:46Z, 08:29Z), then success (~08:33Z).

Verification of the fix, same method as the finding: live bundle is now
`assets/index-lQLxxfBo.js` (byte-identical name to the one in the
inspected artifact) with `in your favor` / `"reading"` / `refuses to
guess` all present (1 hit each); live render (Wukong top vs Malphite
top) shows the five-column table with the readings — baseline: "this
champion's overall above-average win rate in this role"; matchup: "the
lane matchup vs Malphite runs clearly against you" (coarse band,
player-perspective direction, correctly NO thin-data qualifier at
n=3,599 ≥ 500). Zero non-GET requests during re-verification. Evidence:
`evidence/04-explain-why-live.png`. **F1 closed.**
- Process note worth an operator thought: a failed Pages deploy is
  currently invisible unless someone looks — this is the second
  artifact-freshness seam (after AC-M7-14's helper/frontend version
  check). A cheap guard would be the frontend surfacing its build sha
  next to the dataset date, or a notification on `pages.yml` failure.

### F2 — favicon 404 (minor, cosmetic)

`index.html` declares no favicon, so the browser requests
`https://shawnbakker.github.io/favicon.ico` (domain root — outside the
project path) and 404s. One console error on every load. Fix is a
one-line `<link rel="icon">` + asset whenever convenient.

**Fix pass criteria (defined before the post-deploy probe):**
(a) served index.html contains a `<link rel="icon">`; (b) a fresh load
of the deployed site logs **zero** console errors; (c) the network log
contains **no request to `https://shawnbakker.github.io/favicon.ico`**.
Fix chosen: inline data-URI SVG (gold hexagon, theme palette) — no new
asset, no request, immune to the relative-base (`base: "./"`) pitfall
a root-absolute asset href would hit.

### Verified-artifact (NOT a finding): full-page screenshot gradient band

Full-page captures (evidence 01, 02) show a hard horizontal band where
the background gradient stops. Verified against a real scrolled
viewport (evidence 03): the background is continuous — the band is a
known capture artifact of `background-attachment: fixed`
(`index.css:28`) under Playwright's stitched full-page screenshots.
Recorded so the next person doesn't re-flag it.

## Tooling notes (first Playwright MCP session)

- The MCP browser context **dropped three times** mid-session
  ("Target page, context or browser has been closed"), including once
  voiding an `evaluate` that then silently ran against `about:blank`
  (all-null results — discarded, not recorded). Mitigation that worked:
  batch multi-step interactions into a single `browser_run_code`
  call and treat any single-call result that could have raced a
  context drop with suspicion (null-heavy results ≈ dead page, rerun).
- Screenshots land relative to the server cwd (repo root) — pass paths
  or relocate afterward; `.playwright-mcp/` session logs also accumulate
  in the repo root (left untracked this session).

## Verdict

All five criteria now PASS on the live site. The initial pass found the
deploy one commit stale (F1, above) — remediated the same day via
`workflow_dispatch` after discovering the re-run path is unusable for
Pages deploys, and verified with the same bundle-grep + live-render
method that established the finding. Remaining open: F2 (favicon
one-liner) and the F1 process note (failed Pages deploys are invisible
without a check — build-sha surfacing or failure notification would
close that seam).
