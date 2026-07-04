# Capture — Joint enemy-role assignment (NOT YET BRAINSTORMED — DO NOT IMPLEMENT)

**Status:** idea capture only, mid-M7 (2026-07-04). Needs its own
brainstorm → spec pass before any code, per project discipline.

**The idea:** solve enemy role assignment *jointly* as a constrained
matching problem (5 champions ↔ 5 lanes, maximize total likelihood) instead
of the current per-champion greedy thresholding. Intuition: a champion that
is individually ambiguous (e.g. a mid/support flex) can become unambiguous
once the other four assignments constrain the remaining lanes — joint
information the per-champion threshold deliberately ignores.

**Why it's not a quick change:** the honesty gate has to survive the
upgrade — a joint solver produces an assignment for *everything*, so the
"blank beats confidently wrong" behavior needs a principled joint-confidence
threshold, not just an argmax. That design question is the brainstorm.

**Evidence context at capture time:** M7.4's live drafts showed the greedy
model working (correct inferences at 63–96%, genuine flexes correctly left
blank) — this captures a possible *refinement*, not a defect.
