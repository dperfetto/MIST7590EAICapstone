-- Clear every agreement from the Calder database.
--
-- PERMANENT: this deletes all agreements, their findings, reviewer
-- decisions and comment threads, and their audit history. There is no undo. Back up first if
-- there is any chance you will need this data (Database > Backups, or export
-- the tables from Table Editor).
--
-- Kept: user accounts and roles (profiles), playbook rules and their version
-- history, and audit events not tied to an agreement (for example role
-- changes and playbook updates).
--
-- The schema deliberately blocks deleting an agreement while its comments,
-- findings or audit events exist (on delete restrict), so those are deleted
-- first.
--
-- How to run: Supabase dashboard > SQL Editor > New query.
--   1. Paste and run STEP 1 only, and check the counts.
--   2. Paste and run STEP 2. It runs in one transaction: if anything fails,
--      nothing is deleted.
--   3. Uploaded files are not removed by SQL (Supabase blocks direct deletes
--      from storage). Remove them in Storage > agreements: select all folders
--      and delete, or use the bucket's "Empty bucket" option.

-- Both steps need the finding_comments table, which schema.sql adds; rerun
-- schema.sql first if STEP 1 says the table does not exist.

-- STEP 1: preview what will be deleted.
select
  (select count(*) from public.agreements) as agreements,
  (select count(*) from public.findings) as findings,
  (select count(*) from public.finding_comments) as comments,
  (select count(*) from public.audit_events where agreement_id is not null)
    as agreement_audit_events,
  (select count(*) from public.audit_events where agreement_id is null)
    as other_audit_events_kept,
  (select count(*) from storage.objects where bucket_id = 'agreements')
    as stored_files_to_remove_in_dashboard;

-- STEP 2: delete.
begin;
delete from public.finding_comments;
delete from public.findings;
delete from public.audit_events where agreement_id is not null;
delete from public.agreements;
commit;
