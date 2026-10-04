# Offline CUAD evaluation

This harness measures Calder's deterministic **presence identification** at the contract/category level. It reports true positives, false positives, false negatives, true negatives, precision, recall, and F1 for every mapped Calder provision plus micro averages.

## Prepare the dataset once

From the application root:

```bash
python3 evaluation/download_cuad.py
```

This downloads the official 105.9 MB CUAD v1 archive from Zenodo to `evaluation/data/CUAD_v1.zip` and verifies its published MD5 checksum. The archive is ignored by Git because CUAD is an evaluation dependency, not an application asset.

You can instead download CUAD yourself and keep it anywhere on your computer. After the ZIP exists, evaluation is fully offline.

## Run the full 510-contract evaluation

```bash
python3 evaluation/evaluate_cuad.py \
  --dataset evaluation/data/CUAD_v1.zip
```

Results are written to:

- `evaluation/results/metrics.csv`
- `evaluation/results/metrics.json`

For a quick smoke test:

```bash
python3 evaluation/evaluate_cuad.py \
  --dataset evaluation/data/CUAD_v1.zip \
  --limit 10 \
  --output-dir evaluation/results-smoke
```

## Interpretation

- Each CUAD contract is one evaluation example per mapped provision.
- A category is positive when CUAD contains at least one expert-labeled span for the mapped category.
- `Assignment / Control` is positive when either CUAD `Anti-Assignment` or `Change Of Control` is positive.
- Calder predicts presence when its CUAD-informed deterministic candidate retrieval finds one or more configured cues.
- The harness does not score risk, acceptable positions, deviations, or gaps.
- Review category-level positive counts before committing to a provision. Low-support categories produce unstable estimates.

CUAD is CC BY 4.0. See `LICENSES/CUAD_ATTRIBUTION.md`.

## Section 6.1: Labeling Handbook spot-check

Running the evaluator against 510 CUAD contracts answers "does the detector agree with the
labels," but Section 6.1 separately requires reading a handful of those labels yourself against
the category definitions, to understand what they mean and where they're debatable. See
`LABELING_HANDBOOK_SPOTCHECK.md` — it found real, concrete label ambiguity in the Exclusivity and
Cap on Liability categories (CUAD's own ground truth sometimes labels an ordinary exclusive IP
license grant as "Exclusivity"), confirmed the Audit Rights labels are clean (so its poor recall is
a detector problem, not a labeling one), and identified one concrete, unfixed candidate-phrase gap
("automatically extend" as an Auto Renewal synonym).

## Section 6.2: which categories are reliable, and why

`CATEGORY_RELIABILITY.md` groups the 10 categories into reliable (Governing Law,
Assignment/Control), precise-but-under-recalling (Insurance, Auto Renewal, Cap on Liability, Audit
Rights, Warranty Duration), and not yet reliable (Exclusivity, Renewal Notice, Termination for
Convenience) — with the specific, evidenced cause for each category's weak spot, not just the
numbers.

## Independent check: documents nothing could have memorized

CUAD is public, so a strong score on it does not rule out memorization or candidate phrases that
were implicitly tuned against it. `independent-check/` holds a second, smaller evaluation built
from 10 standard-form agreements (Bonterms, Common Paper) and 10 team-authored modified versions
of them, with ground truth written before the check was run. Run it with:

```bash
npm run evaluate:independent-check
```

See `independent-check/RESULTS.md` for the full write-up. Committed result: 16/24 checks correct
(66.7%), with three distinct, explainable failure patterns rather than random noise.

## Measure PDF.js ingestion accuracy

Extract the official archive, then compare PDF.js output with CUAD's matching plaintext files:

```bash
unzip evaluation/data/CUAD_v1.zip -d evaluation/data
node evaluation/evaluate_pdf_extraction.mjs \
  --dataset-dir evaluation/data/CUAD_v1
```

The predeclared continue/stop rule is:

- median token recall must be at least 0.90; and
- at least 95% of documents must have token recall of at least 0.80.

Failure exits with status 2 and records `stop-and-fix-ingestion` in the JSON summary. Results are written to `evaluation/pdf-extraction-results/`.
