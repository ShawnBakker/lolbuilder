# lolbuilder

A League of Legends draft analyzer and build planner, built as a **private, noncommercial tool for a small friend group**. Enter a 10-champion draft; get an advisory pick assessment (overall + early/mid/late), the highest-win-rate build vs. your lane opponent, and rule-based counter-itemization vs. the enemy composition.

**Status:** pre-v1, under construction. The build follows a phased doc chain — every phase reviewed by a context that didn't write it:

| Phase | Document |
|---|---|
| Brainstorm | `docs/brainstorm/pick-analyzer-brainstorm.md` |
| Empirical validation | `docs/brainstorm/smoke-findings.md` |
| Spec | `docs/spec/pick-analyzer-spec.md` |
| Decision register | `docs/decisions/decision-register.md` |
| Plan (current phase) | `docs/plan/pick-analyzer-plan.md` |

## Posture — stated up front

These are design commitments from the decision register (D1, D11, D13), not aspirations:

- **Advisory-only output.** Riot policy prohibits tools that dictate decisions. This tool presents data, sample sizes, and tradeoffs — never a single commanded pick. Scores are ranking heuristics and are framed as such; the UI shows qualitative tiers with the sample sizes they rest on, never bare false-precision decimals.
- **Read-only against every Riot surface.** No automation of client actions, ever. (LCU champ-select *reading* is a planned v2 feature, disclosed via Riot personal API key registration.)
- **Polite data collection.** Aggregated statistics come from lolalytics: sequential requests, ≥2-second delays, an honest User-Agent, at most 2 full scrapes per patch cycle, resume-from-cache on re-runs. If blocked, the project falls back to documented alternatives — it does not evade (no proxies, no fingerprint spoofing).
- **Personal-only, permanently.** No public deployment, no accounts, no user data. The data dependency is structurally unsanctioned for public products, so this stays a friends tool by design (register D1).

## Stack

TypeScript pnpm monorepo: `apps/web` (Vite + React static frontend), `apps/pipeline` (Node fetch/normalize scripts), `packages/core` (pure scoring engine), `packages/qdata` (payload deserializer + golden fixtures), `packages/types` (domain types). No servers, no database: the pipeline emits immutable per-patch JSON shards on GitHub Actions; the frontend is static on GitHub Pages.

## License

Undecided (tracked as OI-2 in the spec). Until a license file lands, all rights reserved.

---

*lolbuilder isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and League of Legends are trademarks or registered trademarks of Riot Games, Inc.*
