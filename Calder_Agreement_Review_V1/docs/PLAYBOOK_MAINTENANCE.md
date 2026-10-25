# Playbook maintenance

The playbook decides which provisions Calder looks for in each agreement type. This guide says who changes it, how, and what has to happen afterwards.

## What the playbook is today

- **Ten provisions**, named exactly as their CUAD categories: Cap on Liability, Renewal Term, Notice to Terminate Renewal, Governing Law, Exclusivity, Termination for Convenience, Change of Control, Audit Rights, Insurance and Warranty Duration.
- **One playbook per agreement type** (the seven intake types). Each has a list of provisions that can be switched on or off.
- **Presence only.** For each switched-on provision, Calder asks one question: is it in this agreement? It returns the quote and a confidence indicator, and a person decides.
- **No standard positions in use.** Sponsor Change Notice 1 (9/9/2026) removed comparison against Calder's standard positions from the required scope. The draft positions are kept as unused data (see [Standard positions](#standard-positions)).

## Who does what

| Change | Who decides | Who makes it | Where |
|---|---|---|---|
| Switch a provision on or off for an agreement type | Associate General Counsel, with the Director of Procurement | Administrator | Playbooks page in the app |
| Re-check older agreements after a change | Review team | Reviewer or Approver | Review queue, **Re-evaluate** |
| Add a provision to a type that does not have it yet | Associate General Counsel | Development team, then Administrator | `supabase/schema.sql`, then the app |
| Add a provision that is not one of the ten | Associate General Counsel | Development team | Code change (below) |
| Change how a provision is detected | Development team, using evaluation results | Development team | `src/data/cuad-calder-taxonomy.json` |
| Approve standard positions (future) | Associate General Counsel | Administrator records them | Not built yet |

Only Administrators can open the Playbooks page, and the database only accepts playbook changes from Administrators.

## Switching a provision on or off

1. Sign in as an Administrator and open **Playbooks**.
2. Choose the agreement type's tab.
3. Use the **Active** switch on the provision's row.
4. Check **Version history** under the table. The change creates the next version (for example "v4 · Exclusivity switched on"), with your name and the date. A database trigger records it, so the history is complete even if someone changes the table directly.
5. New agreements of that type are analyzed under the new version from now on.
6. If the page says agreements "were reviewed under an earlier version", tell the review team. Each of those agreements shows a notice in the review queue listing what changed, and a Reviewer can choose **Re-evaluate**. That runs analysis for the added provisions only. Earlier findings and decisions are never changed, and findings for provisions that were switched off stay on the agreement, labeled "No longer in playbook".

Every change is also written to the audit log.

## Adding a provision to an agreement type that does not have it

Example: the taxonomy already allows Cap on Liability for Mutual NDA, but there is no Mutual NDA rule for it, so it never runs.

1. **Check the taxonomy allows the type.** In `src/data/cuad-calder-taxonomy.json`, the provision's `contractTypes` must include the agreement type. Keyword analysis only checks a provision if it is both switched on in the playbook and listed here. If you add the type, rerun the evaluation (see below).
2. **Add the rule** to the seed list in `supabase/schema.sql` with the next free id (for example `rule-38`). This keeps fresh installs and existing ones the same.
3. **Add it to the live database switched off**, so that switching it on is recorded as a version. In the SQL Editor:

   ```sql
   insert into public.playbook_rules (id, agreement_type, provision, applicability, standard, method, severity, active)
   values ('rule-38', 'Mutual NDA', 'Cap on Liability', 'M', 'Disabled stretch metadata - not used by the baseline', 'Hybrid', 'Medium', false)
   on conflict (id) do nothing;
   ```

4. **Switch it on** in the app (previous section).
5. For demo mode, add the same rule to the `rules` list in `src/lib/demoStore.ts`.

## Adding a provision that is not one of the ten

This is a development change and needs evidence that Calder can find the new provision.

1. **Choose a CUAD category** with enough labeled examples to measure. The brief asks for 8 to 12 categories. Record the reason in `docs/DECISION_AND_AMBIGUITY_LOG.md`.
2. **Add a taxonomy entry** in `src/data/cuad-calder-taxonomy.json`: `calderProvision` (use the CUAD name), `cuadCategories`, `description`, `exclusions`, `contractTypes` and `candidatePhrases`.
3. **Allow it in the AI endpoint:** add the name to `allowedCategories` in `api/analyze.js`. The endpoint refuses provisions not on that list.
4. **Map it** in `evaluation/cuad_to_calder_mapping.csv`.
5. **Add playbook rules** for each agreement type in `supabase/schema.sql`, and in `src/lib/demoStore.ts` for demo mode.
6. **Update the tests.** `tests/application.test.mjs` checks there are exactly ten taxonomy categories; change that number on purpose.
7. **Measure it.** Rerun `python3 evaluation/evaluate_cuad.py` for the keyword path and the AI check set for the AI path (README, section 5). Report how often it finds what is there and how often its flags are wrong, and update `evaluation/CATEGORY_RELIABILITY.md` and the confidence threshold note.
8. **Deploy** using `docs/DEPLOYMENT_RUNBOOK.md`: run `npm run check`, merge, rerun `schema.sql`, then switch the new rules on in the app.

## Changing how a provision is detected

The keyword path uses each provision's `candidatePhrases`; the AI path uses its `description` and `exclusions`. Both are in `src/data/cuad-calder-taxonomy.json`.

- Change them only with evaluation results that show the effect, and rerun both evaluations afterwards.
- Renaming a provision changes what reviewers see. Existing findings keep their old name unless `schema.sql` relabels them, as it did for Renewal Term and Notice to Terminate Renewal on 10/18.
- Record the change and its measured effect in `docs/CHANGE_LOG.md`.

## Standard positions

**Status:** not used. Comparing a clause with Calder's standard position, describing deviations, assigning severity and detecting gaps were all moved to stretch by Change Notice 1.

**Where the drafts are:** the `standard`, `applicability` and `severity` columns of `playbook_rules`. Nothing in the app reads or shows them.

**Who would own them:** the Associate General Counsel approves each position; the Administrator records it. Positions would be versioned like the playbook, so a review is always tied to the positions in force when it was done.

**Before turning this on** (from `docs/STRETCH_BACKLOG.md`):

1. Get sponsor-approved, written positions for each provision and agreement type.
2. Version them and test the comparisons against known examples.
3. Keep the AI to finding evidence; only Calder's playbook rules may judge it.
4. For gap detection, first separate "not detected", "not reviewed" and "confirmed absent", and require a person to confirm absence. A missed clause must never become a confident gap.

**Editing the drafts now:** edit the seed list in `supabase/schema.sql` and rerun it. Rerunning `schema.sql` rewrites the type, provision, method, standard, applicability and severity of `rule-1` to `rule-37`, so direct SQL edits to those columns are lost. It never changes which rules are switched on.

## Keeping a record

| Change | Recorded in |
|---|---|
| Switching a provision on or off | Playbook version history and the audit log (automatic) |
| Re-evaluating an agreement | Audit log (automatic) |
| New or changed provisions, detection changes | `docs/CHANGE_LOG.md` and the pull request |
| Why a provision was added or removed | `docs/DECISION_AND_AMBIGUITY_LOG.md` |
