# Deployment runbook

How to deploy Calder, confirm it works, and undo a bad release. First-time setup of accounts and projects is in the main [README](../../README.md) (sections 2 and 4); this runbook covers every deployment after that.

Calder runs on two free services:

| Service | What it runs | Who can change it |
|---|---|---|
| Vercel | The React app and the `/api/analyze` serverless function | Vercel project Owner or Administrator |
| Supabase | Sign-in, the Postgres database (with row-level security) and private file storage | Supabase project owner; the Authentication settings are owner-only |

## Environment variables

Set in Vercel under **Settings → Environment Variables**, scoped to **Production, Preview and Development**. Changes only apply to the next build, so redeploy after editing them.

| Variable | Required | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase **anon / publishable** key (safe in the browser; row-level security is the boundary) |
| `SUPABASE_URL` | Yes | Same as `VITE_SUPABASE_URL` (the serverless function cannot read `VITE_` variables) |
| `SUPABASE_ANON_KEY` | Yes | Same as `VITE_SUPABASE_ANON_KEY` |
| `OPENAI_API_KEY` | No | Turns on the Automatic (AI) path. Mark it Sensitive. Without it, Automatic falls back to keyword rules |
| `OPENAI_MODEL` | No | Defaults to `gpt-5-mini` |

Never use the Supabase `service_role` key anywhere in this project, and never commit a key. A committed key must be rotated and the incident logged.

## Before every deployment

1. From `Calder_Agreement_Review_V1/`, run `npm run check` (lint, tests, production build). Do not deploy if it fails.
2. If `supabase/schema.sql` changed, plan to run it on Supabase **before** the new app version goes live (step 2 below). The file is safe to rerun: it only adds or updates, and it never deletes data.
3. If you are about to change the database, export the tables you care about first (**Table Editor → table → Export to CSV**).

## Deploying

1. **Merge to `main`.** Vercel builds and deploys `main` to production automatically.
2. **Database changes (if any).** In Supabase, open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and run it. Rerunning it is how existing deployments pick up new tables, columns and security rules.
3. **Confirm the deploy actually happened.** In Vercel, open **Deployments** and check the newest production deployment matches the merge commit and shows **Ready**. On 10/18 Vercel skipped a production deploy after a merge, so check every time. If it is missing, use **⋯ → Redeploy** on the latest deployment.
4. **Run the smoke test** below.

## Smoke test after deploying

Takes about ten minutes. Use the four demo accounts (see [Demo data](#demo-data-and-role-accounts)).

| # | As | Do | Expect |
|---|---|---|---|
| 1 | Anyone | Open the site signed out | Sign-in page only; nothing else is reachable |
| 2 | Requester | Sign in, **New intake**, upload a small TXT or searchable PDF with **Deterministic only** | Success message; agreement appears in **Agreements** |
| 3 | Requester | Submit a scanned or empty file | Rejected with the reason; nothing stored |
| 4 | Requester | Look at the menu | No Reporting, Audit log or Playbooks; review queue is read-only |
| 5 | Reviewer | Open the queue, review a finding with a reason, then escalate another | Decisions shown on the findings; **Resolve escalation** is not offered to the Reviewer |
| 6 | Approver | Resolve the escalation with a reason | Finding resolved; agreement status updates |
| 7 | Administrator | Open **Audit log** | Steps 2 to 6 appear with names and times; CSV export downloads |
| 8 | Administrator | Open **Reporting** | Review health and review times show numbers, not "No data yet" |
| 9 | Any | Submit with **Automatic** (only if `OPENAI_API_KEY` is set) | Message says AI analysis completed. "AI was unavailable" means the key or the function is misconfigured (see below) |
| 10 | Anyone | **Forgot password?** from the sign-in page | Email arrives and its link opens the deployed site, not `localhost` |

Optional database check of the escalation rule (changes nothing; it rolls back). In the SQL Editor, replace the two IDs and run it. A Reviewer's ID must return no rows; an Approver's must return the finding's ID.

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"REVIEWER-OR-APPROVER-USER-ID","role":"authenticated"}';
update public.findings set status = 'accepted', decision_reason = 'RLS test', decided_at = now()
where id = 'ESCALATED-FINDING-ID' returning id;
rollback;
```

## Rolling back

- **App:** in Vercel, open **Deployments**, find the last good production deployment, and choose **⋯ → Promote to Production**. This takes effect in seconds and does not touch the database.
- **Database:** `schema.sql` only adds tables, columns and policies, so an older app version keeps working against a newer database. There is no automatic down-migration; to undo a data change, restore from the CSV exports taken before the change.
- **Demo data:** rerun `supabase/seed_demo.sql` to reset the six demo agreements. To remove every agreement, use `supabase/clear_agreements.sql` (permanent; read its header first).

## Demo data and role accounts

The brief requires the deployment to be seeded with demonstration data and a working account for each role.

1. On the deployed site, create four accounts through **Create account** (one per role). Every new account starts as a Submitter.
2. Put their emails at the top of `supabase/seed_demo.sql` (STEP 1).
3. Run the whole file in the SQL Editor. It assigns Submitter, Reviewer, Approver and Administrator, and loads six sample agreements covering every review state, with findings, decisions, an escalation, a comment thread and audit history. Due dates are relative to the day it runs.
4. Record the four emails and passwords wherever the team keeps shared credentials (not in the repository).

The sample agreements have no uploaded file, so the queue shows their findings and quotes without a document preview.

## When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Site shows demo data instead of real accounts | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` missing from the build | Set both, then **Redeploy** |
| Automatic always falls back to keyword rules | `OPENAI_API_KEY`, `SUPABASE_URL` or `SUPABASE_ANON_KEY` missing for the function, or the build predates them | Check the variables, redeploy, then read the function log (**Deployments → Functions → api/analyze**) |
| Sign-up or reset emails link to `localhost:3000` | Supabase **Site URL** still the default | **Authentication → URL Configuration**: set Site URL and add the site to **Redirect URLs** (project owner only) |
| Reset emails stop arriving | Supabase's built-in email sender allows only a few emails an hour on the free tier | Wait, or configure SMTP under **Authentication → Emails** |
| "relation does not exist" or missing features after a deploy | `schema.sql` not rerun | Run it (deploy step 2) |
| A user sees the wrong pages | Their role in `profiles` | An Administrator changes it in **Profile & access**; the first Administrator is set in SQL (see README) |
| Safari: "could not extract the PDF text" | PDF.js worker issue in Safari | Try Chrome or Edge; the file is usually fine |
