-- Replace the core project lifecycle with the requested fixed stage sequence.
-- Preserve existing stage status, due date, and client visibility when renaming rows.

begin;

with stage_map(old_key,new_key,title,description,position) as (
 values
  ('application','introduction','Introduction','Project brief received',1),
  ('discovery','discovery','Discovery','Goals, requirements and fit',2),
  ('proposal','planning','Planning','Scope, pricing and delivery plan',3),
  ('contract','contract','Contract','Review and execute the project agreement',4),
  ('kickoff','building','Building','Kickoff and project workspace setup',5)
)
update public.project_milestones m
set milestone_key=s.new_key,
    title=s.title,
    description=s.description,
    position=s.position
from stage_map s
where m.milestone_key=s.old_key;

-- Keep any already-created canonical stages in the same official order.
update public.project_milestones
set title='Introduction', description='Project brief received', position=1
where milestone_key='introduction';
update public.project_milestones
set title='Discovery', description='Goals, requirements and fit', position=2
where milestone_key='discovery';
update public.project_milestones
set title='Planning', description='Scope, pricing and delivery plan', position=3
where milestone_key='planning';
update public.project_milestones
set title='Contract', description='Review and execute the project agreement', position=4
where milestone_key='contract';
update public.project_milestones
set title='Building', description='Kickoff and project workspace setup', position=5
where milestone_key='building';

-- Align the displayed project phase with its current core milestone.
update public.projects p
set phase = coalesce(
  (
    select m.milestone_key
    from public.project_milestones m
    where m.project_id=p.id and m.status='current'
      and m.milestone_key in ('introduction','discovery','planning','contract','building','developing','qa_qc','launch','aftercare','end_of_service')
    order by m.position
    limit 1
  ),
  case p.phase
    when 'application' then 'introduction'
    when 'kickoff' then 'building'
    when 'design' then 'developing'
    when 'build' then 'developing'
    when 'review' then 'qa_qc'
    when 'complete' then 'end_of_service'
    else p.phase
  end
)
where p.phase in ('application','kickoff','design','build','review','complete')
   or exists (
     select 1 from public.project_milestones m
     where m.project_id=p.id and m.status='current'
       and m.milestone_key in ('introduction','discovery','planning','contract','building','developing','qa_qc','launch','aftercare','end_of_service')
   );

-- Add lifecycle stages missing from existing project roadmaps.
insert into public.project_milestones(project_id,milestone_key,title,description,position,status,client_visible)
select p.id,s.milestone_key,s.title,s.description,s.position,
       case
         when p.status='complete' then 'completed'
         when p.phase=s.milestone_key
          and not exists (
            select 1 from public.project_milestones current_stage
            where current_stage.project_id=p.id and current_stage.status='current'
          )
         then 'current'
         else 'upcoming'
       end,
       true
from public.projects p
cross join (values
  ('introduction','Introduction','Project brief received',1),
  ('discovery','Discovery','Goals, requirements and fit',2),
  ('planning','Planning','Scope, pricing and delivery plan',3),
  ('contract','Contract','Review and execute the project agreement',4),
  ('building','Building','Kickoff and project workspace setup',5),
  ('developing','Developing','Build and refine the agreed solution',6),
  ('qa_qc','QA/QC','Test quality, resolve issues, and prepare release',7),
  ('launch','Launch','Release the completed work',8),
  ('aftercare','Aftercare','Post-launch support and stabilization',9),
  ('end_of_service','End Of Service','Close out services and hand over final materials',10)
) as s(milestone_key,title,description,position)
on conflict (project_id,milestone_key) do nothing;

-- Custom extensions remain after the ten fixed lifecycle stages.
with ranked_custom as (
  select id, 10 + row_number() over (partition by project_id order by position, created_at, id) as next_position
  from public.project_milestones
  where milestone_key like 'custom_%'
)
update public.project_milestones m
set position=r.next_position
from ranked_custom r
where m.id=r.id;

create or replace function public.convert_lead_to_client(p_inquiry_id uuid)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare
  v_inquiry public.project_inquiries%rowtype;
  v_client_id uuid;
  v_project_id uuid;
begin
  if not private.is_src_staff() then raise exception 'not authorized'; end if;
  select * into v_inquiry from public.project_inquiries where id=p_inquiry_id for update;
  if not found then raise exception 'lead not found'; end if;
  select id into v_client_id from public.clients where source_inquiry_id=p_inquiry_id;
  if v_client_id is not null then return v_client_id; end if;

  insert into public.clients(source_inquiry_id,name,primary_contact_name,primary_email,status,portal_unlocked)
  values(p_inquiry_id,coalesce(nullif(trim(v_inquiry.company),''),v_inquiry.name),v_inquiry.name,lower(v_inquiry.email),'onboarding',false)
  returning id into v_client_id;

  insert into public.projects(client_id,source_inquiry_id,name,project_type,status,phase,progress)
  values(v_client_id,p_inquiry_id,coalesce(nullif(trim(v_inquiry.company),''),v_inquiry.project_type)||' — '||v_inquiry.project_type,v_inquiry.project_type,'planning','building',0)
  returning id into v_project_id;

  insert into public.project_milestones(project_id,milestone_key,title,description,position,status,client_visible)
  values
    (v_project_id,'introduction','Introduction','Project brief received',1,'completed',true),
    (v_project_id,'discovery','Discovery','Goals, requirements and fit',2,'completed',true),
    (v_project_id,'planning','Planning','Scope, pricing and delivery plan',3,'completed',true),
    (v_project_id,'contract','Contract','Review and execute the project agreement',4,'completed',true),
    (v_project_id,'building','Building','Kickoff and project workspace setup',5,'current',true),
    (v_project_id,'developing','Developing','Build and refine the agreed solution',6,'upcoming',true),
    (v_project_id,'qa_qc','QA/QC','Test quality, resolve issues, and prepare release',7,'upcoming',true),
    (v_project_id,'launch','Launch','Release the completed work',8,'upcoming',true),
    (v_project_id,'aftercare','Aftercare','Post-launch support and stabilization',9,'upcoming',true),
    (v_project_id,'end_of_service','End Of Service','Close out services and hand over final materials',10,'upcoming',true)
  on conflict (project_id,milestone_key) do nothing;

  insert into public.client_memberships(client_id,user_id,role)
  select v_client_id,im.user_id,'client' from public.inquiry_memberships im where im.inquiry_id=p_inquiry_id
  on conflict do nothing;

  update public.project_inquiries set status='won',updated_at=now() where id=p_inquiry_id;

  insert into public.crm_activity(entity_type,entity_id,action,summary,actor_user_id,metadata)
  values
    ('client',v_client_id,'client_created','Lead converted to client',auth.uid(),jsonb_build_object('source_inquiry_id',p_inquiry_id)),
    ('project',v_project_id,'project_created','Initial project workspace created',auth.uid(),jsonb_build_object('client_id',v_client_id));
  return v_client_id;
end
$function$;

commit;
