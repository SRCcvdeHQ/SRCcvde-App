-- Review and apply after deploying the staff MFA UI. No account data is changed.
create or replace function private.has_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_memberships m where m.user_id = (select auth.uid())
      and m.status = 'active'
      and (m.role = 'client' or
        (m.role in ('owner','admin','staff') and (select auth.jwt()->>'aal') = 'aal2'))
  );
$$;
revoke all on function private.has_active_account() from public, anon;
grant execute on function private.has_active_account() to authenticated;

create or replace function private.is_src_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_memberships m
    where m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner','admin','staff') and (select auth.jwt()->>'aal') = 'aal2');
$$;
revoke all on function private.is_src_staff() from public, anon;
grant execute on function private.is_src_staff() to authenticated;

-- Restrictive policies add a mandatory active-account boundary without granting new access.
-- Keep self membership/profile reads available so users can enroll in MFA and see suspension.
do $$ declare item record; begin
  for item in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and c.relrowsecurity
      and ((n.nspname='public' and c.relname not in ('app_memberships','profiles'))
        or (n.nspname='storage' and c.relname='objects'))
  loop
    execute format('drop policy if exists require_active_account on %I.%I',item.nspname,item.relname);
    execute format('create policy require_active_account on %I.%I as restrictive for all to authenticated using (private.has_active_account()) with check (private.has_active_account())',item.nspname,item.relname);
  end loop;
end $$;

revoke all on function public.set_client_portal_access(uuid,boolean) from public,anon;
grant execute on function public.set_client_portal_access(uuid,boolean) to authenticated;

-- Serialize duplicate detection and the rolling per-IP limit in one transaction.
-- Retain historical values so existing inquiries remain valid after the contract update.
alter table public.project_inquiries drop constraint project_inquiries_budget_range_check;
alter table public.project_inquiries add constraint project_inquiries_budget_range_check
  check (budget_range in ('Not sure yet','Under $100','$100–$300','$300–$500','$500+',
    'Under $2,500','$2,500–$5,000','$5,000–$10,000','$10,000–$25,000','$25,000+'));
alter table public.project_inquiries drop constraint project_inquiries_timeline_check;
alter table public.project_inquiries add constraint project_inquiries_timeline_check
  check (timeline in ('Flexible','1-2 weeks','2-4 weeks','4-8 weeks','8+ weeks',
    'Within 1 month','1–3 months','3–6 months','6+ months'));

