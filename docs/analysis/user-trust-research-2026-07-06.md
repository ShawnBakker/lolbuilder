# User-trust research — companion-app build/draft recommendations (outside pass, 2026-07-06)

**Provenance:** outside-produced research report, delivered by the
operator 2026-07-06. Recorded VERBATIM below the integration note —
nothing in the report body is CC-edited. The report self-declares its
source caveats (thin organic-Reddit base; competitor-marketing
benchmarks; small-n Trustpilot samples; vendor claims unverified) —
treat findings as directional, per its own Caveats section.

**What this is not:** this is NOT one of the three seam review passes
(matchup-builds brief, F8 spec, intermediate-outcome brainstorm). Those
remain open. This is demand-side grounding — the user-sentiment
counterpart to `market-landscape.md`'s competitor grounding.

---

## In-repo integration map (CC, 2026-07-06 — index, not review)

Where each finding lands, and the one hard-line collision:

1. **Selection-bias distrust (report finding 1, §a)** → confirms the
   founding premise with named community evidence (the Quinn/
   Bloodthirster reverse-causation articulation; League of Items' own
   UI caveat). No action: already load-bearing in the brainstorm and
   the shrinkage/tiers hard rules.
2. **Matchup builds wanted AND distrusted (finding 2, §b-F1)** → feeds
   the matchup-builds OUTSIDE REVIEW, attack item 5 (display floor).
   The report independently recommends a visible sample-size gate with
   fallback to the general build — direct demand-side evidence for the
   floor question the brief already poses. Numeric tension to resolve
   at /spec: the report floats ~200 games; observed vs-route slot
   samples run n=16–246, so a 200 gate renders most matchup slots
   "insufficient" — which may be the honest output, but the threshold
   choice is exactly the OI-4-style sweep question. **Operator option:
   forward the report's §b-F1 + recommendation 1 to the reviewer as
   supplementary evidence (it arrived after the brief was sent; the
   brief is otherwise self-contained by design).**
3. **F8 shortlist framing (finding on F2, §b)** → confirms the spec's
   §1 scope choice (ranked shortlist, no single pick): "no organic
   quote demanding a single confident 'best pick'" — and market
   convergence on shortlists. Also sharpens spec review item 1: the
   context-blindness complaint ("bag of champion pairs") is the
   category's #1 — the spec's correlated-signals disclosure is honest
   about the same limit, but "explain WHY" (already shipped as
   describeComponent, extended in AC-S-5) is the differentiator the
   report says nobody delivers.
4. **Calibration as differentiator (finding on F3, §b + rec 3)** →
   two parts with different statuses:
   - "Honesty earns a literate minority's trust; anti-hype positioning
     is brand differentiation" → consistent with everything shipped;
     no action.
   - **"Lead every view with a decisive default answer; demote
     uncertainty to secondary, expandable context" → COLLIDES with two
     standing decisions** and is surfaced here rather than absorbed:
     (i) the advisory-only hard line (no commanded pick — a Riot-policy
     constraint, not tone); (ii) the C.3 misread guard (the card
     REFUSES an estimate below the floor by spec'd, tested design —
     "the tool refuses to guess" IS the feature). Partial existing
     answer: the score panel already leads with a decisive-shaped
     verdict ("Favorable · ≈53%" + confidence) — the report's concern
     applies mainly to the report card, where the refusal is the
     values choice the operator made explicitly at C.3. If the
     report's engagement argument is to change that, it's a register
     decision, not a UI tweak.
5. **"Speed and confidence win the mass market" (finding 5, §d)** →
   recorded as the standing disconfirming pressure on the honesty-first
   posture. Cheap hedge already in the report's own rec 5: if real
   users bounce off "insufficient data" states, that's a finding to
   act on THEN — with a friend-group fleet, that evidence is
   observable directly.
6. **Marketing (rec 4)** → no surface exists to violate it (private
   tool, no marketing); noted for any future INSTALL/README language:
   never "proven to win," position as the anti-hype tool.

---

## The report (verbatim)

