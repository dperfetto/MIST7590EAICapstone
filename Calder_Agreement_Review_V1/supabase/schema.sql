-- Run this entire file in Supabase: SQL Editor > New query > Run.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'submitter' check (role in ('submitter','reviewer','approver','administrator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1)),
    'submitter'
  ) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email,''), '@', 1)), 'submitter'
from auth.users on conflict (id) do nothing;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'submitter');
$$;

create or replace function public.assign_user_role(target_user uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_user_role() <> 'administrator' then
    raise exception 'Administrator access required';
  end if;
  if new_role not in ('submitter','reviewer','approver','administrator') then
    raise exception 'Invalid role';
  end if;
  update public.profiles set role=new_role, updated_at=now()
  where id=target_user;
end; $$;

revoke update on public.profiles from authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;
grant execute on function public.assign_user_role(uuid,text) to authenticated;

create table if not exists public.agreements (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor text not null,
  agreement_type text not null check (agreement_type in ('Software Subscription','Professional Services','Licensing','Logistics and Freight','Data Processing Addendum','Mutual NDA','Other')),
  business_unit text not null,
  needed_by date not null,
  filename text not null,
  storage_key text,
  status text not null default 'ready_for_review',
  playbook_version text not null default 'Global v1',
  review_cycle integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Change Notice 1 uses Calder's procurement-intake agreement types. Preserve
-- existing records by migrating the two former shorthand values.
alter table public.agreements drop constraint if exists agreements_agreement_type_check;
update public.agreements set agreement_type='Software Subscription' where agreement_type='SaaS';
update public.agreements set agreement_type='Data Processing Addendum' where agreement_type='DPA';
alter table public.agreements add constraint agreements_agreement_type_check
  check (agreement_type in ('Software Subscription','Professional Services','Licensing','Logistics and Freight','Data Processing Addendum','Mutual NDA','Other'));

-- The analysis path chosen at intake decides how the review queue presents
-- the document: manual shows the full document, automatic/deterministic show a
-- click-to-download preview. Older rows stay null and get the preview.
alter table public.agreements add column if not exists analysis_path text
  check (analysis_path is null or analysis_path in ('automatic','deterministic','manual'));

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_id text not null references public.agreements(id) on delete cascade,
  provision text not null,
  finding_type text not null default 'present' check (finding_type in ('present','gap','deviation','acceptable')),
  severity text not null check (severity in ('low','medium','high','critical')),
  confidence integer not null check (confidence between 0 and 100),
  source_text text not null,
  reason text not null,
  status text not null default 'open',
  decision_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.findings add column if not exists analysis_method text not null default 'manual' check (analysis_method in ('ai','deterministic','manual'));

-- A recorded decision must include a meaningful reason; undecided findings may leave it null.
alter table public.findings drop constraint if exists findings_decision_reason_nonblank_check;
alter table public.findings add constraint findings_decision_reason_nonblank_check
  check (decided_at is null or length(btrim(coalesce(decision_reason, ''))) > 0);

-- Existing deployments may still have the v1.5 constraint. Historical gap,
-- deviation, and acceptable records are retained, but every new baseline
-- analysis path writes only `present`.
alter table public.findings drop constraint if exists findings_finding_type_check;
alter table public.findings add constraint findings_finding_type_check
  check (finding_type in ('present','gap','deviation','acceptable'));

create table if not exists public.playbook_rules (
  id text primary key,
  agreement_type text not null,
  provision text not null,
  applicability text not null check (applicability in ('R','M','C','N')),
  standard text not null,
  severity text not null,
  version text not null default 'v1',
  active boolean not null default true
);

-- The detection "method" label (Regex, AI, Hybrid, Regex + AI) was display
-- only: analysis never read it, so it was removed on 2026-10-31.
alter table public.playbook_rules drop column if exists method;

comment on column public.playbook_rules.standard is
  'Disabled stretch-backlog metadata. The required presence-only workflow does not compare standards.';
comment on column public.playbook_rules.applicability is
  'Disabled stretch-backlog metadata. The required presence-only workflow does not infer gaps from missing categories.';
comment on column public.playbook_rules.severity is
  'Disabled stretch-backlog metadata. The required presence-only workflow does not assign risk severity.';

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_id text references public.agreements(id) on delete cascade,
  actor_name text not null,
  event_type text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

-- Decisions and audit history are durable records. Account or agreement
-- deletion must be blocked rather than cascading into review history.
alter table public.agreements drop constraint if exists agreements_user_id_fkey;
alter table public.agreements add constraint agreements_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.findings drop constraint if exists findings_user_id_fkey;
alter table public.findings add constraint findings_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.findings drop constraint if exists findings_agreement_id_fkey;
alter table public.findings add constraint findings_agreement_id_fkey
  foreign key (agreement_id) references public.agreements(id) on delete restrict;
alter table public.audit_events drop constraint if exists audit_events_user_id_fkey;
alter table public.audit_events add constraint audit_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.audit_events drop constraint if exists audit_events_agreement_id_fkey;
alter table public.audit_events add constraint audit_events_agreement_id_fkey
  foreign key (agreement_id) references public.agreements(id) on delete restrict;

alter table public.agreements enable row level security;
alter table public.profiles enable row level security;
alter table public.findings enable row level security;
alter table public.playbook_rules enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "Users read profiles" on public.profiles;
create policy "Users read profiles" on public.profiles for select to authenticated
using (id=auth.uid() or public.current_user_role()='administrator');
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated
using (id=auth.uid() or public.current_user_role()='administrator')
with check (id=auth.uid() or public.current_user_role()='administrator');

drop policy if exists "Users manage own agreements" on public.agreements;
drop policy if exists "Role based agreement read" on public.agreements;
create policy "Role based agreement read" on public.agreements for select to authenticated
using (user_id=auth.uid() or public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Submitters create agreements" on public.agreements;
create policy "Submitters create agreements" on public.agreements for insert to authenticated
with check (user_id=auth.uid() and public.current_user_role() in ('submitter','reviewer','approver','administrator'));
drop policy if exists "Review team updates agreements" on public.agreements;
create policy "Review team updates agreements" on public.agreements for update to authenticated
using (public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Users manage own findings" on public.findings;
drop policy if exists "Role based finding read" on public.findings;
create policy "Role based finding read" on public.findings for select to authenticated
using (exists (select 1 from public.agreements a where a.id=agreement_id and (a.user_id=auth.uid() or public.current_user_role() in ('reviewer','approver','administrator'))));
drop policy if exists "Review team creates findings" on public.findings;
create policy "Review team creates findings" on public.findings for insert to authenticated
with check (
  public.current_user_role() in ('reviewer','approver','administrator')
  or (
    user_id=auth.uid()
    and exists (
      select 1 from public.agreements a
      where a.id=agreement_id and a.user_id=auth.uid()
    )
  )
);
-- Reviewers decide open findings and may escalate them; only an Approver or
-- Administrator may change a finding that is already escalated. USING is
-- checked against the row as it stands, so a Reviewer can still move an open
-- finding to escalated; WITH CHECK is explicit because it would otherwise
-- default to the USING condition.
drop policy if exists "Review team updates findings" on public.findings;
create policy "Review team updates findings" on public.findings for update to authenticated
using (
  public.current_user_role() in ('reviewer','approver','administrator')
  and (status <> 'escalated' or public.current_user_role() in ('approver','administrator'))
)
with check (public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Users read audit" on public.audit_events;
create policy "Users read audit" on public.audit_events for select to authenticated
using (auth.uid()=user_id or public.current_user_role() in ('reviewer','approver','administrator'));
drop policy if exists "Users append audit" on public.audit_events;
create policy "Users append audit" on public.audit_events for insert to authenticated
with check (
  auth.uid()=user_id
  and (
    agreement_id is null
    or exists (
      select 1 from public.agreements a
      where a.id=agreement_id
      and (
        a.user_id=auth.uid()
        or public.current_user_role() in ('reviewer','approver','administrator')
      )
    )
  )
);
drop policy if exists "Authenticated users read playbooks" on public.playbook_rules;
create policy "Authenticated users read playbooks" on public.playbook_rules for select to authenticated using (true);
drop policy if exists "Authenticated users update playbooks" on public.playbook_rules;
create policy "Authenticated users update playbooks" on public.playbook_rules for update to authenticated
using (public.current_user_role()='administrator') with check (public.current_user_role()='administrator');

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('agreements','agreements',false,10485760,array['application/pdf','text/plain'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','text/plain'];

drop policy if exists "Users upload own agreement PDFs" on storage.objects;
create policy "Users upload own agreement PDFs" on storage.objects for insert to authenticated with check (bucket_id='agreements' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users read own agreement PDFs" on storage.objects;
create policy "Users read own agreement PDFs" on storage.objects for select to authenticated using (bucket_id='agreements' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Review team reads agreement files" on storage.objects;
create policy "Review team reads agreement files" on storage.objects for select to authenticated
using (bucket_id='agreements' and public.current_user_role() in ('reviewer','approver','administrator'));

-- AI evaluation results (brief Sections 6.1/6.2). Loaded by pasting the SQL
-- file that evaluation/build_ai_check_set_report.py writes into the SQL
-- Editor; the app can only read them, and only Administrators can.
create table if not exists public.evaluation_runs (
  id text primary key,
  label text not null,
  run_at timestamptz not null,
  model text not null,
  agreement_type text not null,
  contracts integer not null,
  ai_calls integer not null,
  ai_fallbacks integer not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.evaluation_results (
  run_id text not null references public.evaluation_runs(id) on delete cascade,
  contract text not null,
  provision text not null,
  expert_present boolean not null,
  calder_flagged boolean not null,
  outcome text not null check (outcome in ('found','missed','wrong_flag','correctly_silent')),
  confidence integer check (confidence is null or confidence between 0 and 100),
  calder_quote text,
  quote_overlaps boolean,
  expert_clause text,
  keyword_flagged boolean not null,
  method_used text not null,
  primary key (run_id, contract, provision)
);

alter table public.evaluation_runs enable row level security;
alter table public.evaluation_results enable row level security;
drop policy if exists "Administrators read evaluation runs" on public.evaluation_runs;
create policy "Administrators read evaluation runs" on public.evaluation_runs for select to authenticated
using (public.current_user_role()='administrator');
drop policy if exists "Administrators read evaluation results" on public.evaluation_results;
create policy "Administrators read evaluation results" on public.evaluation_results for select to authenticated
using (public.current_user_role()='administrator');

-- Section 6.3 independent check: deliberately modified standard-form
-- agreements, each edited provision checked on the original and modified
-- version. Loaded from evaluation/build_independent_check_ai_report.py --sql.
alter table public.evaluation_runs add column if not exists kind text not null default 'cuad_check_set'
  check (kind in ('cuad_check_set','independent_check'));

create table if not exists public.independent_check_results (
  run_id text not null references public.evaluation_runs(id) on delete cascade,
  document text not null,
  agreement_type text not null,
  provision text not null,
  edit_type text not null,
  edit_description text not null,
  version text not null check (version in ('original','modified')),
  expected_present boolean not null,
  ai_flagged boolean not null,
  correct boolean not null,
  confidence integer check (confidence is null or confidence between 0 and 100),
  quote_touches_edit boolean,
  ai_quote text,
  keyword_correct boolean,
  diagnosis text,
  primary key (run_id, document, provision, version)
);

alter table public.independent_check_results enable row level security;
drop policy if exists "Administrators read independent check results" on public.independent_check_results;
create policy "Administrators read independent check results" on public.independent_check_results for select to authenticated
using (public.current_user_role()='administrator');

-- v1.7: provision names match CUAD category names. Existing findings for the
-- two renamed categories are relabeled. "Assignment / Control" findings are
-- left as recorded: that category also covered anti-assignment, so they cannot
-- be relabeled "Change of Control" without changing what was found. Its
-- playbook rules become "Change of Control" through the upsert below.
update public.findings set provision='Renewal Term' where provision='Auto Renewal';
update public.findings set provision='Notice to Terminate Renewal' where provision='Renewal Notice';

-- Every contract type lists all ten provisions. rule-1 to rule-37 are the original
-- playbook (switched on); rule-38 to rule-70 were added on 2026-10-31 switched off,
-- so an Administrator can turn them on. Rerunning this file never changes whether a
-- rule is switched on: "active" is only set when a rule is first inserted.
insert into public.playbook_rules (id,agreement_type,provision,applicability,standard,severity,active) values
('rule-1','Software Subscription','Cap on Liability','R','Cap required; compare basis, amount, and carve-outs','High',true),
('rule-2','Software Subscription','Renewal Term','M','Monitor renewal term; absence is acceptable','Medium',true),
('rule-3','Software Subscription','Notice to Terminate Renewal','C','If auto-renewal exists, notice should be 60 days or less','High',true),
('rule-4','Software Subscription','Governing Law','R','Approved US jurisdiction required','Medium',true),
('rule-5','Software Subscription','Exclusivity','M','Any exclusivity requires review','High',true),
('rule-6','Professional Services','Cap on Liability','R','Cap required and must match approved PSA allocation','High',true),
('rule-7','Professional Services','Termination for Convenience','R','Customer convenience termination expected','High',true),
('rule-8','Professional Services','Insurance','R','CGL and professional coverage required','High',true),
('rule-9','Professional Services','Warranty Duration','R','Services warranty and remedy required','Medium',true),
('rule-10','Data Processing Addendum','Cap on Liability','R','Data exposure must match approved DPA standard','High',true),
('rule-11','Data Processing Addendum','Audit Rights','R','Acceptable audit or assurance mechanism required','High',true),
('rule-12','Data Processing Addendum','Insurance','C','Cyber coverage required for elevated risk tier','High',true),
('rule-13','Data Processing Addendum','Change of Control','C','Processing obligations must survive transfer or control change','High',true),
('rule-14','Data Processing Addendum','Governing Law','R','DPA or incorporated agreement must provide governing law','Medium',true),
('rule-15','Professional Services','Governing Law','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-16','Licensing','Cap on Liability','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-17','Licensing','Renewal Term','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-18','Licensing','Notice to Terminate Renewal','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-19','Licensing','Governing Law','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-20','Licensing','Exclusivity','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-21','Licensing','Change of Control','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-22','Logistics and Freight','Cap on Liability','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-23','Logistics and Freight','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-24','Logistics and Freight','Insurance','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-25','Logistics and Freight','Governing Law','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-26','Mutual NDA','Governing Law','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-27','Mutual NDA','Change of Control','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-28','Other','Cap on Liability','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-29','Other','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-30','Other','Insurance','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-31','Other','Change of Control','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-32','Other','Governing Law','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-33','Other','Renewal Term','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-34','Other','Notice to Terminate Renewal','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-35','Other','Exclusivity','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-36','Other','Audit Rights','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-37','Other','Warranty Duration','M','Disabled stretch metadata - not used by the baseline','Medium',true),
('rule-38','Software Subscription','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-39','Software Subscription','Change of Control','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-40','Software Subscription','Audit Rights','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-41','Software Subscription','Insurance','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-42','Software Subscription','Warranty Duration','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-43','Professional Services','Renewal Term','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-44','Professional Services','Notice to Terminate Renewal','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-45','Professional Services','Exclusivity','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-46','Professional Services','Change of Control','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-47','Professional Services','Audit Rights','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-48','Licensing','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-49','Licensing','Audit Rights','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-50','Licensing','Insurance','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-51','Licensing','Warranty Duration','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-52','Logistics and Freight','Renewal Term','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-53','Logistics and Freight','Notice to Terminate Renewal','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-54','Logistics and Freight','Exclusivity','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-55','Logistics and Freight','Change of Control','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-56','Logistics and Freight','Audit Rights','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-57','Logistics and Freight','Warranty Duration','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-58','Data Processing Addendum','Renewal Term','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-59','Data Processing Addendum','Notice to Terminate Renewal','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-60','Data Processing Addendum','Exclusivity','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-61','Data Processing Addendum','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-62','Data Processing Addendum','Warranty Duration','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-63','Mutual NDA','Cap on Liability','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-64','Mutual NDA','Renewal Term','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-65','Mutual NDA','Notice to Terminate Renewal','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-66','Mutual NDA','Exclusivity','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-67','Mutual NDA','Termination for Convenience','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-68','Mutual NDA','Audit Rights','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-69','Mutual NDA','Insurance','M','Disabled stretch metadata - not used by the baseline','Medium',false),
('rule-70','Mutual NDA','Warranty Duration','M','Disabled stretch metadata - not used by the baseline','Medium',false)
on conflict (id) do update set agreement_type=excluded.agreement_type,provision=excluded.provision,applicability=excluded.applicability,standard=excluded.standard,severity=excluded.severity;

-- Playbook versioning. Every time a provision is switched on or off, the
-- trigger below records a numbered version of that contract type's playbook
-- with the provisions active in it. Agreements record the version they were
-- analyzed under ("Software Subscription v3"), so a review done under an older
-- version can be re-evaluated for the provisions added since.
create table if not exists public.playbook_versions (
  id uuid primary key default gen_random_uuid(),
  agreement_type text not null,
  version integer not null check (version > 0),
  active_provisions text[] not null,
  change_summary text not null,
  changed_by uuid references auth.users(id) on delete restrict,
  changed_by_name text not null default 'System',
  created_at timestamptz not null default now(),
  unique (agreement_type, version)
);

-- Version 1 of each contract type is the playbook as it stands when this runs.
insert into public.playbook_versions (agreement_type, version, active_provisions, change_summary)
select agreement_type, 1, coalesce(array_agg(provision order by provision) filter (where active), '{}'), 'Initial playbook'
from public.playbook_rules group by agreement_type
on conflict (agreement_type, version) do nothing;

create or replace function public.record_playbook_version()
returns trigger language plpgsql security definer set search_path = public as $$
declare next_version integer;
begin
  if new.active is not distinct from old.active then return new; end if;
  perform pg_advisory_xact_lock(hashtext('playbook_versions:' || new.agreement_type));
  select coalesce(max(version), 0) + 1 into next_version
  from public.playbook_versions where agreement_type = new.agreement_type;
  insert into public.playbook_versions (agreement_type, version, active_provisions, change_summary, changed_by, changed_by_name)
  values (
    new.agreement_type,
    next_version,
    array(select provision from public.playbook_rules where agreement_type = new.agreement_type and active order by provision),
    new.provision || case when new.active then ' switched on' else ' switched off' end,
    auth.uid(),
    coalesce((select full_name from public.profiles where id = auth.uid()), 'System')
  );
  return new;
end; $$;

drop trigger if exists on_playbook_rule_toggled on public.playbook_rules;
create trigger on_playbook_rule_toggled after update of active on public.playbook_rules
for each row execute procedure public.record_playbook_version();

alter table public.playbook_versions enable row level security;
drop policy if exists "Authenticated users read playbook versions" on public.playbook_versions;
create policy "Authenticated users read playbook versions" on public.playbook_versions for select to authenticated using (true);
-- No insert, update or delete policies: only the trigger writes versions.

-- Comment threads on findings between the Requester and the review team.
-- Comments are part of the record: they can be added, never edited or deleted.
create table if not exists public.finding_comments (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete restrict,
  agreement_id text not null references public.agreements(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  author_name text not null,
  author_role text not null check (author_role in ('submitter','reviewer','approver','administrator')),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists finding_comments_finding_idx on public.finding_comments (finding_id, created_at);

alter table public.finding_comments enable row level security;
-- Whoever can see the agreement (its submitter and the review team) can read
-- and add to its threads.
drop policy if exists "Agreement participants read comments" on public.finding_comments;
create policy "Agreement participants read comments" on public.finding_comments for select to authenticated
using (exists (select 1 from public.agreements a where a.id=agreement_id and (a.user_id=auth.uid() or public.current_user_role() in ('reviewer','approver','administrator'))));
drop policy if exists "Agreement participants add comments" on public.finding_comments;
create policy "Agreement participants add comments" on public.finding_comments for insert to authenticated
with check (
  user_id=auth.uid()
  and author_role=public.current_user_role()
  and exists (
    select 1 from public.findings f join public.agreements a on a.id=f.agreement_id
    where f.id=finding_id and a.id=agreement_id
    and (a.user_id=auth.uid() or public.current_user_role() in ('reviewer','approver','administrator'))
  )
);
