# Known issues

What Calder does not do well, does not do at all, or does in a way a new team should know about before relying on it. Last reviewed 2026-10-25 against the running application, the evaluation results and the code.

Every finding still goes to a person, so none of these can approve anything on their own. The risk in most of them is the opposite: a clause the system never flags.

## Detection accuracy

| Issue | Impact | What to do |
|---|---|---|
| **Some provisions are often missed.** On 40 CUAD contracts the AI path found 166 of 208 expert-labeled clauses (80%), so about 1 in 5 gets no flag. Warranty Duration (33% found), Cap on Liability and Change of Control (53% each) are weakest. The keyword path misses more: about 3 in 10 overall, and Audit Rights 68% of the time. | "No flag" does not mean "not in the contract". | Treat Calder as triage, not proof of absence. Spot-check agreements for the weak categories. Details: `docs/CONFIDENCE_THRESHOLD_NOTE.md`, `evaluation/CATEGORY_RELIABILITY.md`. |
| **Clauses written as defined terms are missed.** Template agreements that say "the General Cap" instead of "liability shall not exceed" were not detected, before or after editing, in the independent check. | Bonterms and Common Paper style agreements are under-flagged. | Review standard-form agreements manually for Cap on Liability and renewal notice. See `evaluation/independent-check/RESULTS.md`. |
| **The exact-quote check can drop correct AI findings.** An AI finding is discarded if its quote does not appear word for word in the extracted text. In the independent check this removed 3 correct findings. | Lost findings that were right. | Accepted trade-off: it guarantees every flag points to real text. Add a manual finding if a reviewer sees the clause. |
| **Some categories over-flag.** 54% of the keyword path's Exclusivity flags were wrong; Change of Control also over-flags. | Reviewer time spent dismissing. | Dismiss with a reason; the vendor-history note shows past dismissals. |
| **Keyword quotes include neighbouring clauses.** A keyword-path quote is the matched sentence plus the ones before and after, so two provisions can show the same three-clause block. | Longer quotes than necessary. | The provision is still in the quote; read the highlighted category. |
| **Confidence is not a probability.** AI findings score 90 (keyword rules agree) or 75 (they do not); keyword findings score 60 to 96 by matched phrases. | 75 vs 90 says whether two methods agreed, not how likely the flag is right. | Use it for priority only. Recalibrate against reviewer decisions before production. |

## Scope not built

| Issue | Status |
|---|---|
| No comparison to Calder's standard positions, no deviation characterization, no gap detection, no risk severity | Moved to stretch by sponsor Change Notice 1 (9/9/2026). The `severity`, `standard` and `applicability` columns are unused leftovers. See `docs/STRETCH_BACKLOG.md`. |
| The low-confidence threshold is fixed at 85 in the code | Administrators cannot change it (US-11 is partly complete). Changing it means editing the `< 85` checks in `src/pages/Overview.tsx` and `src/pages/review-queue/Queue.tsx`. |
| "Cleared with conditions" has no task tracking | The status and reason are recorded, but there is no owner, due date or completion step for a condition. |
| No OCR, no DOCX | Only searchable PDF and TXT up to 10 MB. Scanned PDFs are rejected before storage with a clear message. |
| No malware scanning of uploads | Fine for the public test corpus; required before real vendor documents. |
| No SSO, no document-retention job | Accounts are email and password. Documents are kept for the project; the production retention policy is described in the decision log but not enforced. |
| A Reviewer can decide findings on an agreement they submitted | No rule prevents it. Decide whether this matters before real use (an open team decision in the brief). |

## Workflow and data

| Issue | Impact | What to do |
|---|---|---|
| **Resolving an escalation overwrites the finding's decision.** The finding keeps only the latest decision, reason and time. | The Reviewer's escalation reason is no longer on the finding, and "time to first decision" for that finding counts from the Approver's decision. | Both decisions are in the audit log, which is the full history. |
| **Re-evaluation adds provisions but never removes findings.** Provisions switched off stay on older reviews, labeled "No longer in playbook". | Intentional: earlier decisions are never changed. | None needed. |
| **Re-evaluation needs the stored file.** If the file is missing, or the agreement used the manual path, the new provisions are left for a reviewer to check by hand. | Some re-evaluations are manual. | The queue says so; add manual findings. |
| **Provisions added to a type have not been measured for that type.** Every type now lists all ten provisions; those outside a type's original scope start switched off. | The CUAD evaluation measures each provision across all contracts, not per type, and CUAD has few NDAs, DPAs or freight agreements. | Check findings closely after switching one on. Measure per-type results before relying on them. |
| **A deactivated user keeps a short window of access.** Deactivation bans sign-in at once, but a session already open stays valid until its token expires (up to an hour by default). In that time the user can still read their own submissions; every role-based action is refused. | A removed user could briefly see their own agreements. | Acceptable for this scope. For immediate cut-off, also sign the user out from Supabase Authentication > Users. |
| **Rerunning `schema.sql` resets playbook rule details.** It rewrites the type, provision, standard, applicability and severity of `rule-1` to `rule-70`. It does not change which rules are switched on. | Direct SQL edits to those columns are lost. | Change rules through the app, or edit the seed list in `schema.sql`. See `docs/PLAYBOOK_MAINTENANCE.md`. |
| **Long agreements skip the AI.** Text longer than 12 sections of 120,000 characters (about 900 pages) is not sent to the AI. | Keyword rules run on the full text instead. | None needed; the notice says so. |

## Environment and operations

| Issue | Impact | What to do |
|---|---|---|
| Plain `npm run dev` has no `/api/analyze` | Automatic always falls back to keyword rules locally. | Use `npx vercel dev` to test the AI path (README, Option C). |
| Demo mode has no access control | In demo mode every role sees every agreement; roles exist only in the browser. | Demo mode is for showing the app. Test security on Supabase. |
| Supabase Authentication settings are owner-only | Only the project owner can fix sign-in or reset URLs. | Make sure the owner is available before deployment changes. |
| Vercel skipped a production deploy once (10/18) | A merge may not reach the live site. | Check the Deployments page after every merge (`docs/DEPLOYMENT_RUNBOOK.md`). |
| Free-tier email limits | Supabase's built-in sender allows only a few sign-up and reset emails an hour. | Configure SMTP for real use. |
| Safari PDF extraction | PDF.js can fail in Safari on valid files. | Use Chrome or Edge. |
| AI sends contract text to OpenAI | Text leaves Calder when Automatic is used. | Use only approved, public test contracts. |
| The optional CUAD-trained classifier may have seen its test contracts in training | Its scores would be inflated. | It is off by default; do not report its metrics. |
| One lint warning | `src/workspace/Workspace.tsx` line 91: a React hook dependency. Builds and tests pass. | Harmless; fix when that file is next changed. |