# Do LoL Players Trust Companion-App Build & Draft Recommendations? A Decision Report for lolbuilder

## TL;DR
- **The statistical critique lolbuilder is built around is real and articulated by users: experienced players openly distrust "highest win-rate build" because of selection bias, and both DraftGap's own FAQ and independent benchmarks confirm draft tools are context-blind and only modestly predictive. Verdict: build all three features, but ship matchup-builds with hard sample-size guardrails.**
- **Matchup-specific builds are genuinely wanted (U.GG's "Vs Champion" filter is a headline feature and communities call matchup data "the most underused feature") yet simultaneously distrusted in rare matchups — so build them with a visible sample-size gate and a fallback to the general build below a threshold.**
- **Calibration/honesty is a real but minority differentiator: most users reward a fast, confident, one-click answer, so the honest-uncertainty design will win respect from a literate minority but must be paired with a decisive default answer or it risks reading as wishy-washy.**

## Key Findings
1. **The "high win-rate ≠ good build" selection-bias critique is the best-articulated distrust theme.** A veteran MOBAFire user lays out the reverse-causation argument precisely for Quinn's Bloodthirster (a "finisher item" whose ~61% win rate reflects that you were already winning by item 6). Data sites themselves concede this: League of Items stamps every item page with "Item winrate is not a good statistic to use when comparing items."
2. **Matchup builds are wanted AND distrusted — a genuine tension, not a one-sided complaint.** Demand is real (U.GG's "Vs Champion" filter, CounterStats, MetaBot). Distrust is real: rare matchups display absurd small-sample numbers (e.g., "100% win rate over 19 games").
3. **Draft/pick tools are widely seen as context-blind "meta parrots" — a critique admitted by developers themselves.** DraftGap's own FAQ concedes it doesn't model team-comp identity; a hackathon draft-AI team admitted their model "was too good at predicting standard meta picks."
4. **Draft-tool predictive lift is modest, which fuels legitimate distrust that these tools are decisive.** LoLDraftAI's own site states: "The model achieves 56.7% accuracy at predicting game outcomes from draft alone, and 57.7% when runes are included. This is significant considering draft is only one factor in winning a game." Independent testing echoes the ceiling — Winrate.gg's draft-recommendation benchmark found "a 5.4-point spread between top and bottom" in team win rate when the actual pick was among a site's top-10 recommendations, and academic ML models predicting outcomes from champion data alone top out around 62%.
5. **The market rewards speed and confidence over nuance.** U.GG sells the "30 seconds left in champ select" quick-answer use case; OP.GG's letter grades are praised as "immediately actionable without requiring interpretation."
6. **A literate minority values calibration and sample size**, and aggressive "proven to win / climb faster" marketing invites justified skepticism.
7. **"Copying makes you worse / doesn't teach why" is a consistent community trope** across every non-marketing source examined.

## Details

### (a) Trust/accuracy complaints across the app set

**Selection bias / "highest win-rate build is misleading."** This is the sharpest and most sophisticated recurring critique, and it maps directly onto lolbuilder's core thesis. A veteran MOBAFire contributor (Tauricus2017, July 2023) explained that Bloodthirster shows ~61% win rate on Quinn largely because it is bought as a final item — "if you get far enough in the game to get that item, you are probably already winning — hence the absurdly high winrate." This reverse-causation / "win-more item" argument is echoed by a Medium analysis of Heartsteel and formalized in academic work on removing skill bias from gaming statistics ("conditioning on one good move also inevitably selects a subset of better players"). League of Items bakes the caveat into its UI on every item page: "Item winrate is not a good statistic to use when comparing items." iTero's essay on champion win rates makes the sample-size point vividly: "If a Champion (such as Top Kayle) has a 67% win rate in 3 games — it might as well read: 'win rate between 0–100%'," and notes that among 162 perfectly balanced champions playing 100 games each, ~4.6 would exceed 60% win rate by pure chance. **Takeaway: users do articulate the exact statistical critique lolbuilder is designed around.**

**"They're all the same copied data."** A MOBAFire veteran comparing U.GG and OP.GG concluded they are "pretty much the same… the results are almost identical." The apps largely surface the same Riot-API-derived aggregates (DraftGap, for instance, pulls its data from Lolalytics at emerald+), feeding a perception that recommendations are undifferentiated scrapes.

**"Doesn't explain why / cookie-cutter."** A harsh Mobalytics Trustpilot review called it "Absolutely useless… every update, every meta, every tft comp, everything is just random guesses that ruin players chances to really understand and learn the game." Blog comparisons warn that app builds "may not necessarily be the best builds to use at the current time" and that players should "rely on your game sense rather than following cookie-cutter builds."

**App review ratings (with data-quality flags).** Mobalytics holds a 2.6/5 TrustScore on just 5 reviews on Trustpilot (40% 1-star, 40% 2-star, 20% 5-star). A Scam Detector automated score is low but is algorithmic, not organic sentiment. Facecheck (Overwolf) carries a solid rating on millions of downloads. Blitz.gg's Trustpilot score is contaminated by misdirected reviews aimed at an unrelated "Blitz – Win Cash" gambling app, so it should not be read as clean LoL-app sentiment.

### (b) Feature-specific findings

**Feature 1 — Matchup-conditioned builds.** Demand is well established: U.GG's FAQ leans into it — "For example, playing Zed vs Ahri is different than Zed vs Talon. Change the 'Vs Champion' filter to look at what is best in your specific matchup" — and community guides call matchup data "the most underused feature." But statistically literate users flag small-sample noise: guides warn "the biggest error players make involves trusting statistics with insufficient sample sizes," and matchup pages routinely display extreme win rates off tiny samples (e.g., "100% win rate over 19 games" on rare pairings). Both signals are strong and coexist. This validates lolbuilder's premise (people want opponent-specific builds) while confirming the noise risk it worries about is well-founded and observable in the wild.

**Feature 2 — Pick suggestion (F8).** The market has converged on ranked shortlists tailored to champ pool/comfort rather than a single dictated pick (Facecheck's "top 5 picks per lane"; DraftGap describes itself as "a unopinionated tool using only statistics to make suggestions"). The dominant complaint is context-blindness: DraftGap's FAQ concedes it "does not know about team comp identity like 'engage' or 'poke'," and a rival benchmark shows DraftGap rating a full-AP team at ~64.9% win chance where a comp-aware model says ~40.2% — because DraftGap "reads a draft as a bag of champion pairs." A hackathon team described the "Parrot Problem": their model "would recommend generic champions even when a niche counter-pick was strategically superior." I found no organic quote demanding a single confident "best pick"; the evidence leans clearly toward shortlist-with-tradeoffs being the wanted framing.

**Feature 3 — Calibration/honesty.** A literate minority explicitly values this: guides tell readers to "Check the 'matches analyzed' number before trusting any statistic," and LoLDraftAI markets calibration as a selling point — "The model is also well-calibrated: when it predicts a 55% win rate, games really do end up around 55%, meaning you can trust the predicted percentage." But the mass market rewards speed and decisiveness: U.GG sells the "30 seconds left in champ select" quick answer, and OP.GG's letter grades are praised as "immediately actionable without requiring interpretation." Aggressive causal marketing invites skepticism — Mobalytics' own 2018 ladder study (110,426 Mobalytics vs 1,613,396 non-user accounts, NA, May–Nov 2018) claims "53.7% of Mobalytics users climbed at least one division, whereas 42.3% of non-Mobalytics users climbed… Mobalytics users are 27.0% more likely to climb," a correlational claim marketed as causal. Even a pro-tool benchmark honestly notes "This is a correlation, not a causal experiment."

### (c) Decision recommendations

**Matchup builds — BUILD IT, with guardrails.** Demand is real and the concept is proven by U.GG's headline "Vs Champion" filter and dedicated counter sites. But ship a visible sample-size gate: below a threshold (e.g., ~200 matchup games) show a confidence range or an "insufficient data" state and fall back to the champion's general build. Never present a small-sample matchup build as authoritative — the "100% WR over 19 games" pattern is exactly the failure mode users already recognize and mock.

**Pick suggestion — BUILD THE SHORTLIST; the "no single best" framing matches what users want.** The market and even competitor tools have converged on ranked shortlists with reasoning and sample sizes, and there is no evidence of demand for a single dictated pick. Differentiate on the thing every existing tool fails at: context-awareness (team-comp identity, damage profile) and explaining WHY, since context-blindness is the top draft-tool complaint — one even competitors admit.

**Calibration — BUILD IT as a differentiator, but pair it with a decisive default.** Honest uncertainty will earn respect from the improvement-minded minority and directly counters the distrust of "proven to win" marketing. But because most users want a fast confident answer, the default view must still lead with a clear recommendation; surface uncertainty (CIs, sample sizes, "inconclusive") as secondary, expandable context, not as a refusal to answer.

### (d) Disconfirming evidence
- **Most users prioritize speed over accuracy nuance.** The "30-seconds-left" quick-answer use case and praise for "immediately actionable" letter grades cut against a design that foregrounds uncertainty. Honest-uncertainty risks reading as wishy-washy if not paired with a decisive default. This is the clearest point where the evidence pushes back on lolbuilder's honesty-first instinct.
- **Matchup builds are demanded despite sample issues** — the risk isn't that users reject the feature, it's that they over-trust small-sample numbers. lolbuilder's caution could be perceived as less useful than a competitor's confident (if noisier) number, so the guardrails must be framed as added value, not as withheld answers.
- **Some users simply trust and like these tools** ("I've won a lot of games using u.gg's build guides"; positive Mobalytics testimonials), so the distrust themes are real but not universal.
- **The clean organic-Reddit sentiment base is thin** — direct Reddit thread quotes could not be retrieved due to a search-tool limitation; findings lean on MOBAFire, Trustpilot, blogs, GitHub/FAQ text, and competitor benchmarks.

## Recommendations
1. **Ship matchup builds with a hard sample-size gate (~200 games).** Below it, show a confidence range or "insufficient data" and fall back to the general build. Revisit threshold: if user testing shows people ignore the gate and copy tiny-sample builds anyway, tighten it or hide sub-threshold builds entirely.
2. **Ship pick suggestion as a ranked shortlist with reasoning + sample sizes**, and invest in context-awareness (comp identity/damage profile) since context-blindness is the #1 draft-tool complaint and even DraftGap concedes the gap. Never collapse to one dictated pick.
3. **Ship calibration as a genuine differentiator but lead every view with a decisive default answer.** Instrument whether the honest framing improves retention/trust among engaged users; if uncertainty states depress engagement without improving trust, demote them to a secondary expandable view rather than removing them.
4. **Avoid "proven to win / gain X LP" marketing.** It is precisely the overclaim users distrust (Mobalytics' 27% figure is correlational and marketed as causal). Position lolbuilder's honesty as the explicit anti-hype alternative — this converts the calibration feature into brand differentiation.
5. **Benchmark that would change these calls:** if usage data shows the majority of users bounce off or override "insufficient data" states in favor of any confident number, shift calibration from a foreground feature to a trust badge and lean harder into decisive defaults.

## Caveats
- Native Reddit sentiment could not be captured directly; findings rely on MOBAFire, Trustpilot, blogs, GitHub/FAQ text, and competitor benchmarks. A follow-up with working Reddit access would strengthen the organic-quote base.
- Some of the strongest "context-blind" evidence comes from a competitor's marketing benchmark (LoLDraftAI vs DraftGap); it uses DraftGap's own published formula and data scope, so it is directionally credible but not a neutral source.
- App-store/Trustpilot scores are small-sample (Mobalytics = 5 reviews) and, for Blitz.gg, contaminated by misdirected reviews for an unrelated gambling app.
- Vendor marketing claims ("proven to win," "27% climb faster," "56.7% accuracy," calibration claims) are self-reported and not independently verified; treat as directional, not established fact.
