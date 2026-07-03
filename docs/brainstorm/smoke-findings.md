# Smoke Test Findings (PARTIAL) — 2026-07-02, patch 26.13 / internal 16.13

## Verdict so far: PARTIAL PASS — synergy contract fully validated; champion payload (matchups + time buckets) still unverified

## Validated (remote, datacenter IP — VPS should re-confirm cheaply)

### Synergy endpoint — CONFIRMED WORKING
```
GET https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=16.13&c=aatrox&lane=all&tier=all&queue=ranked&region=all
```
- HTTP 200, ~8.8 KB, JSON. **No browser headers required** — succeeded with a bare fetch from a datacenter IP. Host is genuinely open.
- Captured live from browser DevTools (2026-07-02) and independently fetched.

### Payload schema (actual, not provisional)
```json
{
  "team_h": ["id","wr","d1","d2","pr","n"],
  "team": { "jungle": [[64,48.03,-0.8,0.37,6.24,21680], ...],
            "middle": [...], "bottom": [...], "support": [...] },
  "cache": "cached",
  "response": { "valid": true, "duration": "1" }
}
```
Column semantics: `id` = numeric champion id, `wr` = duo win rate %, `d1`/`d2` = precomputed normalized synergy deltas (site-defined: Delta 1 vs. counter-average baseline; Delta 2 vs. normalized expected WR; Synergy Delta = pair WR − mean of individual WRs), `pr` = pick rate %, `n` = games together.

### Consequences locked in for /spec
1. **Team-synergy scoring is REAL** — full pairwise duo WRs for every teammate in every other role, not top-N. (Brainstorm open question #2: answered.)
2. **Deltas ship precomputed** — scoring engine can consume `d1`/`d2` rather than deriving normalization; our logit layer sits on top.
3. **Responses are numeric-id keyed; requests are lowercase-name keyed** (`c=aatrox`) — Data Dragon provides the id↔name↔display bridge. Concrete normalizer requirement. (This also explains the earlier 404s: old contract used `cid=<id>`.)
4. **Shrinkage necessity visible in the data**: long tail includes rows like `[267, 100, 61.58, 73.07, 0, 1]` — 100% WR from n=1. k≈50 pseudo-count treatment confirmed as mandatory, not optional.
5. **Header array pattern (`team_h`)** — payloads are self-documenting; normalizer should parse header arrays rather than hardcoding column positions (cheap robustness against column reordering).
6. `patch=16.13` internal numbering confirmed in a live captured request.

## NOT validated — known instrument artifact (recorded so no one trusts it later)

Attempted `ep=champion&lane=top` remotely; response body was byte-identical to the synergy payload and the destination URL metadata showed `ep=build-team&lane=all` with alphabetized params — a fetch-tool cache/normalization artifact, NOT server behavior. **No conclusion about `ep=champion` may be drawn from that response.** Epistemics note: identical body + mismatched destination URL = the instrument answered, not the endpoint.

## Remaining unknowns (VPS or browser settles these)

1. **Champion payload contract** — matchup arrays + game-length buckets (`time`/`timeWin`/`graph` or successors). First hypothesis to curl from VPS (no cache layer):
   `https://a1.lolalytics.com/mega/?ep=champion&v=1&patch=16.13&c=aatrox&lane=top&tier=all&queue=ranked&region=all`
   If 404/empty: browser hard-reload (Ctrl+Shift+R) on the Aatrox build page with `lolalytics` + Fetch/XHR filters, and capture other `mega/?ep=...` requests (there may be several `ep` values: counters, items, graphs).
   **The early/mid/late feature depends entirely on this.**
2. **Filter surface via curl** — does `tier=emerald_plus` work directly (captured request used `tier=all`)? One-param experiment.
3. **VPS treatment** — re-run the validated synergy curl from the Oracle box; confirm the open-host finding holds for its IP.
4. **Second champion consistency** (`c=lulu&lane=support`).
5. u.gg pattern capture (fallback documentation) + op.gg MCP existence check — unchanged from runbook.

---

# UPDATE (same day, later session): VERDICT → FULL PASS (one checkbox pending)

## Champion payload: FOUND — via Qwik route-loader q-data.json, not the mega API

`GET https://lolalytics.com/lol/<champ>/build/q-data.json` → HTTP 200, application/json,
**served to datacenter IPs** (the bot wall guards the HTML page, NOT this path).
`ep=champion` on a1 returns an empty envelope — that endpoint is retired; the site SSRs
champion data into pages and exposes it via route loaders.

### Confirmed contents of build-route q-data (Aatrox top, 16.13):
- **`time` / `timeWin`: 7 game-length buckets (games + wins) → early/mid/late feature CONFIRMED**
- Baseline WR/PR/BR/n + tier grade, with per-rank-bracket daily time series (trailing ~35 days)
- Item sets (start/core/4th/5th/6th) with wr + n; runes; skill order; objective/side stats
- Counter strong/weak refs (full tables live on the counters route)

### Counters route (via search confirmation):
- Per-opponent: matchup WR, Delta 1, Delta 2, avg-opponent-WR baseline
- **100-game minimum floor enforced at source**
- **`vslane` param exists → cross-lane matchup tables (flex-pick coverage, unplanned bonus)**
- [x] DONE (2026-07-02 six-probe review, probe 4 — see addendum below): HTTP 200, 81 matchup rows
  {cid, vsWr, n, d1, d2, allWr, defaultLane}, min n=101. PC-1 closed.

## Final data-source map (two validated paths = real redundancy)

| Path | Format | Stability profile | Access |
|---|---|---|---|
| `a1.lolalytics.com/mega/?ep=build-team...` | Clean JSON, self-documenting headers | Stable format, endpoint surface churns (cid→c, ep=champion retired) | Open, no headers, datacenter-OK |
| `lolalytics.com/<route>/q-data.json` | Qwik serialized object graph (`_objs` + base-36 refs) — needs deserializer | URL scheme very stable (path-derived); payload format framework-internal, fragile | Open, datacenter-OK despite HTML bot wall |

## Consequences for /spec
1. Normalizer needs a **Qwik q-data deserializer** module (mechanical: flat array + base-36 index refs) — this is the main new engineering line-item
2. Pipeline strategy: q-data as primary (one URL per champ/role/page-type), mega build-team for synergy (cleaner), each a fallback for the other where data overlaps
3. Cross-lane matchups (vslane) available → DraftState scoring can handle flex/off-role assignments
4. Source-level 100-game floor + our k≈50 shrinkage = two-layer sample discipline
5. Payload-format fragility is the top maintenance risk (framework version bumps) — normalizer must fail loudly on shape drift, per the §6 maintenance forecast


---

# ADDENDUM (2026-07-02, post-review): independent re-verification

A six-probe adversarial review (Claude Code, from repo, distinct datacenter context) re-confirmed all endpoint
claims and upgraded three findings:
1. **tier filter proven to FILTER, not just parse**: jungle Lee Sin n=7,905 at emerald_plus vs 21,680 at all, same patch.
2. **vslane empirically confirmed** (was search-level only): `?vslane=middle` flips route state + opponent set, min n=110.
3. **Interning is mixed within a payload**: identical row shapes carry literal numbers in some rows, base-36 refs in
   others — deserializer must resolve at leaf level; fixtures must cover both modes. `time`/`timeWin` are objects
   keyed "1"–"7" (not arrays). Counters rows: {cid, vsWr, n, d1, d2, allWr, defaultLane}, min n=101.
The "VPS should re-confirm" framing earlier in this file is obsolete — no VPS exists in the locked architecture (see spec §3).