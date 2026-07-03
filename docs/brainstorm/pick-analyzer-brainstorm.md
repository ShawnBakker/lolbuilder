# Brainstorm — LoL Pick Analyzer & Build Planner

> **SUPERSESSION NOTE (2026-07-02):** §3 and §5 argue for an Oracle-VPS-based pipeline. That reasoning was
> superseded by smoke-test evidence (all sources serve datacenter IPs bare) — the locked architecture is
> GH-Actions-only (spec §3, register D5). Do not re-derive the VPS from this document.

**Phase:** /brainstorm (precedes /spec)
**Date:** 2026-07-02 (v2 — revised after Riot API key-tier findings; v1 same date)
**Status:** Draft — decisions here are *proposals with reasoning*, to be locked in /spec
**Input:** Deep-research report (2026-07-02) + external LLM cross-exam + Riot developer portal key-tier documentation. All are research inputs, not decisions.

---

## 1. What we're building, and what we're deliberately not

**Building:** A draft-analysis web tool. Input a full 10-champion draft state; output (a) a phase-bucketed win-rate estimate for your pick with honest uncertainty, (b) the highest-WR build vs. your lane opponent, (c) rule-based counter-item adjustments vs. the enemy comp.

**Non-goals (v1) — written down so they don't creep back in:**

- **No public release.** The cross-exam's key reweighting stands: the data dependency (lolalytics' private API) is structurally unsanctioned. We design as personal-only *forever* and accept that going public later means a re-source and partial rewrite, not a config flip. No effort spent on a "pivot path."
- **No database.** Justified in §4 — this is the biggest architectural simplification and worth internalizing.
- **No Riot API *data ingestion* in v1 — but register a Personal API key now.** The Riot API cannot provide aggregated matchup data at any non-production rate limit (~142 days of ingestion per patch vs. a 14-day cycle), so it contributes zero stats in v1. However, Riot's key tiers are three, not two: development (24h expiry, testing only), **personal** (registered without verification, intended for "just the developer or a small private community," no rate-limit increases), and production (verification + working prototype, public products). A personal key costs one product-description form and buys: (a) a non-expiring key; (b) registered-product standing that doubles as the "tell Riot how you use the LCU" disclosure the client-API policy expects; (c) a sanctioned path for the v2 calibration-logging feature (fetching *your own* post-game results via Match-V5 — a handful of requests/day, trivially within limits). It does **not** change the sourcing conclusion: no rate increases means self-aggregation stays dead, and lolalytics remains the sole aggregated-stats dependency.
- **No ML / neural draft model.** Pairwise logit summation is a ranking heuristic, not calibrated probability; we accept that and communicate it in the UI rather than chasing GNN-level accuracy that requires datasets we can't get.
- **No accounts, no auth, no user data.** Nothing to secure, nothing to leak.

*(Clarification worth pinning: three separate Riot surfaces with three separate access models. Data Dragon = static CDN, no key, unrestricted. Riot API = keyed, tiered as above. LCU = no key at all — lockfile auth on localhost, governed by the client-API policy, not the key system.)*

---

## 2. The load-bearing decision: data source

Everything downstream depends on this, and it is **empirically unvalidated**. The research report claims specific lolalytics endpoint shapes (`ax.lolalytics.com/mega/` for matchups, `a1.lolalytics.com/mega/` for synergy, game-length buckets in `time`/`timeWin`), but no LLM can verify a live endpoint — only a curl can.

**Validation gate (precedes /spec):** a ~30-minute smoke test from the Oracle VPS. One champion, current patch, both endpoints. Pass criteria:

1. Returns JSON (not a Cloudflare challenge page)
2. Contains matchup win/game counts per lane opponent
3. Contains game-length/time-bucket win data (this is the *entire* early/mid/late feature)
4. Synergy endpoint returns duo win rates

**Decision tree:**

| Outcome | Consequence |
|---|---|
| Full pass | lolalytics is primary source; spec proceeds as researched |
| Buckets missing | Early/mid/late feature is cut or redefined (e.g., proxy via avg game length); overall/matchup features survive |
| Cloudflare blocks direct requests | Try u.gg `stats2` CDN JSON next; then op.gg MCP; Playwright fallback is a last resort (heavy, brittle) |
| Everything blocked | Project scope shrinks to Data-Dragon-only build reference + rule-based itemization, no win rates. Honest kill criterion for the analytics half. |

**Why the smoke test isn't "coding before planning":** it's research. It resolves a factual unknown that the spec depends on. Writing the spec first would mean speculating about payload shapes and designing normalizers for data structures that may not exist.

