# Brief Lint — pre-send checklist for external-LLM review briefs

**What this is:** a paste-prompt, not automation. Before a brief goes to
multi-LLM fan-out, paste the prompt below (with the draft brief) into a fast
checker model (Sonnet-class). **The checker reports findings; it never
rewrites the brief.** A rewriter would imprint one model's framing onto every
downstream reviewer's input — a single point of correlated bias upstream of a
system whose entire value is reviewers that *fail differently*.

**When to run it:** on briefs headed for genuine multi-LLM fan-out — the ones
about to shape several independent reviews. Running it on everything is fine
(it's cheap), but that's a choice, not a default: a note-to-self needs no
ceremony. *(Decided at creation, 2026-07-03.)*

**This checklist is not permanently fixed.** Every check below exists because
of a real incident, per D14's rule (tooling after evidence, from the
evidence). The same rule governs its maintenance: if the lint consistently
flags — or consistently misses — the same class of issue across several
briefs, that's a finding about the lint, and the checklist gets amended the
same way every other component of this project has been.

---

## The paste-prompt

> You are linting a review brief before it is sent, unmodified, to several
> independent LLM reviewers. Do NOT rewrite or restate the brief. Report only
> findings against these five checks, quoting the offending passage for each,
> and state "clean" for any check with no finding.
>
> 1. **Frame declared, rubric scoped.** Does the brief state what kind of
>    review this is and, where needed, what is out of scope? Could a reviewer
>    plausibly import an inapplicable rubric (product/market/funding framing,
>    severity scales, verdict formats) because the brief doesn't exclude it?
>
> 2. **Self-contained, no context leakage.** Does the brief depend on
>    anything the reviewer won't have — adjacent documents, conversation
>    history, project shorthand, codenames? Does it accidentally include
>    neighboring content that could contaminate the reviewer's framing?
>
> 3. **Observation vs. inference vs. hypothesis, labeled.** Is every factual
>    claim written in the tense of its actual evidence? Flag any inference or
>    hypothesis written in observation-tense ("X is the case" where the
>    evidence only supports "X would explain what we saw").
>
> 4. **Falsifiability stated.** For each substantive claim or decision the
>    reviewers are asked to weigh: does the brief say what evidence would
>    reverse or refute it? Flag claims presented as unconditional.
>
> 5. **Known weaknesses pre-stated.** Does the brief declare the weaknesses
>    the author already knows, so reviewer output can be diffed against them
>    (found-beyond-admitted = signal; re-found-admitted = redundancy)?

---

## Incident provenance (one per check — why each exists)

1. **Frame/rubric** — an external verification imported a startup KILL/KEEP
   fundability rubric into a hobby-project review purely from
   adjacent-document contamination (pre-register; the reason D16 exists).
2. **Self-containment** — same incident, second lesson: verifiers receive
   only the brief, never neighboring docs (D16's standing rule).
3. **Tense labeling** — the "mixed literal/ref interning" claim: an
   inference from a single NaN, written in observation-tense, propagated
   into five documents and was graded "fully correct" by the reviewer before
   fixture-scale scanning refuted it (2026-07-03; CLAUDE.md instance list).
4. **Falsifiability** — the decision register's "reverses if" discipline is
   what separated evidence-backed decisions from dogma during the parallel
   review cycle; a claim with no reversal condition invited re-litigation
   instead of testing (register design, 2026-07-02).
5. **Pre-stated weaknesses** — the register's known-weaknesses section let
   reviewer output be *measured* (two genuinely-new risks found vs. two
   convergent) instead of merely collected (review-cycle merge, 2026-07-02).

## Role boundaries

- **Checker model:** Sonnet-class is the right capability/cost tier — the
  task is structured evaluation against known criteria. Caveat from review:
  "self-contained enough" and "properly hedged" are narrow *editorial*
  judgments, not pure mechanics — hence the audit rule above.
- **Configuration to avoid:** same-family checker feeding same-family
  *opinion* reviewers. This project's opinion reviewers are non-Claude chat
  models and its Claude context is an empirical executor, so the pool stays
  diverse — revisit if the reviewer pool changes.
