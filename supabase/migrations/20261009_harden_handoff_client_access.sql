drop policy if exists client_read_own_handoff on public.client_handoffs;
create policy client_read_own_handoff
on public.client_handoffs
for select
to authenticated
using (
  exists (
    select 1
    from public.client_memberships cm
    join public.app_memberships am on am.user_id = cm.user_id
    where cm.client_id = client_handoffs.client_id
      and cm.user_id = (select auth.uid())
      and am.role = 'client'
      and am.status = 'active'
  )
);

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
    join public.app_memberships am on am.user_id = cm.user_id
    where h.id = handoff_tasks.handoff_id
      and cm.user_id = (select auth.uid())
      and am.role = 'client'
      and am.status = 'active'
  )
);
