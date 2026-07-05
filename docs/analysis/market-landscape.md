# Market-landscape report — in-repo grounding pass (2026-07-05)

**Input:** an operator-provided competitive research report (Facecheck +
category: Blitz, Mobalytics, Porofessor, DraftGap, LoLDraftAI, iTero,
buildzcrank, Nemo). **This pass maps the report onto the project's actual
decision record** — the same outside-research → in-repo-grounding division
as every review cycle.

## The frame correction (load-bearing)

The report evaluates lolbuilder as a competitor seeking adoption — "growth
driver," "adoption gap," "position lolbuilder." **D1 says lolbuilder does
not compete: personal-only, permanently**, and the PC-5 policy amendment
priced expansion as a data-layer re-source plus rewrite behind a named
tripwire (`expansion-decisions.md`). So the report's Stage-1/Stage-2 GTM
recommendations are answers to a question the register has already
declined. Its real value is different and genuine: **it is the demand
landscape for the expansion tripwire** — if that tripwire ever fires, this
is what the market looks like. Filed accordingly, next to the sanctioned-
data research it would activate alongside.

## The one recommendation that requires a register amendment (not a feature add)

**One-click build/rune import** — the report calls it "stays
read-only/advisory (user still confirms), low policy risk, recommend
building." Two things are true and one is wrong:

- TRUE: Riot's policy tolerates it (Blitz/Facecheck-class tools push rune
  pages via the LCU openly), and it is the category's most-praised feature.
- TRUE: technically small — the LCU exposes rune-page write endpoints; the
  helper could do it.
- **WRONG for this project as constituted: a user-confirmed write is still
  a write.** The hard line (D11, CLAUDE.md, the helper's read-only-by-
  construction tests, INSTALL.md's promises to friends, the M7 spec's
  §7) is "no writes to any Riot surface, LCU included, ever" — OUR line,
  deliberately stricter than Riot's. Adopting one-click import means
  amending D11 (e.g., to "no gameplay-affecting automation; explicit
  user-initiated configuration writes permitted"), rescoping the helper's
  write invariants a second time, and rewriting the friend-facing "it
  cannot change anything" promise honestly. That is a values decision at
  register level — possibly a reasonable one (it is the same shape as the
  AC-C-1b rescope: sharpen what the guarantee always meant vs. what it
  literally said) — but it must be DECIDED, not slid into as a feature.
  **Status: surfaced, not recommended either way. Operator's call, only
  if/when it matters.**

## Factual corrections to the report (about us)

- "Post-game breakdown — already in lolbuilder's stated scope": **not so.**
  Scope is champ-select analysis + calibration; a post-game breakdown has
  never been specced. (Match-V5 makes it *possible*; nothing has decided it.)
- "Calibration is table stakes — LoLDraftAI already markets it": half
  right. LoLDraftAI's calibration is **population-scale** (millions of
  training games). Our own research pass (`calibration-research.md`)
  found NO tool doing what G2 does: **personal** prediction-vs-own-
  outcomes with CI-first honesty. The report is correct that calibration
  won't drive adoption — and irrelevant to why we built it (G1: is our own
  engine trustworthy). "Built for integrity, not growth" was already the
  design, not a concession.

## What the report confirms (no action needed)

- **The refusals are validated by the market's failures:** ads, Overwolf
  bloat, crashes, deceptive billing, and "wrong data" distrust are the
  category's documented pain — all structurally absent here by decisions
  made long before this report (static site, tiny local helper, no ads,
  no overlay, advisory-only).
- **Scouting and overlays stay refused:** the report's own policy reading
  (no historic Riot IDs, no MMR calculators, no drawing-conclusions-for-
  you) matches the PC-5 adjacent-clause cross-check verbatim. Named-player
  scouting remains out; the hover-display scope line stays held.
- **LCU risk framing matches ours:** maintenance risk, not ban risk
  (Vanguard FAQ: LCU "still expected to work," unsupported) — which is
  exactly why the helper fails loud on drift and degrades to manual.
- **"Does this even work?" distrust** is the market echo of the exact
  question calibration answers — for us, about our own tool.

## Disposition

No feature, spec, or plan changes from this report. Two durable outputs:
this grounding record, and the one surfaced decision (one-click import =
D11 amendment question, dormant until wanted). The report's competitive
detail is preserved in the operator's copy; this doc records what survived
contact with the register.
