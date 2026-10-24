# Deliberately deferred stretch backlog

The following work was started before the sponsor's scope amendment and is intentionally not shipped as required behavior.

## Standard positions and deviation characterization

Stored playbook fields include draft applicability codes, standards, and severity values. They are retained for traceability, but the baseline application does not display or execute them. Before enabling this work, the team must obtain sponsor-approved Calder positions, version them, test deterministic comparisons, and confirm that the classifier only supplies document evidence rather than risk judgments.

## Gap detection

Gap detection is disabled. A failed identification is not proof that a clause is absent: it may reflect extraction, segmentation, retrieval, or model failure. Turning every miss into a confident gap would amplify false negatives into misleading legal workflow alerts.

Before enabling gap detection, the team should require:

1. provision-level recall high enough for the intended use;
2. explicit behavior for unsearchable or partially extracted documents;
3. separate `not detected`, `not reviewed`, and `confirmed absent` states;
4. a human confirmation step; and
5. sponsor-approved rules defining which categories are expected by contract type.

## Shipped stretch features (2026-10-24)

These two use only data the baseline already stores, so they add no new judgments and no database changes.

- **Vendor history.** The review queue shows the vendor's other agreements and, per provision, how many times reviewers accepted, dismissed or escalated it, with the latest reason. Each finding card gets a one-line summary ("Accepted 2 of 2 times before"). It is context for the reviewer, not a recommendation: the reviewer still decides every finding.
- **Bulk intake.** Several PDF or TXT files submitted at once with shared details that can be changed per file. Each file runs through the same validation, upload, storage and analysis steps as single intake, one at a time, so a bad file fails on its own and the AI endpoint is not flooded.

## Shipped stretch features (2026-10-24, second set)

These add two tables (`finding_comments`, `playbook_versions`) and a trigger; rerun `supabase/schema.sql` to install them.

- **Clause-level comment threads.** A discussion on each finding between the Requester and the review team. Submitters open the review queue read-only for their own agreements. Row-level security lets only people who can see the agreement read or post, a comment must carry the poster's own account and role, and comments cannot be edited or deleted. Each comment is also written to the audit log.
- **Playbook versioning with re-evaluation.** A trigger on `playbook_rules` records a numbered version whenever a provision is switched on or off, so versions are recorded even for changes made outside the app. Agreements store the version they were analyzed under. Re-evaluating an older review runs analysis only for provisions added since and never changes earlier findings or decisions; provisions switched off are noted, and their findings are kept. When the stored file is unavailable, or the agreement was sent to manual review, the re-evaluation is recorded and the new provisions are left for a reviewer to check by hand.

## Activation rule

Stretch features may begin only after the complete baseline is deployed and its intake, manual identification, review queue, disposition, audit, reporting, roles, and evaluation workflows pass acceptance testing.
