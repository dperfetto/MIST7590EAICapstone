# Labeling Handbook spot-check

Required by Section 6.1 of the project brief. The CUAD evaluation (`evaluation/results/metrics.csv`)
uses CUAD's expert labels as the answer key without creating any labels of our own. This note is
the separate, required step of actually reading a handful of those labels against the category
definitions the annotators were trained on, to understand what the labels mean and where they're
debatable — not just computing a score against them.

## A note on access

The brief describes "the CUAD Labeling Handbook" (atticusprojectai.org/labeling-handbook) as the
source of category definitions. When this spot-check was first written, the team had only that
web page, which shows a table of contents, so it worked from `category_descriptions.csv` in the
official CUAD GitHub repository (github.com/The-Atticus-Project/cuad): one or two sentences per
category.

On 2026-10-28 the team obtained the full handbook (personal-use edition, "as of September 9,
2021", 95 pages), which gives IS and IS NOT rules with examples for each label. The findings below
were re-checked against it and cited by page. It is marked "personal use only", so it is not copied
into this repository. It covers most of Calder's categories but has no section for Cap on
Liability or Warranty Duration, so those two still rest on the shorter official definitions.

Checking against it reversed two of the original conclusions (Exclusivity and Termination for
Convenience): what looked like inconsistent labels turned out to follow the handbook's rules.

## Method

For five categories — chosen to cover a strong performer (Audit Rights, which is reliable when it
fires), a known weak performer (Exclusivity, Calder's worst precision), and three others — we
pulled 2–3 real, randomly sampled positive examples directly from `CUAD_v1.json` (the official
510-contract release) and read them against the official definition from `category_descriptions.csv`.

## Findings

### Exclusivity — CUAD's definition is broader than Calder's

> **Official definition:** "Is there an exclusive dealing commitment with the counterparty? This
> includes a commitment to procure all 'requirements' from one party... or a prohibition on
> licensing or selling technology, goods or services to third parties, or a prohibition on
> collaborating or working with other parties... whether during the contract or after."

Three real examples labeled positive for Exclusivity:

1. *Cardax, Inc. Collaboration Agreement:* "...each Party hereby provides a worldwide, **exclusive**,
   royalty free, perpetual **license** of such Intellectual Property Rights for use by each licensee..."
2. *Glu Mobile Content License Agreement:* "Fox grants Licensee a worldwide, **exclusive** (except as
   otherwise may be provided in the Agreement), non-transferable right and **license** to distribute
   video clips..."
3. *Midwest Energy Emissions Content License Agreement:* "...CONTENT PROVIDER **will not** ... exploit
   or otherwise use ... the Content via the internet to Universities and College students in the
   People's Republic of China **except for the benefit of the COMPANY**."

**This surprised us at first, and the handbook explains it.** Example 3 is an exclusive-dealing
commitment. Examples 1 and 2 are **IP license grants** that use the word "exclusive" to describe the
license itself. The short official definition reads as if only exclusive dealing counts, so we
first concluded that examples 1 and 2 were labeling inconsistencies.

**Corrected 2026-10-28:** they are not. The handbook's first rule for Exclusivity is "An exclusive
license should be labeled", with the example "Party A hereby grants Party B an irrevocable, fully
paid, exclusive license" (p. 31). Co-exclusive licenses count too (p. 32). CUAD labels exclusive
licenses on purpose.

This section originally said CUAD's annotators "didn't draw that line consistently" and that the
category "spans two legally distinct concepts". The second half is right; the first is not. The
accurate statement is that **Calder's taxonomy defines Exclusivity more narrowly than CUAD does**:
Calder's exclusion ("Do not label ... an intellectual-property license merely because it uses the
word exclusive") removes something CUAD deliberately includes.

Two consequences. First, Exclusivity's low keyword precision (0.44,
`evaluation/results/metrics.csv`) is not explained by label noise: flags on exclusive licenses count
as correct under CUAD's rules, so the wrong flags come from the keyword "exclusive" firing in
contracts CUAD says have no exclusivity at all. Second, CUAD's Exclusivity scores measure CUAD's
broader category, not Calder's: by Calder's own definition, flags on exclusive licenses would be
wrong, and an AI that follows Calder's exclusion will skip clauses CUAD counts as found. The
narrower definition may be the right one for Calder, which cares about exclusive-dealing
commitments, but it should be recorded as a playbook choice, not as a CUAD flaw. The Section 6.3 independent check found the same matcher
failure on an unmodified document (`evaluation/independent-check/RESULTS.md`,
`commonpaper-software-license`).

### Cap on Liability — one debatable example out of three

> **Official definition:** "Does the contract include a cap on liability upon the breach of a
> party's obligation? This includes time limitation for the counterparty to bring claims or
> maximum amount for recovery."