create or replace function public.submit_intake_atomic(p_input jsonb, p_ip_hash text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare existing_id uuid; recent_count integer;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid source hash'; end if;
  -- Always acquire locks in the same order: source, then brief fingerprint.
  perform pg_advisory_xact_lock(hashtextextended('intake:ip:'||p_ip_hash,0));
  perform pg_advisory_xact_lock(hashtextextended('intake:brief:'||(p_input->>'email')||':'||(p_input->>'details'),0));
  select id into existing_id from public.project_inquiries
    where email = p_input->>'email' and project_type = p_input->>'project_type'
      and details = p_input->>'details' and created_at >= now()-interval '10 minutes' limit 1;
  if existing_id is not null then return jsonb_build_object('ok',true,'duplicate',true); end if;
  select count(*) into recent_count from public.project_inquiries
    where ip_hash=p_ip_hash and created_at>=now()-interval '1 hour';
  if recent_count>=5 then return jsonb_build_object('rate_limited',true); end if;
  insert into public.project_inquiries(name,email,company,project_type,budget_range,timeline,involvement,details,status,source,request_id,ip_hash,origin,metadata)
  values(p_input->>'name',p_input->>'email',nullif(p_input->>'company',''),p_input->>'project_type',
    p_input->>'budget_range',p_input->>'timeline',p_input->>'involvement',p_input->>'details',
    'new','website',p_request_id,p_ip_hash,'https://srccvde.com','{"page":"/start"}'::jsonb);
  return jsonb_build_object('ok',true,'request_id',p_request_id);
end $$;
revoke all on function public.submit_intake_atomic(jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_intake_atomic(jsonb,text,uuid) to service_role;

-- Privileged public RPCs bypass RLS; enforce the same mandatory boundary at entry.
CREATE OR REPLACE FUNCTION public.begin_google_drive_oauth()
 RETURNS TABLE(client_id text, state text, redirect_uri text, scope text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_state text; v_client_id text;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
 if not exists(select 1 from public.app_memberships where user_id=auth.uid() and status='active' and role in ('owner','admin')) then raise exception 'not authorized'; end if;
 select decrypted_secret into v_client_id from vault.decrypted_secrets where name='srccvde_google_client_id' limit 1;
 if v_client_id is null then raise exception 'Google OAuth credentials are not configured'; end if;
 v_state:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.oauth_connection_states(state,provider,user_id,expires_at) values(v_state,'google_drive',auth.uid(),now()+interval '10 minutes');
 return query select v_client_id,v_state,'https://pszxarjungpoqvbwoblf.supabase.co/functions/v1/google-drive-oauth-callback'::text,'https://www.googleapis.com/auth/drive.file'::text;
end $function$
;
CREATE OR REPLACE FUNCTION public.complete_client_action_request(p_action_id uuid)
 RETURNS client_action_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_action public.client_action_requests;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
  select a.* into v_action
  from public.client_action_requests a
  where a.id = p_action_id
    and a.client_visible = true
    and exists (
      select 1 from public.client_memberships cm
      where cm.client_id = a.client_id and cm.user_id = auth.uid()
    )
  for update;

  if v_action.id is null then
    raise exception 'Action request not found or access denied';
  end if;

  if v_action.status <> 'completed' then
    update public.client_action_requests
    set status = 'completed', completed_at = now()
    where id = p_action_id
    returning * into v_action;
  end if;

  return v_action;
end $function$
;
CREATE OR REPLACE FUNCTION public.configure_google_drive_oauth(p_client_id text, p_client_secret text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_id uuid;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
 if not exists(select 1 from public.app_memberships where user_id=auth.uid() and status='active' and role in ('owner','admin')) then raise exception 'not authorized'; end if;
 if length(trim(p_client_id))<10 or length(trim(p_client_secret))<10 then raise exception 'invalid OAuth credentials'; end if;
 select id into v_id from vault.secrets where name='srccvde_google_client_id';
 if v_id is null then perform vault.create_secret(trim(p_client_id),'srccvde_google_client_id','SRCcvde Google OAuth client ID',null);
 else perform vault.update_secret(v_id,trim(p_client_id),'srccvde_google_client_id','SRCcvde Google OAuth client ID',null); end if;
 select id into v_id from vault.secrets where name='srccvde_google_client_secret';
 if v_id is null then perform vault.create_secret(trim(p_client_secret),'srccvde_google_client_secret','SRCcvde Google OAuth client secret',null);
 else perform vault.update_secret(v_id,trim(p_client_secret),'srccvde_google_client_secret','SRCcvde Google OAuth client secret',null); end if;
 insert into public.app_integrations(provider,status,display_name,updated_at)
 values('google_drive','configured','Google Drive',now())
 on conflict(provider) do update set status='configured',display_name='Google Drive',last_error=null,updated_at=now();
end $function$
;
CREATE OR REPLACE FUNCTION public.create_billing_invoice_v2(p_client_id uuid, p_project_id uuid, p_items jsonb, p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_id uuid:=gen_random_uuid();v_number text;v_subtotal bigint;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
 if not exists(select 1 from public.clients where id=p_client_id) then raise exception 'Client not found'; end if;
 if p_project_id is not null and not exists(select 1 from public.projects where id=p_project_id and client_id=p_client_id) then raise exception 'Project does not belong to client'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one line item is required'; end if;
 select sum((x->>'quantity')::numeric*(x->>'unit_amount_cents')::bigint)::bigint into v_subtotal from jsonb_array_elements(p_items) x;
 if coalesce(v_subtotal,0)<=0 then raise exception 'Invoice total must be greater than zero'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where trim(coalesce(x->>'description',''))='' or (x->>'quantity')::numeric<=0 or (x->>'unit_amount_cents')::bigint<0) then raise exception 'Invalid line item'; end if;
 v_number:='SRC-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(v_id::text,'-',''),1,6));
 insert into public.billing_invoices(id,client_id,project_id,invoice_number,subtotal_cents,due_at,notes,created_by)
 values(v_id,p_client_id,p_project_id,v_number,v_subtotal,p_due_at,p_notes,auth.uid());
 insert into public.billing_invoice_items(invoice_id,description,quantity,unit_amount_cents,sort_order)
 select v_id,trim(x->>'description'),(x->>'quantity')::numeric,(x->>'unit_amount_cents')::bigint,ord::integer-1 from jsonb_array_elements(p_items) with ordinality t(x,ord);
 return v_id;
end$function$
;
CREATE OR REPLACE FUNCTION public.get_client_document_library()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid; v_claims jsonb; v_client_id uuid;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
 v_claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 v_uid:=nullif(v_claims->>'sub','')::uuid;
 if v_uid is null then raise exception 'authentication required'; end if;
 select client_id into v_client_id from public.client_memberships where user_id=v_uid limit 1;
 if v_client_id is null then raise exception 'client membership required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'document',to_jsonb(d),
  'request',case when sr.id is null then null else to_jsonb(sr)-'signature_value' end,
  'artifact',case when a.id is null then null else to_jsonb(a) end
 ) order by d.created_at desc)
 from public.client_documents d
 left join lateral (select x.* from public.signature_requests x where x.document_id=d.id and x.signer_side='client' order by x.requested_at desc limit 1) sr on true
 left join public.executed_document_artifacts a on a.document_id=d.id
 where d.client_id=v_client_id and d.client_visible=true),'[]'::jsonb);