**ToS posture (settled, restated):** lolalytics explicitly reserves its API for site visitors. For a private tool: one polite batch run per patch (or daily), cached on the VPS, sequential requests with delays, honest User-Agent. Risk accepted: IP block → we fall back. Nothing here is worth evasion engineering (rotating proxies, fingerprint spoofing) — if they block us, that's their answer, and we move down the fallback chain.

---

## 3. Service inventory

| Concern | Service | Tier / cost | Why this one | Tradeoff accepted |
|---|---|---|---|---|
| Static game data (champs, items, icons) | Data Dragon + Community Dragon | Free, unrestricted, CORS-enabled | Canonical, versioned, no key | Up to ~48h lag after patch day; CDragon fills gaps |
| Aggregated stats (matchups, synergy, builds, phase buckets) | lolalytics internal JSON | Free, unsanctioned | Only source with all four data shapes pre-aggregated | Endpoint churn risk; ToS gray zone; personal-only ceiling |
| Fallback stats | u.gg `stats2` CDN → op.gg MCP | Free | Diversification; op.gg MCP is actually sanctioned but thinner data | u.gg version-integer churn; op.gg lacks phase buckets (verify) |
| Scrape origin + cache | Oracle Cloud VPS (existing, runs the Minecraft server) | Free (already provisioned) | Persistent disk cache, stable IP, keeps home IP out of it, cron available | Shared with Minecraft — resource contention is negligible (pipeline is I/O-bound, minutes/day) but a ban would burn the VPS IP for this purpose |
| Pipeline scheduling | Oracle VPS cron (primary) or GitHub Actions cron (alt) | Free | See §5 — VPS cron preferred because the scrape *must* originate from the VPS anyway | GH Actions cron drifts/skips; also, running scrape logic in GH Actions means Microsoft IPs hitting lolalytics — noisier, more blockable |
| Dataset distribution | GitHub Releases artifacts (per-patch) | Free, no repo bloat | See §4 storage discussion | One extra fetch hop for the frontend |
| Frontend hosting | GitHub Pages (primary) or Cloudflare Pages (alt) | Free | Pure static SPA, no server component exists to host | Pages: 1GB site / 100GB-month bandwidth soft limits — irrelevant at friend scale |
| Monitoring | GH Actions failure emails + a "dataset age" banner in the UI | Free | The UI banner is the real monitor: stale data is self-evident to users | No paging; acceptable — worst case is stale stats, not lost money (contrast: Meridian) |

**Stack:** TypeScript everywhere, pnpm monorepo (matches your existing muscle memory from Meridian — same toolchain, zero new learning tax). Vite + React static frontend, *not* Next.js: there is no server-side rendering, no API routes, no auth — Next.js would be paying complexity rent for features this project structurally cannot use. Plain Node scripts for the pipeline.

---

## 4. Why no database (the WHY, in full)

The instinct after Meridian is to reach for Redis/Postgres. Resist it. The question a database answers is: *how do I serve many small, changing, per-user reads and writes safely and concurrently?* This project has none of those properties:

- **The dataset is finite and immutable per patch.** ~170 champions × 5 roles of matchup/synergy/build tables. Once patch 26.13's data is aggregated, it never changes. There are no writes after build time.
- **All reads are known in advance.** A draft touches at most 10 champion-role shards. The frontend lazy-loads exactly those JSON files (~50–150KB each). A CDN serving static files *is* the read path — and it's faster, freer, and less operable than any database.
- **Rebuild is wholesale, not incremental.** New patch → regenerate everything → publish a new versioned artifact. That's a build step, not a migration.

So the "database" is: **versioned JSON shards, built by the pipeline, published as a GitHub Release per patch, fetched by the frontend.**

