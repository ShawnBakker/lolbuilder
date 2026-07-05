# Expansion decisions — hard-to-reverse axes, surveyed before the pressure arrives

**Date:** 2026-07-05. **Trigger:** operator question — "this may expand
beyond champ decisions; hard decisions need backing." Survey of the
codebase's irreversibility surface + two research passes on the axes that
warranted them. One finding was time-critical and already landed: the
calibration log's rating-provenance field (`context`: patch + k values),
added while the log was still empty — a context-less rating would have
made the first k-tune a silent dataset fork.

---

## Research pass 1 — the sanctioned-data landscape (the existential axis)

**Question:** if "larger" ever means "not just us," the lolalytics layer
cannot come along (explicit Riot policy clause, accepted only at personal
scale — see `policy-conflict-amendment.md`). What does the sanctioned path
actually look like?

**Findings:**

- **The sanctioned path exists and is well-trodden: a production API key
  plus Riot-API self-aggregation.** Requirements: a functioning app or
  demonstrable prototype, a product website, an application form, review
  by Riot developer relations (~20 business days currently). Production
  keys carry "much higher" rate limits suitable for public products,
  expandable for apps in good standing.
- **Aggregation is explicitly permitted** — developer policy allows
  aggregating player stats "with no specific players identified." The
  activity D2 ruled out was never the problem; the *personal-key rate
  limit* was.
- **The arithmetic inverts at production tier.** D2's kill-math was ~5.1M
  matches/patch at 0.83 req/s ≈ 140+ days. Rate limits are per-key and
  negotiated (an illustrative header example shows the 1,000-per-10s
  class); at even a sustained ~50 req/s, 5.1M match fetches ≈ **~30 hours
  per patch** — self-aggregation becomes feasible, which is the existence
  proof the big sites (op.gg/u.gg-class, operating as approved production
  apps) already provide.
- **The architectural news is good: the shard layer survives a re-source.**
  Self-aggregated output is still immutable per patch, so D4 (no DB,
  shards + Releases + Pages) holds; what changes is the pipeline's front
  half (fetch + aggregate instead of fetch + deserialize), and the
  monorepo already isolates source-specific code in `packages/qdata`.
  The swap seam exists today.
- **Honest costs:** the review gate (working prototype required — we have
  one), ongoing policy compliance (advisory-only framing is already the
  house posture), and real aggregation infrastructure (compute + interim
  storage for millions of raw matches per patch — a genuine engineering
  milestone, not a config change).

**Decision state:** research done, decision deferred — correctly. Nothing
triggers until expansion-to-others is actually wanted. The tripwire: **the
moment any feature implies users beyond the friend group, the data layer
re-source becomes the first milestone of that effort, not a follow-up.**

## Research pass 2 — the distributed-fleet update story

**Question:** helpers on friends' machines accrete features (calibration
now; matchup builds and live advisor are seams). What's the researched
update model, and what does auto-update actually cost?

**Findings — three tiers:**

1. **Manual zip (current):** fine at present fleet size; friction grows
   per release.
2. **Check-and-prompt (the recommended next step, mostly built already):**
   the AC-M7-14 protocol handshake already surfaces "helper is outdated"
   in the app with an explained banner. Completing this tier costs a
   version line on the Pages origin + a helper console message — **no new
   security surface at all**, because the helper never fetches or executes
   code; the human re-downloads the zip.
3. **True auto-update: a researched line we should not cross casually.**
   Tauri's built-in updater (the relevant one, since Tauri is M7's named
   destination) *mandates* signed update artifacts — a dedicated signing
   keypair where **losing the private key permanently strands the
   installed userbase**, separate from OS code signing. OS signing
   economics: an OV certificate is affordable but SmartScreen warnings
   persist until reputation accrues; an EV certificate buys immediate
   SmartScreen reputation at meaningfully higher cost. Auto-updating code
   on friends' machines is a supply-chain surface; if the Tauri
   destination ever ships, use its signed updater rather than hand-rolling
   anything, and treat the signing key like the lockfile token — a
   credential with a custody story.

**Decision state:** adopt tier 2 as the standing model (finish it whenever
convenient — it is one version-file and one log line); tier 3 only with
Tauri, only via its signed updater, never hand-rolled for the Node helper.

## The rest of the irreversibility surface (guarded or cheap)

| Axis | State |
|---|---|
| Rating provenance in append-forever stores | **Fixed this survey** (context field, landed before entry #1). General rule adopted: any number entering an accumulating store carries its provenance. |
| No-DB/no-server ceiling | Guarded — D4's reversal clause names the trigger (per-user writes). No research until a feature demands it. |
| Helper CORS origin (hardcoded, baked into every distributed copy) | **Action item: origin allowlist before the next helper.zip ships** — one-line change that makes a future domain migration a non-event instead of a fleet-wide break. |
| Shard/manifest contract (unversioned) | Safe while our frontend is the only consumer (wholesale per-patch regeneration). Add `schemaVersion` to the manifest the day a second consumer appears. |
| Helper↔frontend drift | Guarded — shared protocol constant, enforced. |
| Champion identity | Riot-canonical cid; slugs are source-local. Survives a re-source. |
| Pipeline request budget | ~46 min/scrape; 2–3× headroom before politeness bites. Monitor. |
| App.tsx accretion | Split naturally at the layout-width backlog item. |
| Process (two-pass review, phase gates, brief-lint) | Scales as-is; the docs chain is the expansion asset. |

## Sources

- [Riot Developer Portal — docs](https://developer.riotgames.com/docs/portal) & [FAQs](https://developer.riotgames.com/docs/faqs) — production key requirements, review process
- [Developer Portal Overview (Riot DevRel)](https://support-developer.riotgames.com/hc/en-us/articles/22698431229203-Developer-Portal-Overview) — approval flow, ~20 business days
- [LoL Developer API Policy](https://developer.riotgames.com/docs/lol) — aggregation permitted, no specific players identified
- [Hextechdocs: Rate Limiting](https://hextechdocs.dev/rate-limiting/) — per-key limits, illustrative header example
- [Tauri Updater (v2)](https://v2.tauri.app/plugin/updater/) & [Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/) — mandatory signed updates, key-loss consequence, OV/EV SmartScreen economics
