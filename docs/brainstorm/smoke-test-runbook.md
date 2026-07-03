# Smoke-Test Runbook — Data Source Validation Gate

## Pre-probe findings (2026-07-02, from datacenter IPs — read before capturing)

- DDragon latest = `16.13.1` (live patch 26.13). The 26.NN ↔ 16.NN.1 translation is confirmed fact.
- lolalytics numbers patches internally as **16.13** — expect that format in captured params.
- `ax.lolalytics.com` responds *without* a bot challenge, but every guessed param shape 404'd (`patch=26.13`, `patch=30`, `patch=16.13`). The endpoint contract has changed from the researched shape — capture, don't guess.
- Main `lolalytics.com` HTML is bot-walled against datacenter IPs. Browser DevTools is the only capture instrument. Watch how the VPS is treated (Step 6).
- Site is built on Qwik — data may arrive via route-loader `q-data.json` requests rather than a separate API host. Both patterns are curl-able once captured.
- Synergy data exists with published semantics (Synergy Delta = pair WR − mean of individual WRs; counter Delta 1/Delta 2 normalizations) — record which payload carries it.

**Position in process:** brainstorm (converged) → **[this]** → /spec
**Where:** Oracle Cloud VPS (the IP the pipeline will actually use — testing from anywhere else validates nothing about our real posture)
**Time box:** ~30–45 minutes
**Framing:** the URLs below are *hypotheses under test*, sourced from community observation and two crosschecks that both rated them "most likely wrong or stale." A 404 is a finding, not a failure.

## Ground rules

- Honest User-Agent, sequential requests, ≥2s between them. This is a handful of requests total — well under any reasonable politeness bar.
- If a direct URL 4xxs, the fallback investigation method is: open lolalytics.com in a browser, open DevTools → Network, load one champion page, and record the real request shapes. Do not iterate blindly against the server.
- Everything gets recorded in the findings template at the bottom — the /spec is written against that document, not against memory.

## Step 0 — Current patch (also tests Data Dragon freshness)

```
curl -s https://ddragon.leagueoflegends.com/api/versions.json | jq '.[0]'
```

Record: DDragon's latest version vs. the actual live patch (check client or patch notes). This is our first real datapoint on the "~48h lag" lore.

## Step 1 — lolalytics champion/matchup payload (claims F14, F15)

Aatrox top, current patch (Aatrox champion id = 266):

```
curl -s -A "personal-draft-tool-smoketest" \
  "https://ax.lolalytics.com/mega/?ep=champion&p=d&v=1&tier=emerald_plus&queue=420&region=all&patch=<PATCH>&cid=266&lane=top" \
  -o aatrox_top.json -w "HTTP %{http_code}, %{size_download} bytes\n"
```

Then inspect structure without drowning:

```
jq 'keys' aatrox_top.json
jq '.time, .timeWin, .graph | if . then "present" else "MISSING" end' aatrox_top.json
```

**Pass criteria (map to brainstorm §2 decision tree):**
- [ ] HTTP 200 with JSON body (not Cloudflare challenge HTML — check `file aatrox_top.json`)
- [ ] Matchup data: per-opponent win/game counts, identifiable lane segmentation
- [ ] Game-length buckets (`time`/`timeWin`/`graph` or equivalent) — **the early/mid/late feature lives or dies here**
- [ ] Build/item data with win rates (core builds, situational items)
- [ ] Record actual payload size (informs shard-size question, brainstorm §9.3)

## Step 2 — lolalytics synergy payload (brainstorm §9.2)

```
curl -s -A "personal-draft-tool-smoketest" \
  "https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=<PATCH>&c=aatrox&lane=top&tier=emerald_plus&queue=ranked&region=all" \
  -o aatrox_synergy.json -w "HTTP %{http_code}, %{size_download} bytes\n"
jq 'keys' aatrox_synergy.json
```

**Key question:** pairwise duo WRs for *arbitrary* ally pairs, or only top-N "best duos"? Arbitrary → team-synergy scoring is real. Top-N only → synergy term gets cut from the composite score, and the spec shrinks accordingly.

## Step 3 — Repeat Step 1 for one more champion/role

One data point can't distinguish "endpoint works" from "that one URL happens to be cached." Pick a different role (e.g., Lulu support, cid=117, lane=support) and confirm the same structure.

## Step 4 — u.gg fallback probe (claim F16)

Browser DevTools on a u.gg champion page → Network tab → record any `stats2.u.gg` (or successor) JSON requests: full URL pattern, where the version integer sits, payload structure at `jq 'keys'` depth. Goal is a *documented* fallback path, not a working integration.

## Step 5 — op.gg MCP existence check (resolves crosscheck disagreement F17)

Verifier 1 confirmed it exists (GitHub); verifier 2 couldn't. Two minutes: find the repo, confirm it's real and maintained, skim the tool list for whether it exposes matchup/build stats or only summoner/profile data. Fallback #3 is only a fallback if it carries the data we need.

## Step 6 — Politeness / blocking observation

Note whether any request pattern triggered a challenge, rate-limit header, or block during the session. Zero blocks across ~10 requests ≠ proof of safety, but a block during *this* gentle session would move "hostname rotation / Cloudflare tightening" from tail risk to near-term expectation.

## Findings template (fill in, becomes /spec input)

```markdown
# Smoke Test Findings — <date>, patch <PATCH>, from Oracle VPS

## Verdict: [FULL PASS / PARTIAL — buckets missing / PARTIAL — synergy limited / FAIL — blocked]

| Step | Result | Evidence |
|---|---|---|
| 0. DDragon freshness | live=__, ddragon=__, lag=__h | |
| 1. Champion payload | HTTP __, __KB, buckets: Y/N, matchups: Y/N, builds: Y/N | key list |
| 2. Synergy payload | HTTP __, arbitrary-pair: Y/N | key list |
| 3. Second champion | consistent: Y/N | |
| 4. u.gg pattern | URL pattern recorded: Y/N | pattern |
| 5. op.gg MCP | exists: Y/N, carries matchup data: Y/N | repo link |
| 6. Blocking | none / challenge / block | |

## Payload field map (actual names → our domain types)
<real field names for matchup arrays, bucket keys, build objects —
this section directly rewrites the provisional ChampionMatchup/byPhase types>

## Consequences for /spec
<which features survive as designed, which get cut/redefined per §2 decision tree>
```
