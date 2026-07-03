# Verification Brief — LoL Draft-Analysis Tool, Brainstorm v2 Claims Audit

## Instructions to the verifier

You are auditing factual claims underlying a **planning document for a private, non-commercial hobby tool** (a League of Legends draft analyzer for a small friend group). This is NOT a startup evaluation, NOT a demand study, and NOT a product pitch. Do not assign fundability scores, KILL/KEEP verdicts, or market judgments — they are out of scope. Your only job: for each claim below, mark it **Confirmed / Refuted / Partially correct / Unverifiable-by-LLM**, cite a primary source URL where possible, and note corrections.

If a claim concerns the live behavior of an undocumented web endpoint, mark it **Unverifiable-by-LLM** rather than guessing — those claims are settled empirically by the project's own smoke test, and a confident-sounding non-answer is worse than a flagged gap.

Current context: July 2026. League of Legends patches ship on a 14-day cycle (format YY.NN, e.g., 26.13).

## Claims to audit

**A. Riot API key tiers**
1. Riot offers three key tiers: development keys (expire every 24 hours, testing only), personal keys, and production keys.
2. Personal keys can be registered without a verification process, are intended for products serving "just the developer or a small private community," require a detailed product description, and are NOT eligible for rate-limit increases.
3. Production keys require product verification and typically a working prototype, and are intended for large communities or the public internet.
4. Default rate limits for development/personal keys are 20 requests/second and 100 requests per 2 minutes.

**B. Riot API data shape**
5. Match-V5 provides raw per-match data (participants, timelines) but NO pre-aggregated matchup, synergy, or build win rates. Any aggregate must be computed from individual matches.
6. Consequence check (arithmetic, not sourcing): at ~0.83 sustained requests/sec (100 per 120s) and 2 requests per match, ingesting ~5.1M matches takes on the order of 140+ days — incompatible with a 14-day patch cycle. Verify the arithmetic and the premise that ~1,000 games per matchup cell are needed for a ±3% Wilson interval at 95% confidence.

**C. League Client (LCU) — separate from the keyed API**
7. The LCU uses no API key: the client runs a local HTTPS server on a random port with credentials in a lockfile in the install directory; requests authenticate as user `riot` + lockfile password against a self-signed certificate.
8. Riot's stated LCU policy: developers must contact/register with Riot before *releasing* an application using the League Client API, only endpoints on an approved list are permitted, and Korea is excluded from LCU applications.
9. `/lol-champ-select/v1/session` exposes live champ-select state (ally picks/bans/positions; enemy picks as revealed), and a local websocket provides event-driven updates. Enemy role assignments are NOT exposed.
10. Read-only champ-select tools (e.g., Blitz, Porofessor, op.gg desktop) operate in a tolerated category; automation of client actions (auto-pick/auto-accept) is prohibited.

**D. Game Client API (in-game, distinct from both above)**
11. Riot officially documents a local in-game API at `https://127.0.0.1:2999/liveclientdata/allgamedata` (no authentication) exposing live player items, levels, and events.

**E. Static data**
12. Data Dragon (`ddragon.leagueoflegends.com`) is keyless, CORS-enabled, versioned via `/api/versions.json`, and can lag live patch deployment by up to ~48 hours. Community Dragon supplements gaps (exact item stats, assets).
13. Internal champion keys diverge from display names in places (e.g., Wukong = `MonkeyKing`), and Data Dragon directories use legacy `NN.NN.1` version naming despite the live `YY.NN` patch format.

**F. Third-party aggregators (mark live-endpoint specifics Unverifiable-by-LLM as needed)**
14. lolalytics has no sanctioned public API; community projects consume internal JSON endpoints (reported: `ax.lolalytics.com/mega/` for champion/matchup data, `a1.lolalytics.com/mega/` for synergy), and lolalytics asserts via an API notice that these are private and not for third-party use.
15. lolalytics payloads reportedly include game-length-bucketed win data (early/mid/late derivable without Riot timeline data). [Live shape: Unverifiable-by-LLM — flag, do not guess.]
16. u.gg has no sanctioned public API; champion stats are served from static CDN JSON (reported host pattern `stats2.u.gg`) whose version integers churn, breaking hardcoded paths.
17. op.gg publishes an MCP (Model Context Protocol) server as a sanctioned programmatic interface, with thinner data than lolalytics.

**G. Methodology**
18. Summing raw win-rate percentage deltas across matchups/synergies is mathematically unsound (can exit [0,100]); working in log-odds (logit) space makes contributions additive and bounded after inverse-transform.
19. Pairwise ("bag of pairs") draft models double-count correlated signals and cannot represent whole-composition properties (e.g., zero frontline, all-physical damage); their outputs are ranking heuristics, not calibrated win probabilities.
20. Bayesian shrinkage toward a prior (pseudo-count on the order of k≈50) is a standard, appropriate treatment for low-sample matchup cells.

## Output format

| # | Claim (short) | Status | Primary source URL | Corrections / notes |
|---|---|---|---|---|

After the table, add a short section: **"Claims most likely to be wrong or stale"** — rank the 3 claims you'd re-verify first and say why.