Two of three sampled examples are unambiguous (a liability cap equal to amounts paid under the
agreement; a flat $50 cap). The third — a BerkeleyLights collaboration agreement clause reading
"IN NO EVENT WILL EITHER PARTY BE LIABLE TO THE OTHER PARTY FOR ANY LOST PROFITS, INDIRECT,
SPECIAL, INCIDENTAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES" — is a **consequential-damages waiver**,
which excludes categories of harm rather than setting a dollar cap or claims deadline. It doesn't
fit the official definition's "maximum amount for recovery" or "time limitation" language. This is
a smaller version of the Exclusivity problem: CUAD occasionally groups damages-type exclusions in
with dollar/time caps even though they're different mechanisms. Calder's own taxonomy already
anticipates this ("Do not label a list of uncapped-liability exceptions unless the same span also
states a cap"), but this confirms the risk is real in the ground truth, not hypothetical.

### Termination for Convenience — the plain notice form counts

> **Official definition:** "Can a party terminate this contract without cause (solely by giving a
> notice and allowing a waiting period to expire)?"

One sampled example — "LICENSEE may terminate this Agreement upon ninety (90) days written
notice" — contains no "without cause" or "for any reason" language. We first concluded the
annotators must have used surrounding context the labeled span doesn't show.

**Corrected 2026-10-28:** the handbook makes this label straightforward. It calls a notice the
"signature" of this clause, and its standard example is "Either party may terminate this Agreement
upon 30 days written notice" (p. 26). It also counts a right to revoke a license, stop a service or
terminate an order "at any time" without cause (p. 27). One of its examples, "Company at its sole
discretion may at any time alter or cease providing the Customer Service...", is the FreeCook
clause the team's manual testing recorded as missed.

This still matters for Calder: our candidate phrases (`"for any reason"`, `"without cause"`, `"at
any time upon"`) look for without-cause wording, so a plainly drafted notice clause like the one
above is a silent miss. The handbook also explains a source of wrong flags: Termination for
Convenience and Notice to Terminate Renewal look alike, and the difference is whether the notice
can cut a term short or only ends the contract at the end of a term (p. 23–24).

### Renewal Term — "extend" is a common synonym CUAD accepts that our phrases don't catch

Two of three sampled Renewal Term examples use the verb "**extend**" ("the Term ... shall
automatically **extend** for an additional [...] year period"; "the contract will automatically
**extend** for an additional month of service") rather than "renew." Calder's candidate phrases for
Renewal Term (`"automatically renew"`, `"automatic renewal"`, `"shall renew"`, `"extended for
successive"`, `"renew for an additional"`) do not include a bare `"automatically extend"` or
`"extend for an additional"` phrasing. This is a concrete, actionable finding, not just a
theoretical gap — it directly explained part of Renewal Term's measured 61.9% recall. The handbook
confirms it: "extend" and "extension" are keywords for this label (p. 19), and its examples include
"shall automatically extend". **Fixed 2026-10-28:** five phrases were added (`"automatically
extend"`, `"automatically be extended"`, `"renew automatically"`, `"extend for an additional"`,
`"extend for successive"`), raising recall to 67.6% with precision moving from 91.6% to 89.5%.

### Audit Rights — the labels themselves are clean

All three sampled Audit Rights examples are unambiguous, textbook audit-rights clauses ("the right
... to inspect and examine such Records"; "the right ... to inspect all such records"; "may audit
such records ... upon thirty days written notice"). None required any judgment call. This matters
because Audit Rights has Calder's **worst measured recall (31.8%)** — this spot-check rules out
"the ground truth is noisy" as an explanation. The miss rate here is a real detector weakness
(candidate phrases too narrow for how audit clauses are actually drafted), not a labeling artifact,
which is a materially different conclusion than what we found for Exclusivity.

### Checked against the handbook: Notice to Terminate Renewal, Audit Rights, Change of Control

- **Notice to Terminate Renewal:** the handbook's examples use "before the end of the then current
  term" and "prior to the expiration of the then-current term" (p. 23), which our phrases lacked.
  Three phrases were added on 2026-10-28, raising recall from 39.6% to 55.0% and precision from
  41.5% to 49.6%.
- **Audit Rights:** the handbook confirms the labels are broad but consistent. It counts the right
  to inspect books, records or facilities, clauses on audit cost and process, and obligations to
  send financial statements (p. 76–78), while excluding a bare duty to keep records. Our phrases
  cover only the first of these, which fits the 31.8% recall.
- **Change of Control:** the handbook counts restrictions on assignment "by operation of law" as
  Change of Control (p. 74–75), and excludes assignment restrictions that merely apply "in
  connection with" a change of control. `evaluation/CATEGORY_RELIABILITY.md` had said the opposite
  about "operation of law" and was corrected.

## What this changes

- Exclusivity's CUAD scores measure CUAD's **broader definition**, not label noise: CUAD includes
  exclusive licenses and Calder's taxonomy excludes them. Counsel should decide which definition
  Calder's playbook uses. Cap on Liability's consequential-damages example remains debatable; the
  handbook has no Cap on Liability section to settle it.
- Termination for Convenience labels are consistent with the handbook; the gap is in Calder's
  phrases, which miss the plain "may terminate upon 30 days written notice" form.
- Audit Rights' poor recall has no such excuse — the labels are clean, so the fix has to be in the
  candidate phrases or in moving the category toward hosted extraction.
- The Renewal Term and Notice to Terminate Renewal phrase additions were made and measured on
  2026-10-28 (see above). The existing exclusion language for Exclusivity still needs to be
  enforced somewhere (today it only exists as a comment in the
  taxonomy JSON; the deterministic matcher has no mechanism to apply it — see
  `evaluation/independent-check/RESULTS.md` for the concrete false positive this produces).
