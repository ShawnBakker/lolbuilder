# Register Amendment — Explicit Riot Policy Conflict with D2/D3 (found during PC-5)

**Date:** 2026-07-03, during/after PC-5 (personal API key registration)
**Severity:** Documentation-accuracy amendment, not an engineering change. No code changes implied.

## Finding

Riot's General Policies (agreed to as a condition of the personal API key registered in PC-5) explicitly state, under "Please Don't":

> Scrape data from undocumented endpoints or any other sources outside of the provided Riot API Endpoints and other documented Third Party Developer Tools. (Except where otherwise noted in any official exceptions, if any.)

D2 and D3 — the project's core data-sourcing decisions — are exactly this: lolalytics' internal `mega/?ep=build-team` API and Qwik `q-data.json` route loaders are neither part of the Riot API nor a documented/sanctioned Third Party Developer Tool.

## What this does and does not change

**Does not change:**
- D2's feasibility arithmetic (self-aggregation impossible at personal-key rate limits) — the practical option set is unchanged.
- The engineering: no code, no architecture, no data source is modified by this finding.
- The project's operating posture: private, unlisted, personal-use-only, polite-scraping (D13), which was always the risk mitigation — that mitigation is unaffected.

**Does change:**
- **The precision of the risk language.** Prior register text (D1, known-weakness #4) characterized this as a "gray area" resting on lolalytics' own private-API notice. That understated it. This is not gray — it's an explicit, named prohibition in the policy governing the very key this pipeline's registration now operates under. The project's posture should be described as **"operating against a stated policy clause, with enforcement risk assessed as low due to zero public visibility and personal-only scale"** — not as ambiguous or unclear. Precision here matters because this project has held itself to exactly this standard everywhere else (the OI-3 exhibit, the interning correction, the archive-vs-serving incidents) — softening the language on this one finding would be inconsistent with that discipline.

## Recommended text updates (non-blocking, apply when convenient)

- **Register D1:** amend "no public pivot path" reasoning to cite this clause directly, not just lolalytics' own notice.
- **Register known-weakness #4:** reword from "ToS gray area" to "operates against an explicit Riot policy clause; risk mitigation is scale/visibility, not compliance."
- **README posture block:** if it currently says "gray area" or similar, tighten to name the specific clause and the specific mitigation (private, small-scale, low visibility) rather than imply ambiguity that doesn't exist.

## Available next step (operator's call, not urgent)

The policy names its own escape hatch: *"If you have an idea that you think might fall within a gray area, feel free to ask us in your project's application... post your question as an App Note."* Since the personal key is now registered, this channel is available. An App Note could ask directly whether a private, non-commercial, small-scale draft-analysis tool sourcing aggregate third-party stats falls under an unstated exception. This would convert an assumed-low-risk posture into an actual answer. Purely optional — the project can also simply continue on the documented-risk-accepted basis, now described accurately.

## Cross-check against adjacent clauses (gut-check, no new findings)

- "Create alternatives for official skill ranking systems (MMR/ELO calculators)" — does not apply; `PickScore` rates draft picks, not summoner/player skill.
- "Shame players" / "evaluate other players" — does not apply; no summoner lookups, no player-level data at all.
- "Utilize methods to connect to other League of Legends systems... not included in third party tools" — relevant to the planned v2 LCU provider (M7), but D11 already commits to approved-endpoints-only, read-only — this clause reinforces an existing constraint rather than surfacing a new one.

**Status at v1.0.0 tag:** PC-5 approved (standard approval, no App Note filed); project continues on documented-risk-accepted basis with the language corrections applied to register D1, known-weakness #4, and the README.
