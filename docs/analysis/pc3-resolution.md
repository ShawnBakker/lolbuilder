# PC-3 Resolution — u.gg Fallback Documented (upgrade from captured-endpoint plan)

**Resolved by:** research (web search + verification), not a DevTools capture — the original PC-3 plan is superseded by a better answer.

## Finding

Rather than capturing a live u.gg endpoint URL (which would be a snapshot, subject to drift with no warning), the u.gg fallback is better served by referencing a **maintained, versioned, open-source client**:

- **Project:** [`kade-robertson/uggo`](https://github.com/kade-robertson/uggo) — TUI/CLI to pull LoL builds from u.gg
- **Library:** [`uggo-ugg-api`](https://crates.io/crates/uggo-ugg-api) on crates.io, currently **v0.6.1** (released Oct 2025)
- **License:** MIT
- **Maintenance signal:** ~12 published releases spanning Nov 2023 → Oct 2025, Renovate bot configured for automated dependency updates, active repo (516+ commits). This means the client has already survived multiple real u.gg endpoint-drift events and kept working — evidence of resilience a one-time capture can't provide.
- **Companion crate:** the same author publishes `ddragon` (Rust), a caching Data Dragon client — independent confirmation that this is a serious, ongoing project, not a one-off script.
- **Source access:** full request/response contract readable via docs.rs (`docs.rs/crate/uggo-ugg-api/0.6.1/source`) whenever the fallback needs to actually be implemented.

## Why this is a better answer than the original PC-3 plan

The original plan (DevTools capture of a live u.gg request URL) would have produced a single snapshot — correct today, silently stale whenever u.gg changes their contract, with no signal that it broke until our own pipeline failed. Referencing a maintained library instead means:
1. If u.gg's contract changes, `uggo-ugg-api`'s next release reflects it — we inherit maintenance instead of owning it.
2. If D3 ever needs to reverse to this fallback for real, the actual current contract is one `docs.rs` read away, not a re-capture.
3. It's a stronger reliability story than PC-2's op.gg MCP fallback, which is a tool-calling interface (not curl-able directly) with unconfirmed synergy-data coverage — worth noting the two fallbacks now have different reliability profiles.

## Suggested register/spec text (apply wherever convenient — non-blocking)

**Register, D3 fallback note — replace/append:**
> u.gg fallback (#1 in the chain) is documented via a maintained open-source client rather than a captured endpoint: `kade-robertson/uggo` (MIT, crates.io: `uggo-ugg-api` v0.6.1+, ~12 releases since Nov 2023). If D3 needs to reverse, the current request contract is readable from the library's published source rather than requiring re-capture. This is a stronger reliability profile than PC-2's op.gg MCP fallback (tool-interface only, synergy coverage unconfirmed).

**PC-3 status:** ✅ Resolved (upgraded from "capture a URL" to "reference a maintained client") — 2026-07-03.

## Remaining v1 close items (unaffected by this)
- PC-5 (Riot personal API key registration) — still open, operator task
- OI-2 (license) — already decided, MIT
