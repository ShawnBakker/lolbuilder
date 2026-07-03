# Review Brief — lolbuilder spec & research audit (for Claude Code, run in repo root)

## Frame (read first, binding)
You are reviewing planning documents for a **private, noncommercial hobby tool** (League of Legends draft analyzer for a small friend group). This is NOT a startup evaluation, NOT a product/demand study. Do not produce KILL/KEEP verdicts, fundability scores, or market analysis — they are out of scope and will be discarded. You are an adversarial technical reviewer: your job is to find what is wrong, stale, internally inconsistent, or unverified.

Do not implement anything. Do not modify any file. Read + a small number of network probes only.

## Inputs (all in this repo)
- `docs/brainstorm/pick-analyzer-brainstorm.md` — decisions with reasoning (v2)
- `docs/brainstorm/smoke-findings.md` — empirical validation record
- `docs/spec/pick-analyzer-spec.md` — the spec under review
- `docs/decisions/decision-register.md` — decision summary with reversal criteria
- `CLAUDE.md` — operating rules

## Part 1 — Empirical re-verification (your unique advantage: run these, don't opine)
Rules: max 6 network requests total, sequential, ≥2 seconds apart, User-Agent "lolbuilder-spec-review". If a request fails, record the failure — do not retry-loop.

1. `https://ddragon.leagueoflegends.com/api/versions.json` → record latest version; confirm the 26.NN ↔ 16.NN.1 mapping claim against the current live patch.
2. `https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=<CURRENT 16.NN>&c=aatrox&lane=all&tier=emerald_plus&queue=ranked&region=all` → confirm: HTTP 200, JSON, `team_h` = [id, wr, d1, d2, pr, n] (or record the actual columns), per-role pairwise arrays present.
3. `https://lolalytics.com/lol/aatrox/build/q-data.json` → confirm: HTTP 200, JSON, Qwik `_objs` graph, and that `time`/`timeWin` (7 game-length buckets) are present. This claim carries the spec's F5 feature.
4. `https://lolalytics.com/lol/aatrox/counters/q-data.json` → spec checklist item PC-1: confirm reachability and that matchup tables (per-opponent WR + deltas) are present.
5. `https://lolalytics.com/lol/lulu/build/q-data.json` → spec PC-4: structure consistent with (3)?
6. Reserve the sixth request for whatever your findings make most valuable (e.g., a vslane counters variant).

## Part 2 — Spec internal-consistency audit
- Traceability: every AC in the spec must rest on either a validated finding (smoke-findings.md) or an explicit decision (register). List any AC resting on an unverified claim.
- Contradiction sweep across the four documents (e.g., cadence numbers, k values, patch formats, endpoint shapes).
- Feasibility flags: any AC you judge unimplementable or underspecified as written, with the specific gap.

## Part 3 — Adversarial decision review
For each register entry D1–D16: attempt a steelman counter-argument. Report only the ones where your counter-argument has real force (target: the 3–5 weakest decisions, not all sixteen). For each: the decision, your strongest case against it, and what evidence would settle the disagreement.

## Output contract (exactly this structure)
1. **Verification table**: | # | Claim | Status (Confirmed / Refuted / Changed — details) | Evidence (HTTP code, observed keys) |
2. **Traceability gaps**: ACs resting on unverified claims (or "none").
3. **Contradictions found**: (or "none").
4. **Contested decisions**: 3–5 entries max, format per Part 3.
5. **Top 3 risks in priority order** — your independent ranking, which will be compared against the register's "known weaknesses" section.

Do not pad. Absence of findings stated plainly ("none found") is a valid and useful result.
