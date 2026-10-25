-- Demonstration data for a Supabase deployment: one working account per role
-- and six sample agreements covering every review state.
--
-- Before running:
--   1. Run supabase/schema.sql.
--   2. Create four accounts with the app's sign-up page (any emails you like).
--      Every new account starts as a Submitter.
--   3. Put those four emails in STEP 1 below.
-- Then paste this whole file into Supabase: SQL Editor > New query > Run.
--
-- Safe to rerun: it replaces only the demo agreements (ids starting "demo-")
-- and their findings, comments and audit events. Other data is not touched.
-- The sample agreements have no uploaded file, so the review queue shows
-- their findings and source text but no document preview.

-- STEP 1: the four accounts you created. Edit the emails.
drop table if exists demo_accounts;
create temp table demo_accounts (role text primary key, email text not null);
insert into demo_accounts (role, email) values
  ('submitter',     'requester@example.com'),
  ('reviewer',      'reviewer@example.com'),
  ('approver',      'approver@example.com'),
  ('administrator', 'admin@example.com');

-- STEP 2: nothing to edit below this line.
do $$
declare
  missing text;
  requester uuid; reviewer uuid; approver uuid;
  requester_name text; reviewer_name text; approver_name text;
  f_cap uuid := gen_random_uuid();
begin
  select string_agg(d.email, ', ') into missing
  from demo_accounts d left join auth.users u on lower(u.email) = lower(d.email)
  where u.id is null;
  if missing is not null then
    raise exception 'No account found for: %. Sign up with these emails in the app first, or fix STEP 1.', missing;
  end if;

  -- Roles. A profile is created at sign-up; insert one if it is somehow missing.
  insert into public.profiles (id, full_name, role)
  select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), d.role
  from demo_accounts d join auth.users u on lower(u.email) = lower(d.email)
  on conflict (id) do update set role = excluded.role, updated_at = now();

  select u.id, p.full_name into requester, requester_name from demo_accounts d
    join auth.users u on lower(u.email) = lower(d.email) join public.profiles p on p.id = u.id where d.role = 'submitter';
  select u.id, p.full_name into reviewer, reviewer_name from demo_accounts d
    join auth.users u on lower(u.email) = lower(d.email) join public.profiles p on p.id = u.id where d.role = 'reviewer';
  select u.id, p.full_name into approver, approver_name from demo_accounts d
    join auth.users u on lower(u.email) = lower(d.email) join public.profiles p on p.id = u.id where d.role = 'approver';

  -- Remove earlier demo rows; children first, because records cannot be
  -- deleted while anything links to them.
  delete from public.finding_comments where agreement_id like 'demo-%';
  delete from public.audit_events where agreement_id like 'demo-%';
  delete from public.findings where agreement_id like 'demo-%';
  delete from public.agreements where id like 'demo-%';

  -- Agreements. Dates are relative to today so review health and review
  -- times show realistic values whenever this runs.
  insert into public.agreements (id, user_id, vendor, agreement_type, business_unit, needed_by, filename, status, playbook_version, analysis_path, created_at, updated_at)
  select a.id, requester, a.vendor, a.agreement_type, a.business_unit, current_date + a.due_in, a.filename, a.status,
         a.agreement_type || ' v' || coalesce((select max(version) from public.playbook_versions v where v.agreement_type = a.agreement_type), 1),
         a.analysis_path, now() - a.age, now() - a.age
  from (values
    ('demo-1001', 'Northstar Cloud Systems',       'Software Subscription',    'Corporate IT', 12, 'Northstar-MSA.pdf',            'in_review',              'deterministic', interval '3 days'),
    ('demo-1002', 'Apex Field Services',           'Professional Services',    'Operations',    2, 'Apex-PSA.pdf',                 'escalated',              'automatic',     interval '5 days'),
    ('demo-1003', 'Meridian Analytics',            'Data Processing Addendum', 'Finance',      -3, 'Meridian-DPA.pdf',             'ready_for_review',       'automatic',     interval '1 day'),
    ('demo-1004', 'Blue Ridge Logistics',          'Logistics and Freight',    'Distribution', -8, 'BlueRidge-Freight.pdf',        'approved',               'deterministic', interval '20 days'),
    ('demo-1005', 'Northstar Cloud Systems, Inc.', 'Software Subscription',    'Corporate IT', -90, 'Northstar-Order-Form-2026.pdf', 'review_complete',      'automatic',     interval '120 days'),
    ('demo-1006', 'Harbor Point Partners',         'Mutual NDA',               'Corporate IT', 20, 'HarborPoint-NDA.pdf',          'manual_review_required', 'manual',        interval '2 hours')
  ) as a(id, vendor, agreement_type, business_unit, due_in, filename, status, analysis_path, age);

  -- Findings: provision, exact source text, confidence and method, plus the
  -- decision where one has been made.
  insert into public.findings (id, user_id, agreement_id, provision, finding_type, severity, confidence, source_text, reason, analysis_method, status, decision_reason, decided_at, created_at)
  select coalesce(f.id, gen_random_uuid()), requester, f.agreement_id, f.provision, 'present', 'medium', f.confidence, f.source_text,
         case f.method when 'ai' then 'The returned span appears in the document and independent deterministic retrieval found the same category.'
              else 'Provision language was identified. A reviewer must verify the category and supporting text.' end,
         f.method, f.status, f.decision_reason,
         case when f.status = 'open' then null else a.created_at + f.decided_after end,
         a.created_at
  from (values
    (null::uuid, 'demo-1001', 'Notice to Terminate Renewal', 82, 'This Agreement automatically renews for successive twelve-month periods unless Customer provides written notice at least ninety (90) days before expiration.', 'deterministic', 'open', null, null::interval),
    (f_cap,      'demo-1001', 'Cap on Liability',            91, 'Vendor''s aggregate liability shall not exceed fees paid during the six months preceding the event giving rise to the claim.', 'deterministic', 'open', null, null),
    (null,       'demo-1001', 'Governing Law',               96, 'This Agreement is governed by the laws of the State of Georgia.', 'deterministic', 'accepted', 'Georgia law confirmed; matches our approved jurisdictions.', interval '20 hours'),
    (null,       'demo-1002', 'Insurance',                   90, 'Consultant shall maintain commercial general liability and professional liability insurance throughout the term.', 'ai', 'escalated', 'Coverage limits are not stated; Legal to confirm before signature.', interval '1 day'),
    (null,       'demo-1002', 'Termination for Convenience', 75, 'Either party may terminate this Agreement for convenience upon thirty (30) days'' prior written notice.', 'ai', 'open', null, null),
    (null,       'demo-1003', 'Audit Rights',                79, 'Customer may review Supplier''s SOC 2 report and conduct a reasonable audit of records relevant to data security compliance.', 'deterministic', 'open', null, null),
    (null,       'demo-1003', 'Governing Law',               90, 'This Addendum shall be governed by the laws of the State of New York.', 'ai', 'open', null, null),
    (null,       'demo-1004', 'Cap on Liability',            90, 'Carrier''s liability for loss or damage shall not exceed the declared value of the shipment.', 'deterministic', 'accepted', 'Declared-value cap is standard for freight.', interval '3 days'),
    (null,       'demo-1004', 'Governing Law',               96, 'This Agreement is governed by the laws of the State of Tennessee.', 'deterministic', 'accepted', 'Approved jurisdiction.', interval '3 days'),
    (null,       'demo-1005', 'Renewal Term',                90, 'The subscription renews for successive one-year terms unless either party gives sixty (60) days'' written notice of non-renewal.', 'ai', 'accepted', 'Renewal added to the contract calendar.', interval '2 days'),
    (null,       'demo-1005', 'Exclusivity',                 75, 'Customer shall not engage any third party to provide substantially similar services during the Term.', 'ai', 'dismissed', 'Applies only to the pilot order form, which has ended.', interval '2 days 4 hours')
  ) as f(id, agreement_id, provision, confidence, source_text, method, status, decision_reason, decided_after)
  join public.agreements a on a.id = f.agreement_id;

  -- A comment thread between the Requester and the review team.
  insert into public.finding_comments (finding_id, agreement_id, user_id, author_name, author_role, body, created_at) values
    (f_cap, 'demo-1001', requester, requester_name, 'submitter', 'The vendor says six months is their standard cap. Is that a problem for us?', now() - interval '2 days'),
    (f_cap, 'demo-1001', reviewer,  reviewer_name,  'reviewer',  'Probably. Our usual position is twelve months. I am checking with Legal before deciding.', now() - interval '1 day 20 hours');

  -- Audit history for each agreement, in the same form the app writes.
  insert into public.audit_events (user_id, agreement_id, actor_name, event_type, detail, created_at)
  select requester, a.id, requester_name, 'Agreement submitted', a.agreement_type || ' agreement stored; analysis runs as a separate workflow step.', a.created_at
  from public.agreements a where a.id like 'demo-%';
  insert into public.audit_events (user_id, agreement_id, actor_name, event_type, detail, created_at)
  select requester, a.id, requester_name, 'Analysis completed',
         count(f.id) || ' ' || coalesce(max(f.analysis_method), a.analysis_path) || ' presence findings created for human verification.',
         a.created_at + interval '1 minute'
  from public.agreements a left join public.findings f on f.agreement_id = a.id
  where a.id like 'demo-%' group by a.id, a.analysis_path, a.created_at;
  insert into public.audit_events (user_id, agreement_id, actor_name, event_type, detail, created_at)
  select case when f.agreement_id = 'demo-1004' then approver else reviewer end, f.agreement_id,
         case when f.agreement_id = 'demo-1004' then approver_name else reviewer_name end,
         'Finding ' || f.status, f.provision || ': ' || f.decision_reason, f.decided_at
  from public.findings f where f.agreement_id like 'demo-%' and f.decided_at is not null;
  insert into public.audit_events (user_id, agreement_id, actor_name, event_type, detail, created_at)
  select c.user_id, c.agreement_id, c.author_name, 'Comment added', f.provision || ': ' || left(c.body, 80), c.created_at
  from public.finding_comments c join public.findings f on f.id = c.finding_id where c.agreement_id like 'demo-%';

  raise notice 'Demo data loaded: 4 roles assigned, 6 agreements, % findings.', (select count(*) from public.findings where agreement_id like 'demo-%');
end $$;

drop table if exists demo_accounts;
