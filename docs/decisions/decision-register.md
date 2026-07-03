# Decision Register — lolbuilder (LoL Pick Analyzer & Build Planner)

Self-contained: no external conversation context required. Each entry: the decision, the reasoning, evidence status, and the condition that would reverse it. Project frame: **private, noncommercial hobby tool for a small friend group** — this is not a startup, not a product evaluation, and reviewers should not apply market/fundability rubrics.

Date: 2026-07-02 (register); amended same day post-review. Live patch 26.13 (Data Dragon 16.13.1).

Evidence labels: **[external constraint]** = policy/limit set by a third party; **[project empirical]** = observed live by this project; **[derived]** = arithmetic/estimate from labeled inputs; **[design]** = choice justified by structure, not observation.

---

**D1 — Personal-only, permanently; no "public pivot path" engineered.**
Why: the only viable aggregated-stats source (lolalytics) explicitly reserves its internal API for site visitors; Riot requires registration + production keys for public products. Going public would mean a re-source and partial rewrite, so designing a pivot path now is speculative complexity.
Evidence: lolalytics API notice (a3 subdomain) [external constraint]; Riot developer policies [external constraint, LLM-crosschecked ×2].
Reverses if: a sanctioned bulk stats source appears (e.g., an official aggregator API).

**D2 — Aggregated stats from lolalytics via two validated paths; Riot API carries zero stats.**
Why: Riot's Match-V5 is raw matches only. Self-aggregating statistically meaningful matchup cells needs ~5.1M matches/patch; at personal-key limits (20/s, 100/2min) that's ~140+ days vs a 14-day patch cycle — structurally infeasible. lolalytics pre-aggregates everything needed.
Evidence: rate limits [external constraint, LLM-crosschecked ×2]; matches-per-patch arithmetic [derived]; endpoints [project empirical] (see D3).
Reverses if: nothing realistic; the arithmetic is robust to generous assumptions.

**D3 — Exact source contracts [project empirical]: live smoke test + independent six-probe re-verification, both 2026-07-02 (see smoke-findings addendum):**
(a) Synergy: `a1.lolalytics.com/mega/?ep=build-team&v=1&patch=16.NN&c=<name>&lane=<lane>&tier=<tier>&queue=ranked&region=all` — clean JSON, self-documenting `team_h` header array [id, wr, d1, d2, pr, n], full pairwise duo WRs per teammate role, serves datacenter IPs with no special headers; tier filter proven to *filter*, not just parse (within-patch n drops when tightening tier — impossible from time drift).
(b) Champion/build/counters: `lolalytics.com/lol/<name>/build/q-data.json` (and `/counters/q-data.json`, incl. `?vslane=` cross-lane variants, empirically confirmed) — Qwik route-loader payloads containing baseline WR/PR/BR/n, per-rank daily series, item sets with wr/n, runes, skills, and `time`/`timeWin` 7-bucket game-length win data (objects keyed "1"–"7", not arrays); leaf values are interned inconsistently (literal or base-36 ref within one payload) — consumers must resolve refs at leaf level; served to datacenter IPs even though the HTML site is bot-walled.
(c) The previously documented `ep=champion` mega endpoint is RETIRED (returns an empty envelope); research documents describing it are stale.
(d) Requests key champions by lowercase name; responses by numeric id; Data Dragon bridges. Patch numbering: live 26.NN ↔ DDragon 16.NN.1 ↔ lolalytics 16.NN.
Reverses if: endpoints churn — fallback chain is u.gg CDN JSON, then op.gg MCP; sustained breakage >1 incident/month triggers downscoping the analytics half entirely (pre-committed criterion).

**D4 — No database. Pipeline emits immutable per-patch JSON shards, published as GitHub Releases.**
Why: the dataset is finite and immutable per patch; all reads are known in advance (≤10 champion-role shards per draft); rebuilds are wholesale. A DB answers concurrent-write questions this project doesn't have. Releases (not repo commits) because committing shards accrues an estimated 0.5–2.4 GB/year of dead git history.
Reverses if: per-user write features (saved drafts, history) ever enter scope.

