# Category reliability

Required by Section 6.2 of the project brief: having reported two numbers per category
(`evaluation/results/metrics.csv`), say which categories the system handles reliably and which it
does not, with the team's best explanation for the difference. No single blended accuracy figure
is reported anywhere in this project — the brief is explicit that one would hide exactly the
information a reviewer needs, and the per-category table below is the real answer.

Explanations below were checked on 2026-10-28 against the CUAD Labeling Handbook (personal-use
edition, as of September 9, 2021), cited by page. The handbook is not redistributed in this
repository; see `evaluation/LABELING_HANDBOOK_SPOTCHECK.md` for how it was obtained and what it
changed.

## The numbers (510-contract CUAD evaluation)

| Category | Precision | Recall | Positive contracts | Reliability |
|---|---|---|---|---|
| Governing Law | 0.95 | 1.00 | 437 | **Reliable** |
| Insurance | 0.94 | 0.67 | 166 | Precise, misses often |
| Renewal Term | 0.89 | 0.68 | 176 | Precise, misses often |
| Cap on Liability | 0.96 | 0.55 | 275 | Precise, misses often |
| Warranty Duration | 0.71 | 0.39 | 75 | Precise, misses often (low support) |
| Audit Rights | 0.86 | 0.32 | 214 | Precise, misses often |
| Termination for Convenience | 0.47 | 0.70 | 183 | **Not reliable** |
| Exclusivity | 0.44 | 0.98 | 180 | **Not reliable** |
| Notice to Terminate Renewal | 0.50 | 0.55 | 111 | **Not reliable** |
| Change of Control | 0.45 | 0.90 | 121 | **Not reliable** |

Micro-average across all 10: 68.3% precision, 71.6% recall (`evaluation/results/metrics.json`) —
reported here only to show why it would be a bad headline number: it describes no actual category.
Seven categories are at 0.55 or below on one axis; only Governing Law is at or above 0.95 on both.

Renewal Term and Notice to Terminate Renewal were re-measured on 2026-10-28 after adding phrases
based on the handbook's wording and on the error analysis (see their sections below). Before that change they were
0.92 / 0.62 and 0.42 / 0.40.

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
  **extend**," and the handbook lists "extend" and "extension" as keywords for this label (p. 19).
  Five phrases were added on 2026-10-28 ("automatically extend", "automatically be extended",
  "renew automatically", "extend for an additional", "extend for successive"), each kept only if it
  found real clauses without adding many wrong flags. Recall rose from 0.62 to 0.68 and precision
  fell from 0.92 to 0.89. "Shall be extended" was tested and rejected (+8 found, +17 wrong).
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

- **Exclusivity (0.44 precision, worst of all 10):** CUAD and Calder define this category
  differently. CUAD deliberately labels exclusive licenses as Exclusivity: the handbook's first rule
  for the label is "An exclusive license should be labeled" (p. 31), alongside exclusive dealing,
  requirements and non-dealing commitments. Calder's taxonomy excludes an IP license that merely
  uses the word "exclusive", because Calder cares about exclusive-dealing commitments. The two
  exclusive-license examples the spot-check found are therefore labeled correctly by CUAD's rules,
  not noise. That means the low precision is not a labeling problem: flags on exclusive licenses
  count as correct, so the wrong flags come from the keyword "exclusive" firing in contracts CUAD
  says have no exclusivity, for example on exclusive remedies or exclusive jurisdiction, and the
  deterministic matcher cannot apply the taxonomy's exclusion. It also means these scores measure
  CUAD's broader category: by Calder's definition, exclusive-license flags would be wrong too. Whether
  Calder should adopt CUAD's broader definition is a playbook decision for counsel.
- **Notice to Terminate Renewal (0.50 / 0.55):** still fails in both directions, though less than
  before. The handbook's examples use wording such as "prior to the expiration of the then-current
  term" and "before the end of the then current term" (p. 23), which the phrase list lacked. Three
  phrases were added on 2026-10-28 ("prior to the expiration of the then", "before the end of the
  then", "intention not to renew"), raising recall from 0.40 to 0.55 and precision from 0.42 to
  0.50. The independent check's Bonterms clause ("at least 30 days prior to the end of the current
  Subscription Term") is still missed: the matching phrase found nothing extra in CUAD, and it was
  not added just to pass the independent check, which would defeat that check's purpose. Much of
  the remaining precision problem is the handbook's own warning: this label and Termination for
  Convenience look alike, and only a notice that ends the contract at the end of a term counts here
  (p. 23–24). Generic phrases such as "days prior written notice" cannot tell them apart.
- **Termination for Convenience (0.47 precision):** the spot-check found a CUAD-labeled example,
  "LICENSEE may terminate this Agreement upon ninety (90) days written notice", with no "without
  cause" or "for any reason" wording. By CUAD's rules that label is straightforward: the handbook
  calls a notice the "signature" of this clause, and its standard example is "Either party may
  terminate this Agreement upon 30 days written notice" (p. 26). It also counts the right to revoke
  a license or stop providing a service without cause (p. 27). Calder's phrases look for
  "without cause"-style wording, so they miss this plain form. The independent check separately
  found the opposite failure: after deleting the actual clause, the matcher latched onto an
  unrelated "for any reason" in an IP-assignment clause 15 pages later. The phrases are
  simultaneously too narrow (missing the plain notice form) and too generic (firing on boilerplate).
- **Change of Control (0.45 precision, 0.90 recall):** over-flags. Two of its phrases, "merger" and
  "operation of law," account for much of this: removing them raises precision to 0.66 but drops
  recall to 0.68, so roughly a third of real change-of-control clauses would be missed. They were
  kept because a missed provision costs more than a false flag (`docs/CONFIDENCE_THRESHOLD_NOTE.md`).
  This section used to say these phrases fire on anti-assignment clauses "which CUAD does not label
  Change of Control." The handbook says the opposite for one of them: "Restrictions on assignment
  by operation of law should be labeled" as Change of Control (p. 74–75). What CUAD excludes is an
  assignment restriction that merely applies "in connection with" a change of control, and the
  definition of Change of Control itself (p. 75). The wrong-flag count is real, because it is scored
  against CUAD's actual labels, but which clauses cause it has not been re-checked against these
  rules.

## Bottom line

CUAD's handbook sets its own recall target: a tool built on CUAD "should have 80%+ in recall", and
annotators were told to label a clause when unsure (p. 4). Seven of the ten categories are below
that target on the keyword path.

One category (Governing Law) is solved by phrase-matching as implemented.
Five more (Insurance, Renewal Term, Cap on Liability, Audit Rights, Warranty Duration) are
trustworthy when they fire but silently miss often enough that a non-flag should never be read as
"not present." Four (Exclusivity, Notice to Terminate Renewal, Termination for Convenience, Change of Control) aren't
reliable in either direction yet and are the right place to spend further deterministic-tuning or hosted
-extraction effort, in that order, before scaling this to real agreements.
