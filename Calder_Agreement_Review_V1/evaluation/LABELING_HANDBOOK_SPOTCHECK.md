# Labeling Handbook spot-check

Required by Section 6.1 of the project brief. The CUAD evaluation (`evaluation/results/metrics.csv`)
uses CUAD's expert labels as the answer key without creating any labels of our own. This note is
the separate, required step of actually reading a handful of those labels against the category
definitions the annotators were trained on, to understand what the labels mean and where they're
debatable — not just computing a score against them.

## A note on access

The brief describes "the CUAD Labeling Handbook" (atticusprojectai.org/labeling-handbook) as the
source of category definitions. In practice, that page is a table of contents only — the detailed
inclusion/exclusion guidance is gated behind a purchasable download ("Full clause guidelines are
included in the purchasable handbook download"). We did not purchase it. Instead, we used
`category_descriptions.csv` from the official CUAD GitHub repository
(github.com/The-Atticus-Project/cuad), which is free, public, and is the same question-level
definition CUAD's own annotators were working from (it supplies the exact question text paired
with each category in the dataset itself). This is a real scoping note worth logging: our
taxonomy's `exclusions` field (`src/data/cuad-calder-taxonomy.json`) is more detailed than CUAD's
one-sentence official definitions, because it was also informed by reading actual labeled spans —
which is exactly what this spot-check does below.

## Method

For five categories — chosen to cover a strong performer (Audit Rights, which is reliable when it
fires), a known weak performer (Exclusivity, Calder's worst precision), and three others — we
pulled 2–3 real, randomly sampled positive examples directly from `CUAD_v1.json` (the official
510-contract release) and read them against the official definition from `category_descriptions.csv`.

## Findings

### Exclusivity — the most debatable category we found

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

**This surprised us.** Only example 3 is a genuine exclusive-dealing commitment under CUAD's own
definition — a party agreeing not to deal with others. Examples 1 and 2 are ordinary **IP license
grants** that happen to use the word "exclusive" to describe the license itself (nobody else gets
the same license), not a commitment restricting either party's ability to work with third parties
generally. This is precisely the distinction Calder's own taxonomy warns about
(`cuad-calder-taxonomy.json`: "Do not label an exclusive remedy, an exclusive jurisdiction clause,
or an intellectual-property license merely because it uses the word exclusive"), and finding it
baked into CUAD's own ground truth — not just in Calder's detector — reframes what Exclusivity's
poor measured precision (0.44, the worst of all 10 categories, `evaluation/results/metrics.csv`)
actually means. It isn't only that Calder's deterministic matcher is too loose; the category itself
spans two legally distinct concepts (exclusive dealing vs. exclusive licensing) under one label,
and CUAD's own annotators didn't draw that line consistently in the spans we sampled. The Section
6.3 independent check hit the exact same failure mode independently
(`evaluation/independent-check/RESULTS.md`, `commonpaper-software-license`), which is reassuring —
it means this is a real, reproducible property of the category, not a one-off reading of two spans.

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

### Termination for Convenience — labels that require context the span alone doesn't show

> **Official definition:** "Can a party terminate this contract without cause (solely by giving a
> notice and allowing a waiting period to expire)?"

One sampled example — "LICENSEE may terminate this Agreement upon ninety (90) days written
notice" — contains no "without cause" or "for any reason" language at all. Standing alone, a
90-day notice-to-terminate clause is also consistent with a *for-cause* termination right.
CUAD's annotators evidently had enough surrounding contract context to know this one was actually
unconditional, but the labeled span itself doesn't carry that evidence. This matters for Calder
specifically: our deterministic candidate phrases (`"for any reason"`, `"without cause"`, `"at any
time upon"`) would **not** fire on this exact wording, meaning a real termination-for-convenience
clause drafted this plainly would be a silent miss — consistent with what Section 6.2's error
analysis below finds for this category.

### Renewal Term — "extend" is a common synonym CUAD accepts that our phrases don't catch

Two of three sampled Renewal Term examples use the verb "**extend**" ("the Term ... shall
automatically **extend** for an additional [...] year period"; "the contract will automatically
**extend** for an additional month of service") rather than "renew." Calder's candidate phrases for
Auto Renewal (`"automatically renew"`, `"automatic renewal"`, `"shall renew"`, `"extended for
successive"`, `"renew for an additional"`) do not include a bare `"automatically extend"` or
`"extend for an additional"` phrasing. This is a concrete, actionable finding, not just a
theoretical gap — it directly explains part of Auto Renewal's measured 61.9% recall
(`evaluation/results/metrics.csv`) and is a specific, low-effort fix: add `"automatically extend"`
and `"extend for an additional"` to the candidate phrase list.

### Audit Rights — the labels themselves are clean

All three sampled Audit Rights examples are unambiguous, textbook audit-rights clauses ("the right
... to inspect and examine such Records"; "the right ... to inspect all such records"; "may audit
such records ... upon thirty days written notice"). None required any judgment call. This matters
because Audit Rights has Calder's **worst measured recall (31.8%)** — this spot-check rules out
"the ground truth is noisy" as an explanation. The miss rate here is a real detector weakness
(candidate phrases too narrow for how audit clauses are actually drafted), not a labeling artifact,
which is a materially different conclusion than what we found for Exclusivity.

## What this changes

- Exclusivity and, to a lesser extent, Cap on Liability have a real amount of **label-level**
  ambiguity baked into CUAD itself, not just detector weakness. Their precision/recall numbers
  should be read as somewhat noisier than other categories' for that reason, independent of
  anything Calder does.
- Audit Rights' poor recall has no such excuse — the labels are clean, so the fix has to be in the
  candidate phrases or in moving the category toward hosted extraction.
- Two concrete, low-effort phrase additions are now backed by real examples: `"automatically
  extend"` / `"extend for an additional"` for Auto Renewal, and the existing exclusion language for
  Exclusivity needs to actually be enforced somewhere (today it only exists as a comment in the
  taxonomy JSON; the deterministic matcher has no mechanism to apply it — see
  `evaluation/independent-check/RESULTS.md` for the concrete false positive this produces).