**Storage-growth trap (flagging now so it doesn't bite in month 6):** committing shards into the repo bloats git history — est. 20–100MB/patch × 24 patches/year = 0.5–2.4GB/year of dead history. GitHub Releases artifacts sidestep this entirely: each patch is a release asset, history stays clean, old patches remain downloadable, and the frontend fetches `releases/latest` or a pinned tag. Alternative if Releases feels clunky: Cloudflare R2 (10GB free) — but that adds an account/credential to manage for no gain at this scale.

**When this decision would flip:** if we ever wanted per-user features (saved drafts, history, tier-list votes) — i.e., writes. Personal-only v1 has none. Note it, defer it.

---

## 5. Pipeline placement: VPS cron vs. GitHub Actions

The research report suggested GH Actions cron. On reflection, **VPS cron is the better primary** and the reasoning matters:

1. **The scrape must route through the VPS anyway** (IP hygiene, cache). GH Actions calling a VPS proxy that calls lolalytics is three hops with two failure surfaces; VPS cron doing fetch + normalize + publish is one machine doing everything, with GH only receiving the finished artifact via `gh release create` (authenticated with a fine-grained PAT scoped to this one repo).
2. **GH Actions cron is unreliable by design** — documented drift up to ~40 min and silent skips on inactive repos. Tolerable for a biweekly job, but "tolerable unreliability" plus "extra hop" loses to "boring cron on a box you already administer."
3. **Persistent disk cache lives on the VPS.** A re-run after a partial failure resumes from cache instead of re-hammering lolalytics — that's most of what "polite scraper" means in practice.

GH Actions keeps a role: CI (typecheck, unit tests on the scoring core) and building/deploying the static frontend to Pages on push. Compute-heavy, IP-sensitive work stays off it.

**Cadence:** daily version check against `versions.json` (cheap, one request); full scrape only on patch change, plus one mid-patch refresh (~day 7) to pick up sample-size growth. That's ~3 scrape runs a month — comfortably polite.

---

## 6. Cost model

Everything is $0 in money. The honest cost is **maintenance time**, and it's worth forecasting because it's this project's real recurring bill:

| Event | Expected frequency | Time cost |
|---|---|---|
| Patch day — pipeline runs clean | 24×/year | 0 (automated); glance at UI banner |
| Data Dragon lags patch | Several ×/year | 0 — pipeline just waits for `versions.json`; UI shows stale-data banner |
| lolalytics payload schema drift (field renames, structure changes) | Guess: 1–4×/year | 1–3 hrs each — normalizer fixes |
| Hostname rotation / Cloudflare tightening | Guess: 0–2×/year | Half a day — endpoint hunting or fallback-source switch |
| New champion mid-cycle | ~4–6×/year | 0 if pipeline is keyed off Data Dragon's champ list (design requirement for /spec); shows "low sample" naturally |
| Fallback source migration (u.gg/op.gg) | Hopefully never | 1–2 days — this is the tail-risk bill |

**Kill/downscope criterion (deciding now, calmly):** if source breakage exceeds roughly one incident per month for a sustained stretch, the analytics half isn't worth the upkeep for a friends tool — downscope to the Data-Dragon-only build reference rather than entering an arms race.

Free-tier boundaries that would ever charge money: none at friend scale. GitHub Pages bandwidth (100GB/mo) would require ~700k+ page loads; Oracle free tier is already consumed by an existing workload that dwarfs this pipeline.

---

## 7. Risks beyond sourcing

- **False precision is a product risk, not just a stats footnote.** A "62.3% predicted WR" number will be trusted by friends far beyond its calibration. Mitigation is a spec-level requirement: qualitative tiers + sample sizes + confidence surfaced everywhere; exact decimals suppressed.
- **Correlated signals.** Logit summation double-counts (matchup WRs already partially encode synergy effects). Accepted; the output is framed as a *ranking heuristic* ("which of my options is better") not a probability ("will I win").
- **Rank-tier mismatch.** Emerald+ default misrepresents low-elo lobbies (high-skill champs look worse than they perform there, and vice versa). v1: default emerald_plus, expose a tier filter only if the endpoint makes it free to add.
- **Verification hygiene (process lesson from the cross-exam):** the external verifier imported a KILL/KEEP/fundable-demand rubric from an unrelated document because it saw adjacent context. Rule going forward: external LLM verification passes receive *only* the self-contained brief — never neighboring docs, never the full report when the brief suffices.

---

## 8. LCU integration (promoted from parking lot — scoped for v2, seam required in v1)

**What it is:** the League Client runs a local HTTPS server (random port, credentials in the install-path lockfile). `/lol-champ-select/v1/session` exposes the live draft — ally picks/bans/assigned roles, enemy picks as revealed — and a websocket event stream provides real-time updates. Auto-populating the draft board from the actual lobby is the single largest UX upgrade available to this tool.

**Policy status (verified 2026-07-02; refined by two independent crosschecks):** Riot publicly acknowledges the LCU API. Formal rules: approved-endpoint list, notify Riot before *releasing* an application, Korea excluded entirely. Read-only champ-select tools (Blitz, Porofessor, op.gg desktop) operate openly — but note honestly: "tolerated" is an inference from years of enforcement behavior, not codified policy. What *is* codified: Riot prohibits products that create unfair advantage, remove game decisions, or **dictate decisions**. That last verb is a design constraint, not a tone preference — the tool presents data, sample sizes, and tradeoffs for the player to weigh ("advisory"); it never reduces to a single commanded pick. **Hard lines we never cross: read-only (no auto-pick, no auto-accept, no writes), and advisory-only output framing.** Notably, LCU usage remains a *cleaner* gray zone than the lolalytics scraping, since Riot has an explicit framework governing it.

**Known limitations to design around:**
- Enemy *role assignments* are not exposed — infer from pick order + champion-role priors (from our own dataset), with manual drag-to-correct in the UI.
- Champ select is fast (~30s windows). Frontend must prefetch shards for every champion the moment it appears on the board, not on demand. This is a v1 frontend requirement even before LCU exists, since it also improves manual mode.

**Bridge options (browser can't reach LCU directly — self-signed cert, no CORS, lockfile needs filesystem access):**

| Option | Effort | Distribution | Notes |
|---|---|---|---|
| Node helper via `league-connect` npm | ~100 lines | `npx` — ugly but fine for friends | v-next increment; disposable proof of flow |
| Tauri shell wrapping the web frontend | Days | Single binary; unsigned = SmartScreen warning (acceptable for friends) | Reuses reckon's ts-rs/specta pattern; portfolio surface. The destination if the tool sticks |
| Electron | Days | Heavier binary | Dominated by Tauri for this profile — rejected |

**Decision required in /spec (v1, non-negotiable):** `DraftState` is populated through a **provider interface** — `ManualProvider` (clickable board, v1) and `LcuProvider` (v2) implement the same contract. Near-zero cost now; prevents a UI rewrite later. This is the only part of LCU integration that touches v1.

**Downstream unlocks (parking lot, listed here because LCU enables them):**
- **Live build advisor via the Game Client API** — `https://127.0.0.1:2999/liveclientdata/allgamedata`, *officially documented by Riot*, no auth. In-game enemy items/levels feed the same itemization engine → build panel re-prioritizes live. Natural v3.
- **Calibration logging** — record predicted WR at lock-in + actual result post-game; over ~100 games, produce an honesty report on whether the tool's "55%" picks win 55%. With a Personal API key registered, results come from Match-V5 (sanctioned, complete, a few requests/day) rather than scraping LCU end-of-game state — cleaner and more reliable. First feature that requires local persistent state (small JSON log written by the helper) — flagged so the no-database decision stays honest.

## 8b. Deferred ideas (parking lot — not v1, not v2 without a decision)

- Multi-region / multi-tier filters
- Duo-queue mode (score two picks jointly)
- Historical patch comparison ("did 26.14 kill my pick?")
- Any public release (triggers: Riot registration, production key, full re-source — treated as a different project)

---

## 9. Open questions to resolve before /spec is written

1. **Smoke test results** — go/no-go on lolalytics, and exactly which fields exist (dictates the domain types; the researched `ChampionMatchup`/`byPhase` shapes are provisional until we see real payloads).
2. **Synergy data shape** — does the synergy endpoint give pairwise duo WRs for arbitrary pairs, or only "best duos" lists? Determines whether team-synergy scoring is real or gets cut to lane-matchup + comp-rules only.
3. **Shard size reality** — measure one real champion payload post-normalization; confirms the lazy-load budget and whether per-champ-role sharding is even necessary vs. one file per champion.
4. **Frontend hosting final call** — GH Pages vs. Cloudflare Pages (only matters if we want custom domain + tighter caching headers; decide in spec, zero cost either way).
5. **Repo naming/licensing** — PolyForm Noncommercial like reckon, or MIT like Roguemouse? (Portfolio-signaling question, not technical.)
6. **Carried from §8 into /spec as v1 requirements:** the `DraftStateProvider` interface (Manual + future LCU implementations), and shard prefetch-on-appearance in the frontend data loader.
7. **Personal API key registration** — write the product description (accurate: private draft-analysis tool for a small friend group; discloses LCU champ-select reads and low-volume Match-V5 usage for own-match results). Do this during /spec; it's free legitimacy and there's no reason to defer it.

## 10. Process sequence from here

```
[this doc] → smoke test (research, ~30 min) → /spec (locks decisions,
defines features F1–F6 against REAL payload shapes) → /plan → /implement
```

No project code before /spec. The smoke test is disposable curl commands run on the VPS, documented in a findings note that feeds the spec.
