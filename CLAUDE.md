# lolbuilder — CLAUDE.md

LoL draft analyzer + build planner. Private tool for a small friend group. TypeScript, pnpm.
Full context: `docs/brainstorm/pick-analyzer-brainstorm.md` (decisions), `docs/brainstorm/smoke-findings.md` (validated data contracts), `docs/spec/pick-analyzer-spec.md` (current spec).

## Process — HARD RULES

- Every feature follows /brainstorm → /spec → /plan → /implement → /review, one doc per phase in `docs/`. **No implementation code before its spec exists.** If asked to skip, push back once, citing this line.
- Validation discipline: define pass criteria BEFORE running any test or probe. One observation ≠ validation (cache artifacts, cached CDN responses, and lucky 200s are all documented instances in this repo's history). Verify one flagged positive AND one flagged negative by hand before trusting any measurement tool's output.
- Never add a test outside the CI gate.

## Data sources — HARD RULES

- **Advisory-only output framing.** Riot policy prohibits tools that "dictate decisions." We present data, sample sizes, and tradeoffs; never a single commanded pick. This is a design constraint, not tone.
- **Read-only everywhere.** No writes to any Riot surface (LCU included, when it arrives). No automation of client actions, ever.
- **Polite scraping:** sequential requests, ≥2s delay, honest User-Agent, full scrapes **≤2 per patch cycle** (patch day + one mid-patch refresh; ~4–5/month at the 14-day cadence — per-cycle is the invariant the trigger logic enforces). If lolalytics blocks us, we fall back (u.gg pattern → op.gg MCP), we do not evade.
- `ep=champion` on the mega API is **retired** — do not reintroduce it. Champion/build/counter data comes from route-loader q-data; synergy from `a1.lolalytics.com/mega/?ep=build-team`.
- No databases. The dataset is immutable per patch: pipeline → sharded JSON → GitHub Release. If you feel the pull toward a server or DB, a decision is being smuggled in — stop and surface it.

## Domain constants (misremembering these causes silent bugs)

- Patch translation: live `26.NN` ↔ DDragon `16.NN.1` ↔ lolalytics `patch=16.NN`. Three formats, one patch.
- Requests key champions by lowercase name (`c=aatrox`); responses key by numeric id. Data Dragon is the bridge. Internal keys diverge from display names (Wukong = `MonkeyKing`).
- Synergy payload columns come from the `team_h` header array — parse headers, never hardcode column positions.
- `time`/`timeWin`: 7 game-length buckets (games, wins). Bucket→minutes mapping is UNRESOLVED (spec open item) — do not invent boundary labels.
- Shrinkage: pseudo-count toward the role-baseline WR, mandatory, with **per-source k** (spec OI-4): synergy cells have no source floor (n=1 rows with 100% WR exist in live data) → k_synergy≈50; matchup cells arrive source-floored at n≥100 → smaller k_matchup, else a floor-passing cell is shrunk by a third (weight n/(n+50) = 0.67 at n=101). Exact values come from the OI-4 sensitivity sweep — do not hardcode a single global k.
- UI shows qualitative tiers + sample sizes, never bare decimals like "62.3%" — false precision is a product bug here.

## Normalizer — HARD RULES

- The q-data deserializer (Qwik `_objs` + base-36 refs) must **resolve refs at leaf level**: interning is mixed within a single payload — identical row shapes carry literal numbers in some rows and base-36 refs in others (observed 2026-07-02; produces NaNs if leaves go unresolved). Golden fixtures must cover both interning modes.
- Deserializer invariants **fail loudly and run post-resolution** (pre-resolution type checks false-alarm on ref leaves): root `_entry` resolves; `time`/`timeWin` present as objects keyed `"1"`–`"7"` — **not arrays** — with numeric games/wins, wins ≤ games; expected `team_h` columns. Golden-fixture tests in CI. Parser failure is a schema-change alarm, never a recoverable warning. Corrupt shards must not reach the scoring engine.

## Sub-agents

- Spawn Explore for exploratory reading (symbol hunting, subsystem mapping); reserve direct Read/Grep for known files.
- Every Task brief is self-contained: goal, inputs, output contract, what NOT to assume. Sub-agents see no conversation context.

## Environment

- Developed on Windows (PowerShell/VSCode). `.gitattributes` enforces LF (ps1 stays CRLF). Bash tool = Git Bash/POSIX; PowerShell for `.ps1`/Windows-native. Never `curl` in PowerShell (alias trap) — `curl.exe` or `Invoke-RestMethod`.
