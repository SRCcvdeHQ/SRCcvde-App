create index if not exists client_handoffs_project_id_idx
  on public.client_handoffs(project_id);

create index if not exists handoff_tasks_completed_by_idx
  on public.handoff_tasks(completed_by);