**D5 — All infrastructure is GitHub Actions (cron pipeline) + GitHub Pages (static frontend). No VPS.**
Why: originally a VPS was planned for IP hygiene against bot walls; the smoke test showed every needed path serves datacenter IPs bare, removing the VPS's only load-bearing argument. GH Actions cron drift (≤40 min, occasional skips) is irrelevant at ~2 full pipeline runs per patch cycle. Standing cost: $0, zero servers to maintain.
Evidence: datacenter-IP openness [project empirical — limited: two IP contexts, one day; PC-7 replicates from GH's actual egress class].
Reverses if: lolalytics starts challenging datacenter/Microsoft IPs — fallback is running the scraper from a residential context on the same ≤2-per-patch cadence. Amended post-review: D5 rests on limited IP-class observations; PC-7 (GH Actions dry-run) is the pre-implementation replication, and the weekly AC-10 canary runs from the same IP class thereafter.

**D6 — Frontend is Vite + React static, not Next.js.**
Why: no SSR, no API routes, no auth exist in this architecture; Next.js would be complexity rent for features the design structurally cannot use. Also a tripwire: feeling the need for server routes signals scope creep.
Reverses if: D4 reverses.

**D7 — Bespoke, deliberately narrow Qwik q-data deserializer; no framework adaptation.**
Why: q-data payloads are Qwik's internal serialization (flat `_objs` array + base-36 index references). The fragility lives in *lolalytics'* Qwik version, which we neither control nor observe — vendoring Qwik's own deserializer synchronizes us to our dependency choice, not theirs, and breaks with worse diagnostics. The narrow job (~150 lines: resolve refs, extract ~10 tables) earns named invariants that fail loudly ("time/timeWin missing" beats a framework stack trace), golden-fixture tests from committed captured payloads, and a weekly CI refetch-and-diff drift alarm. Parser failure is treated as a schema-change alarm, never recoverable.
Upgraded post-review [project empirical]: interning is mixed within a single payload (identical row shapes carry literal values in some rows, base-36 refs in others) — resolution must be leaf-level, invariants run post-resolution, and fixtures cover both interning modes (spec AC-8/9/10).
Reverses if: a maintained community q-data extraction library with real velocity appears.

**D8 — Scoring: logit-space composition; consume lolalytics' precomputed normalized deltas (d1/d2); Bayesian shrinkage toward role baseline mandatory, with per-source k (k_synergy≈50; k_matchup smaller, set via OI-4 sensitivity sweep); output framed as a rating, not a probability.**
Why: summing raw WR percentage deltas is unbounded/unsound; logit space makes contributions additive. Live synergy data contains n=1 rows at "100% WR," making shrinkage non-optional [project empirical]. Amended post-review: matchup cells arrive pre-floored at n≥100 (min observed n=101), so the floor and shrinkage must not double-discipline the same cells — a global k=50 shrinks a floor-passing matchup cell by a third (weight n/(n+50) = 0.67 at n=101), flattening exactly the signal the tool exists to surface; hence per-source k. Pairwise models double-count correlated signals and miss whole-comp properties — so the composite is a ranking heuristic; the engine's API never emits "probability," and percentage display happens only in the UI beside its uncertainty treatment.
Reverses if: never for the framing; each k is tunable with documentation (OI-4).

**D9 — Early/mid/late derived from the 7 `time`/`timeWin` buckets, grouped by bucket index (default 1–2 / 3–4 / 5–7); minute labels blocked until bucket boundaries are verified (open item OI-1).**
Why: bucket→minutes mapping was not visible in captured payloads; inventing boundary labels would be manufacturing facts. Relative phase groups ship the feature; labels follow verification.
Amended post-review: bucket WR is conditional on the game *ending* in that bucket — a selection effect, not "strength during the phase" ("strong early" = "wins the games that end early"). The construct ships (it is what every stats site displays), but the conditional is named in the UI disclosure (AC-19) and the measure is sanity-checked against known scaling profiles before F5 ships (AC-16b: hyperscaler rising, lane bully falling).

**D10 — Honest-uncertainty UI: qualitative tiers + sample sizes; no bare decimals; stale-patch banner; visible "what this can't tell you" disclosure.**
Why: a "62.3%" will be trusted far beyond its calibration by the intended users (friends); false precision is a product bug, not a stats footnote.

**D11 — Draft input goes through a `DraftStateProvider` interface from v1 (ManualProvider now; LCU champ-select auto-fill provider in v2). Hard lines: read-only against every Riot surface, advisory-only output framing.**
Why: the seam costs ~nothing now and prevents a UI rewrite when LCU lands. Riot's codified policy prohibits tools that create unfair advantage, remove, or *dictate* decisions — "advisory, never a commanded pick" is a design constraint. Read-only (no auto-pick/auto-accept) is the boundary observed by tolerated tools (Blitz/Porofessor class); "tolerated" is an enforcement-behavior inference, not codified, and is treated with according humility.

**D12 — Register a Riot *personal* API key now despite ingesting no Riot stats.**
Why: personal keys need no verification, suit "developer or small private community," don't expire like 24h dev keys, and the product registration doubles as the LCU-usage disclosure Riot's client-API policy expects. Also sanctions the v2 calibration feature (fetching one's own match results, a few requests/day). Personal keys get no rate-limit increases — explicitly does NOT reopen self-aggregation (D2 stands).

**D13 — Polite-scraper posture: sequential requests, ≥2s delays, honest User-Agent, full scrapes ≤2 per patch cycle (patch day + one mid-patch refresh; ~4–5/month at the 14-day cadence), resume-from-cache on re-runs. If blocked: fall back, never evade (no rotating proxies, no fingerprint spoofing).**
Amended post-review: the earlier "≤3×/month" phrasing didn't close arithmetically against the project's own 14-day-cycle numbers (2 patches/month × 2 runs = 4); per-cycle is the invariant the trigger logic can actually enforce (AC-5).

**D14 — Zero project-specific Claude Code skills at day zero.**
Why: a separate tooling audit (same week) concluded friction lives in *activation* of existing tooling, not tooling quantity. The first genuine skill candidate is the deserializer-drift recovery playbook — written after the first real incident, from its evidence.

**D15 — Team-aware itemization is a rule layer over the stats-based build (anti-heal ≥2 healers, MR/armor vs AP/AD skew, anti-shield, tenacity vs CC), with rules stored as data (JSON) carrying their own trigger explanations.**

**D16 — Process: brainstorm → empirical validation gate (smoke test) → spec → plan → implement, one doc per phase; external LLM verification uses self-contained briefs only.**
Why: the research phase produced confidently wrong endpoint documentation that only live probing falsified; an earlier external verification imported an inapplicable evaluation rubric (startup KILL/KEEP framing) purely from adjacent-document contamination. Both failure modes are now structural rules: empirical gates between research and spec; verifiers receive only the brief.

---

## Known weaknesses (pre-stated for reviewers)
1. Single aggregated-stats vendor (lolalytics). Mitigated by dual paths + fallback chain + downscope criterion, not eliminated.
2. q-data payload format is framework-internal — the top maintenance risk. Mitigated by D7's alarms; not preventable.
3. Composite score validity is heuristic-grade (D8's own admission). Mitigated by framing + UI; a calibration feature (v2) would measure it empirically.
4. ToS posture on lolalytics is gray for a private tool and is accepted with eyes open (D1, D13); it is the reason D1 is permanent.
5. *(Added post-review.)* D5's "datacenter IPs are served bare" generalizes from limited observations (two IP contexts, one day) — a tension with the project's own one-observation rule. Mitigated by PC-7 (full dry-run from GH Actions' actual egress class before implementation opens) and the weekly AC-10 canary from the same IP class thereafter; not eliminated until both have run.
6. *(Added post-review.)* Phase buckets measure win rate conditional on when the game *ended* — a selection effect no sample-size annotation fixes. Mitigated by naming the conditional in the UI disclosure (AC-19) and sanity-checking the measure against known scaling profiles before F5 ships (AC-16b).