end
$function$
;
CREATE OR REPLACE FUNCTION public.get_staff_signature_preview(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid; v_claims jsonb; v_role text; v_status text; v_req public.signature_requests%rowtype; v_ver public.document_versions%rowtype; v_doc public.client_documents%rowtype;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
 v_claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 v_uid:=nullif(v_claims->>'sub','')::uuid;
 if v_uid is null then raise exception 'authentication required'; end if;
 select role::text,status::text into v_role,v_status from public.app_memberships where user_id=v_uid;
 if v_status is distinct from 'active' or v_role not in ('owner','admin','staff') then raise exception 'not authorized'; end if;
 select * into v_req from public.signature_requests where id=p_request_id;
 if not found then raise exception 'signature request not found'; end if;
 select * into v_ver from public.document_versions where id=v_req.document_version_id;
 select * into v_doc from public.client_documents where id=v_req.document_id;
 return jsonb_build_object('request',to_jsonb(v_req)-'signature_value','version',to_jsonb(v_ver),'document',to_jsonb(v_doc));
end
$function$
;
CREATE OR REPLACE FUNCTION public.mark_signature_viewed(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_req public.signature_requests%rowtype;
  v_uid uuid;
  v_email text;
  v_claims jsonb;
  v_hash text;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
  v_claims := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );

  v_uid := nullif(v_claims->>'sub','')::uuid;
  v_email := lower(coalesce(v_claims->>'email',''));

  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select *
  into v_req
  from public.signature_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'signature request not found';
  end if;

  if not (
    v_req.signer_user_id = v_uid
    or (
      v_email <> ''
      and lower(coalesce(v_req.signer_email,'')) = v_email
    )
  ) then
    raise exception 'not authorized';
  end if;

  if v_req.viewed_at is null then
    select content_sha256
    into v_hash
    from public.document_versions
    where id = v_req.document_version_id;

    update public.signature_requests
    set
      viewed_at = now(),
      signer_user_id = coalesce(signer_user_id, v_uid)
    where id = p_request_id;

    insert into public.signature_events (
      signature_request_id,
      event_type,
      actor_user_id,
      document_sha256
    )
    values (
      p_request_id,
      'viewed',
      v_uid,
      v_hash
    );
  end if;
end
$function$
;
CREATE OR REPLACE FUNCTION public.retry_failed_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare n integer;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
 update public.notification_outbox set status='pending',last_error=null,processed_at=null
 where status='failed' and attempts<5;
 get diagnostics n = row_count;
 return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_client_portal_access(p_client_id uuid, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
 update public.app_memberships am set status=case when p_enabled then 'active' else 'suspended' end
 where am.role='client' and exists(select 1 from public.client_memberships cm where cm.client_id=p_client_id and cm.user_id=am.user_id);
 if not found then raise exception 'No linked client account found'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.sign_document(p_request_id uuid, p_legal_name text, p_signature_value text, p_consent boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_req public.signature_requests%rowtype;
  v_hash text;
  v_uid uuid;
  v_email text;
  v_claims jsonb;
begin
 if not private.has_active_account() then raise exception 'Active account with appropriate assurance required'; end if;
  if not p_consent then raise exception 'electronic consent is required'; end if;
  if char_length(trim(p_legal_name)) < 2 then raise exception 'legal name is required'; end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_uid := nullif(v_claims->>'sub','')::uuid;
  v_email := lower(coalesce(v_claims->>'email',''));

  if v_uid is null then raise exception 'authentication required'; end if;

  select * into v_req
  from public.signature_requests
  where id=p_request_id
  for update;

  if not found then raise exception 'signature request not found'; end if;

  if not (
    v_req.signer_user_id = v_uid
    or (v_email <> '' and lower(coalesce(v_req.signer_email,'')) = v_email)
  ) then
    raise exception 'not authorized';
  end if;

  if v_req.status <> 'pending' then raise exception 'request is not pending'; end if;

  select content_sha256 into v_hash
  from public.document_versions
  where id=v_req.document_version_id;

  insert into public.signature_events(signature_request_id,event_type,actor_user_id,legal_name,document_sha256)
  values(p_request_id,'consented',v_uid,trim(p_legal_name),v_hash);

  update public.signature_requests
  set status='signed',
      signed_at=now(),
      signer_user_id=v_uid,
      legal_name=trim(p_legal_name),
      signature_value=coalesce(nullif(trim(p_signature_value),''),trim(p_legal_name)),
      signed_content_sha256=v_hash
  where id=p_request_id;

  insert into public.signature_events(signature_request_id,event_type,actor_user_id,legal_name,document_sha256)
  values(p_request_id,'signed',v_uid,trim(p_legal_name),v_hash);

  if v_req.signature_kind='acknowledgment' then
    update public.document_versions set state='final' where id=v_req.document_version_id;
    update public.client_documents set state='final',fully_executed_at=now() where id=v_req.document_id;
    insert into public.signature_events(signature_request_id,event_type,actor_user_id,legal_name,document_sha256)
    values(p_request_id,'fully_executed',v_uid,trim(p_legal_name),v_hash);
  else
    update public.document_versions set state='signed' where id=v_req.document_version_id;
    update public.client_documents set state='signed',fully_executed_at=null where id=v_req.document_id;
  end if;
end
$function$
;

-- Only the authenticated/MFA-checked Edge Function records manual payments.
CREATE OR REPLACE FUNCTION public.record_billing_payment(p_invoice_id uuid, p_amount_cents bigint, p_method_label text DEFAULT 'Zelle for Business'::text, p_paid_at timestamp with time zone DEFAULT now(), p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_inv public.billing_invoices%rowtype; v_payment uuid:=gen_random_uuid(); v_new_paid bigint;
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Forbidden'; end if;
 if p_amount_cents<=0 then raise exception 'Payment amount must be greater than zero'; end if;
 select * into v_inv from public.billing_invoices where id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found'; end if;
 if v_inv.status in ('void','draft') then raise exception 'Invoice is not payable'; end if;
 if v_inv.amount_paid_cents + p_amount_cents > v_inv.total_cents then raise exception 'Payment exceeds remaining balance'; end if;
 v_new_paid:=v_inv.amount_paid_cents+p_amount_cents;
 insert into public.billing_payments(id,invoice_id,client_id,amount_cents,currency,status,provider,method_label,paid_at,reference,note)
 values(v_payment,v_inv.id,v_inv.client_id,p_amount_cents,v_inv.currency,'succeeded','manual',coalesce(nullif(trim(p_method_label),''),'Recorded by SRCcvde'),coalesce(p_paid_at,now()),nullif(trim(p_reference),''),nullif(trim(p_note),''));
 update public.billing_invoices set amount_paid_cents=v_new_paid,status=case when v_new_paid=total_cents then 'paid' else 'sent' end,paid_at=case when v_new_paid=total_cents then coalesce(p_paid_at,now()) else null end,client_visible=true where id=v_inv.id;
 return v_payment;
end$function$
;

revoke all on function public.record_billing_payment(uuid,bigint,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.record_billing_payment(uuid,bigint,text,timestamptz,text,text) to service_role;
