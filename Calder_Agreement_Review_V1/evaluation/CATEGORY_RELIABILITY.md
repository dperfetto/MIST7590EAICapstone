# Category reliability

Required by Section 6.2 of the project brief: having reported two numbers per category
(`evaluation/results/metrics.csv`), say which categories the system handles reliably and which it
does not, with the team's best explanation for the difference. No single blended accuracy figure
is reported anywhere in this project — the brief is explicit that one would hide exactly the
information a reviewer needs, and the per-category table below is the real answer.

## The numbers (510-contract CUAD evaluation)

| Category | Precision | Recall | Positive contracts | Reliability |
|---|---|---|---|---|
| Governing Law | 0.95 | 1.00 | 437 | **Reliable** |
| Insurance | 0.94 | 0.67 | 166 | Precise, misses often |
| Renewal Term | 0.92 | 0.62 | 176 | Precise, misses often |
| Cap on Liability | 0.96 | 0.55 | 275 | Precise, misses often |
| Warranty Duration | 0.71 | 0.39 | 75 | Precise, misses often (low support) |
| Audit Rights | 0.86 | 0.32 | 214 | Precise, misses often |
| Termination for Convenience | 0.47 | 0.70 | 183 | **Not reliable** |
| Exclusivity | 0.44 | 0.98 | 180 | **Not reliable** |
| Notice to Terminate Renewal | 0.42 | 0.40 | 111 | **Not reliable** |
| Change of Control | 0.45 | 0.90 | 121 | **Not reliable** |

Micro-average across all 10: 68.0% precision, 70.2% recall (`evaluation/results/metrics.json`) —
reported here only to show why it would be a bad headline number: it describes no actual category.
Four categories are near 0.40 on one or both axes; only Governing Law is at or above 0.95 on both.

## Reliable: Governing Law

Governing Law has a property the others don't: the concept is almost always expressed with one of a
small number of fixed legal phrases ("governed by," "governing law"), and those phrases rarely
appear in a contract for any other reason. There's little room for paraphrase, and little room for
an unrelated clause to accidentally contain the same words. It is the one category where Calder's
phrase-matching approach is close to a solved problem already.

Until 2026-10-18 this group also held "Assignment / Control" (0.88 precision, 0.97 recall), which
combined CUAD's Anti-Assignment and Change Of Control. It was narrowed to CUAD's Change of Control
so the name matches what it finds; most of its old strength came from ordinary anti-assignment
clauses, which are easy to match and are no longer in scope.

## Precise but misses often: Insurance, Renewal Term, Cap on Liability, Audit Rights, Warranty Duration

These five share the opposite profile: when the system does flag one of these, it's usually right
(71–96% precision) — but it silently misses a third to two-thirds of the real ones. This is not one
problem; the spot-check (`evaluation/LABELING_HANDBOOK_SPOTCHECK.md`) and the independent check
(`evaluation/independent-check/RESULTS.md`) each isolated a specific, different cause for different
members of this group:

- **Cap on Liability:** modern modular contract drafting (Bonterms, Common Paper — the exact
  publishers behind Section 7.2) states this as a defined term ("General Cap") rather than with
  literal words like "liability cap." The independent check confirmed this directly: a real
  Bonterms liability-cap clause was never detected, before or after a deliberate edit to its value,
  while the identical provision drafted in plain language in a paired test document was caught
  immediately. This is a drafting-style gap, not a provision-difficulty gap.
- **Audit Rights:** the spot-check found the CUAD labels for this category to be clean and
  unambiguous in every sampled example, which rules out label noise as an explanation. The gap is
  real: our candidate phrases don't cover enough of how audit clauses are actually drafted. This is
  the category most in need of a candidate-phrase pass, or hosted-extraction coverage, before
  anyone treats a "not found" result here as informative.
- **Renewal Term:** the spot-check found two of three real CUAD examples use "automatically
  **extend**," a synonym not in Calder's candidate phrase list (which has "automatically renew,"
  "shall renew," etc., but not "extend"). A one-line fix is identified but not yet made.
