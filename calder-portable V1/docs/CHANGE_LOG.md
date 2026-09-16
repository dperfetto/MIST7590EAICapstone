# Change log

## 2026-09-15 - Sponsor-initiated baseline scope reduction

### Source

The project sponsor clarified that the original brief implicitly required the team to derive Calder standard positions from Bonterms and Common Paper agreements. That domain work was not documented or accounted for in the original scope. The sponsor removed it from the required baseline.

### Required baseline after the change

For each active category in the contract-type playbook, the system determines only whether the provision is present. A positive finding contains:

- provision category;
- supporting source text;
- confidence indicator;
- analysis method; and
- a human disposition with an attributable reason.

The required workflow is intake, ingestion and segmentation, presence identification, flag generation, human review, disposition, durable record, and reporting.

### Removed from the required baseline

- standard-position tables;
- extracted term values;
- characterization of acceptable terms or deviations;
- automated risk severity;
- gap detection based on provisions not found; and
- reporting on terms accepted outside Calder's standard.

Reporting now counts which provisions appear most often across submitted agreements.

### Preserved work

The existing standard, applicability, and severity fields remain in the database as disabled stretch-backlog metadata. The baseline analyzer and UI do not use those fields. Historical records are not overwritten. See `docs/STRETCH_BACKLOG.md`.

### Schedule impact

Time previously allocated to authoring legal standard positions is reallocated to the application, deployment, manual workflow, role controls, audit history, CUAD evaluation, and reliability testing.

### Evaluation impact

The Section 6 evaluation requirement remains. CUAD provides expert-labeled offline evaluation data for presence identification, with precision and recall reported by provision category. Bonterms and Common Paper standard-form agreements remain inputs for the separate deliberately modified agreement check set. They are not used to derive Calder risk standards in the required baseline.

## 2026-09-15 - CUAD evaluation and optional classifier integration

- Mapped all 41 CUAD categories to Calder's taxonomy or explicitly documented them as out of scope.
- Selected ten mapped Calder categories with measurable CUAD support.
- Added a local evaluator for the official 510-contract CUAD v1 release.
- Added category-level precision, recall, F1, and confusion counts.
- Expanded deterministic candidate retrieval with CUAD descriptions and labeling-handbook concepts.
- Added an optional separately hosted CUAD-trained question-answering service.
- Preserved deterministic and guided-manual fallback when hosted analysis is unavailable.
- Kept risk authority outside the classifier. If stretch risk evaluation is later enabled, only Calder's versioned playbook engine may make those decisions.
