create table if not exists public.client_handoffs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'planning' check (status in ('planning','transferring','aftercare','retention','completed')),
  meeting_at timestamptz,
  meeting_url text,
  verification_email text,
  verified_at timestamptz,
  effective_at timestamptz,
  aftercare_ends_at timestamptz,
  admin_removal_notice_at timestamptz,
  admin_removed_at timestamptz,
  retention_ends_at timestamptz,
  archive_generated_at timestamptz,
  archive_downloaded_at timestamptz,
  data_deleted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_handoffs_timeline_check check (
    (aftercare_ends_at is null or effective_at is not null) and
    (retention_ends_at is null or aftercare_ends_at is not null)
  )
);

create table if not exists public.handoff_tasks (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.client_handoffs(id) on delete cascade,
  task_key text not null,
  title text not null,
  category text not null check (category in ('meeting','agreements','verification','transfer','aftercare','retention','closeout')),
  position integer not null default 0,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','complete','not_applicable')),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (handoff_id, task_key),
  constraint handoff_tasks_completion_check check (
    (status = 'complete' and completed_at is not null) or
    (status <> 'complete')
  )
);

create index if not exists handoff_tasks_handoff_position_idx
  on public.handoff_tasks(handoff_id, position);

alter table public.client_handoffs enable row level security;
alter table public.handoff_tasks enable row level security;

drop policy if exists staff_all_client_handoffs on public.client_handoffs;
create policy staff_all_client_handoffs
on public.client_handoffs
for all
to authenticated
using (private.is_src_staff())
with check (private.is_src_staff());

drop policy if exists client_read_own_handoff on public.client_handoffs;
create policy client_read_own_handoff
on public.client_handoffs
for select
to authenticated
using (
  exists (
    select 1
    from public.client_memberships cm
    where cm.client_id = client_handoffs.client_id
      and cm.user_id = (select auth.uid())
  )
);

drop policy if exists staff_all_handoff_tasks on public.handoff_tasks;
create policy staff_all_handoff_tasks
on public.handoff_tasks
for all
to authenticated
using (private.is_src_staff())
with check (private.is_src_staff());

drop policy if exists client_read_own_handoff_tasks on public.handoff_tasks;
create policy client_read_own_handoff_tasks
on public.handoff_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.client_handoffs h
    join public.client_memberships cm on cm.client_id = h.client_id
    where h.id = handoff_tasks.handoff_id
      and cm.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.client_handoffs to authenticated;
grant select, insert, update, delete on public.handoff_tasks to authenticated;

create or replace function public.seed_handoff_tasks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.handoff_tasks (handoff_id, task_key, title, category, position, required)
  values
    (new.id,'meeting_scheduled','Schedule Zoom handoff meeting','meeting',10,true),
    (new.id,'meeting_completed','Complete handoff meeting and review all delivered items','meeting',20,true),
    (new.id,'handoff_agreement_signed','Handoff & Aftercare Agreement fully executed','agreements',30,true),
    (new.id,'retention_agreement_signed','Data Retention Agreement fully executed','agreements',40,true),
    (new.id,'verification_email_confirmed','Verify client transfer email address','verification',50,true),
    (new.id,'github_transferred','Transfer GitHub repository / organization access','transfer',60,true),
    (new.id,'supabase_transferred','Transfer Supabase project / organization access','transfer',70,true),
    (new.id,'hosting_transferred','Transfer hosting and deployment access','transfer',80,false),
    (new.id,'domain_transferred','Transfer domain / DNS ownership or access','transfer',90,false),
    (new.id,'other_accounts_transferred','Transfer remaining third-party accounts','transfer',100,false),
    (new.id,'contract_archive_delivered','Generate and deliver client contract archive ZIP','transfer',110,true),
    (new.id,'aftercare_started','Start included 30-calendar-day aftercare period','aftercare',120,true),
    (new.id,'final_notice_sent','Notify client on final aftercare day before SRCcvde admin removal','closeout',130,true),
    (new.id,'admin_access_removed','Remove SRCcvde admin access from client systems','closeout',140,true),
    (new.id,'retention_period_complete','Complete 30-day post-aftercare retention period','retention',150,true),
    (new.id,'client_access_disabled','Disable client access to SRCcvde workspace','retention',160,true),
    (new.id,'data_erased','Erase retained client project data except permitted business records','retention',170,true),
    (new.id,'handoff_complete','Confirm handoff lifecycle complete','closeout',180,true);
  return new;
end;
$$;

drop trigger if exists seed_handoff_tasks_after_insert on public.client_handoffs;
create trigger seed_handoff_tasks_after_insert
after insert on public.client_handoffs
for each row execute function public.seed_handoff_tasks();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handoff-archives','handoff-archives',false,52428800,array['application/zip'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