- **Insurance:** has reasonable support (166 positive contracts) and the second-best precision in
  this group; its recall gap hasn't been root-caused with a specific example the way the other
  three have, and is a candidate for the next round of error analysis.
- **Warranty Duration:** has the smallest sample in the whole taxonomy (75 positive contracts, the
  floor the team set when selecting categories — see `docs/DECISION_AND_AMBIGUITY_LOG.md`), so its
  38.7% recall carries more sampling uncertainty than the other categories' numbers. Treat this
  figure as the least statistically stable of the ten.

**Why this matters more than the number alone suggests:** a reviewer who sees no flag for one of
these five categories has no way to tell "this agreement doesn't have one" from "the system missed
it" — the two look identical. This is exactly why gap detection is out of required scope (Change
Notice 1; `docs/SPONSOR_CORRESPONDENCE.md`) and why `docs/CONFIDENCE_THRESHOLD_NOTE.md` argues the
confidence score cannot be the thing counsel relies on for completeness in these categories.

## Not reliable: Termination for Convenience, Exclusivity, Notice to Terminate Renewal, Change of Control

These four are the ones we'd actively caution against trusting either a flag or a silence from
today.

- **Exclusivity (0.44 precision, worst of all 10):** the spot-check found the root cause directly
  in CUAD's own ground truth — two of three sampled positive examples were ordinary exclusive IP
  license grants ("grants Licensee a worldwide, exclusive ... license"), not exclusive-dealing
  commitments, even though Calder's own taxonomy explicitly documents this exact distinction as an
  exclusion. The independent check reproduced the same failure live, on an unmodified document,
  independent of CUAD. This category conflates two different legal concepts under one label, and
  neither CUAD's annotators nor Calder's phrase matcher consistently separate them.
- **Notice to Terminate Renewal (0.42 / 0.40, worst recall-precision combination of all 10):** fails in both
  directions at once. The independent check found a real notice-period clause ("at least 30 days
  prior to the end of the current Subscription Term") that Calder's phrases don't match at all,
  because none of them cover "prior to the end of the current [Term]" phrasing — only
  renewal-specific wording like "notice of non-renewal." Low precision plus low recall on the same
  category means the finding set for Notice to Terminate Renewal should be treated as close to uninformative
  until the phrase list is substantially reworked.
- **Termination for Convenience (0.47 precision):** the spot-check found a real CUAD-labeled example
  with no "without cause" or "for any reason" language in the labeled span at all — the annotators
  used contract context the span doesn't carry, which Calder's phrase matcher structurally cannot
  do. The independent check separately found the opposite failure: after deleting the actual
  clause, the matcher produced a false positive by latching onto an unrelated phrase ("for any
  reason") in an IP-assignment clause 15 pages later. The category's candidate phrases are
  simultaneously too narrow (missing real instances) and too generic (firing on boilerplate).
- **Change of Control (0.45 precision, 0.90 recall):** over-flags. Two of its phrases, "merger" and
  "operation of law," also appear in ordinary anti-assignment clauses ("may not assign, whether by
  merger, operation of law or otherwise"), which CUAD does not label Change of Control. Removing
  those two phrases raises precision to 0.66 but drops recall to 0.68, so roughly a third of real
  change-of-control clauses would be missed. They were kept because a missed provision costs more
  than a false flag (`docs/CONFIDENCE_THRESHOLD_NOTE.md`).

## Bottom line

One category (Governing Law) is solved by phrase-matching as implemented.
Five more (Insurance, Renewal Term, Cap on Liability, Audit Rights, Warranty Duration) are
trustworthy when they fire but silently miss often enough that a non-flag should never be read as
"not present." Four (Exclusivity, Notice to Terminate Renewal, Termination for Convenience, Change of Control) aren't
reliable in either direction yet and are the right place to spend further deterministic-tuning or hosted
-extraction effort, in that order, before scaling this to real agreements.
