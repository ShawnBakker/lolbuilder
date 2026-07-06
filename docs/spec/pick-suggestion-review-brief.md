# Review brief — F8 pick-suggestion spec (outside pass)

**To the reviewer:** you are the outside pass on the attached spec
(`docs/spec/pick-suggestion-spec.md`). Its drafter cannot review it —
your job is to attack the acceptance criteria before an implementation
plan locks the open items. This is a SPEC review: the questions are
whether the ACs are right, complete, and honestly claimable — not
whether the feature is worth building (its owner queued it) and not a
product/market evaluation. This brief plus the spec are self-contained;
you need and should use nothing else.

## Context you need (the project in six lines)

A private, advisory League of Legends draft analyzer for a small friend
group. Data: per-patch sharded JSON (per-champion win rates, matchup
and synergy cells) built by a pipeline from a public stats site;
frontend on GitHub Pages; a small local read-only helper watches the
League client (LCU) to auto-populate the draft board. Two hard
constraints every feature inherits, both non-negotiable here:
(1) **advisory-only** — the tool presents options, tradeoffs, and
sample sizes, never a single commanded pick (a policy constraint, not
tone); (2) **no false precision** — qualitative tiers + sample sizes,
never bare decimal win rates.

Glossary for the spec's shorthand: *shard* = one champion's JSON data
file (~70KB). *scorePick* = the existing scoring engine (baseline +
matchup + synergy contributions with small-sample shrinkage, output as
a tier + confidence). *describeComponent* = existing plain-language
per-component readings ("the lane matchup vs X runs clearly against
you"). *lanes field* = per-champion role pick-share, already in every
shard. *DraftState* = the engine's input type, logged verbatim by a
calibration system and therefore frozen.

## Pre-validated — do not re-litigate, evidence exists

- **Bans are already transported** by the helper: observed in a live
  champ-select capture (they arrive in the client's actions array; the
  helper validates and serves them today).
- **The candidate-pool signal exists:** the `lanes` pick-share field is
  in every shard now (observed), and looping candidates through
  scorePick is proven code (an existing sensitivity-sweep script does
  exactly this over real shards).
- **Off-role win rates were NEVER validated** — the data source's
  `?lane=` parameter is unprobed. Status: unknown, not false. The spec
  treats it as a claim boundary (no off-role WR shown); "probe it and
  widen the boundary" is a legitimate recommendation, but "assume it
  works" is not.
- The scoring engine's internals (shrinkage, tiers, confidence) are
  shipped, tested, and out of scope.

## Known weaknesses, pre-declared by the drafter

- The leaning in attack item 1 (visible coarse ordering) is weakly
  held; the alphabetical alternative was not seriously costed.
- OI-S-2 (the tier shard) adds a NEW pipeline output artifact behind an
  "open item" label — arguably a decision dressed as a detail.
- The manual ban-entry strip (AC-S-6) may be scope creep; the spec
  already half-admits this in attack item 5.
- The spec does not address list-churn UX: AC-S-4 re-orders rows as
  full scores arrive, and a list that visibly jumps while the user
  reads it has no AC constraining it.

## What to attack (priority order)

1. **Two-stage claim discipline (AC-S-4).** The panel shows a coarse
   ordering (by role-share/baseline) immediately, marked as coarse,
   then re-orders as real engine scores arrive. Attack: is ANY visible
   ordering already a de-facto recommendation to a user who doesn't
   read markers — and does that breach the advisory line in spirit?
   The stated alternative is an unranked-alphabetical coarse list.
   Reverses if: you can articulate why marker-plus-ordering fails the
   "never a commanded pick" test, or conversely why alphabetical
   destroys the panel's utility. Supplementary evidence (from an
   outside user-sentiment research pass, 2026-07-06; directional —
   sources are forums/FAQs/competitor benchmarks): the market has
   converged on ranked shortlists, no organic demand was found for a
   single dictated pick, and the category's #1 complaint is
   context-blind ranking ("reads a draft as a bag of champion pairs").
2. **The no-off-role-WR boundary (AC-S-2).** Flex champions get a row
   with pick-share only (no win rate) whenever the open lane isn't
   their default lane. Attack: right claim boundary, or should the row
   say WHY the number is missing ("no validated off-role data")? Is a
   share-only row more misleading than no row?
3. **The pool definition (AC-S-1, OI-S-1).** Role pick-share above a
   floor is the sole viability gate — niche-but-real picks below the
   floor are simply absent. Attack: acceptable absence (consistent with
   the spec's "absence, not judgment" stance), or does the panel need
   an "add any champion" escape hatch that full-scores whatever the
   user names? If the hatch, what keeps it from becoming an implicit
   endorsement of anything typed?
4. **Open items vs hidden decisions (§4).** Are OI-S-1..4 genuinely
   plan-lockable details, or do any hide decisions that belong in this
   spec? OI-S-2 in particular: a new per-role pipeline artifact (five
   small files per patch). Attack its existence, its field list, and
   whether its win-rate field can drift from the champion shards it
   summarizes.
5. **Structural framing enforcement (AC-S-8).** A test greps rendered
   output and source strings for superlatives/imperatives, and the
   panel never renders exactly one candidate. Attack: sufficient
   mechanism, or does the framing ban need to extend to the ordering
   itself (loops back to item 1)? What would the test miss?
6. **Manual ban entry (AC-S-6/7).** LCU mode gets bans free; manual
   users could simply see banned champions in the pool (harmless: a
   banned champion is unpickable in the real client anyway). Attack:
   is the manual ban strip worth its UI surface, or is the cheaper cut
   correct? If cut, does AC-S-7 survive for LCU mode alone?
7. **AC completeness.** Name states the ACs don't cover. Seeds: pool
   is empty or all-banned for a lane; the open lane changes while
   full scores are in flight; shard fetch fails for a top-K candidate;
   coarse list rendered while the tier shard itself is stale/missing.

## Output contract

For each numbered item: verdict (stands / falls / sharpen-with-change)
+ reasoning. For item 7, a list (possibly empty) of missing ACs. End
with an overall go/no-go on advancing to /plan, and if no-go, the
minimum set of changes that flips it.

## Not in scope

Whether to build F8 (queued by its owner); the matchup-builds feature;
the scoring engine's statistics; marketing/positioning; anything
requiring new data-source probing beyond noting where a probe would
change an answer.
