create or replace function public.sync_handoff_agreement_task()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_task_key text;
begin
  if new.state <> 'final' then
    return new;
  end if;

  if new.name like 'Handoff & Aftercare Agreement%' then
    v_task_key := 'handoff_agreement_signed';
  elsif new.name like 'Data Retention Agreement%' then
    v_task_key := 'retention_agreement_signed';
  else
    return new;
  end if;

  update public.handoff_tasks t
  set status = 'complete',
      completed_at = coalesce(t.completed_at, now())
  from public.client_handoffs h
  where h.id = t.handoff_id
    and h.client_id = new.client_id
    and t.task_key = v_task_key
    and t.status <> 'complete';

  return new;
end;
$$;

drop trigger if exists sync_handoff_agreement_task_after_document on public.client_documents;
create trigger sync_handoff_agreement_task_after_document
after insert or update of state on public.client_documents
for each row
execute function public.sync_handoff_agreement_task();
