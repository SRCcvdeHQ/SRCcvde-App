-- Schema-only snapshot captured 2026-10-11. No customer rows, files, or secrets.

-- Apply to a fresh Supabase database instead of replaying historical migrations through 2026-10-09; never to production.

set check_function_bodies = off;
set search_path = public, extensions;

create schema if not exists private;

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists supabase_vault with schema vault;

grant usage on schema public,private to anon,authenticated,service_role;

create type "public"."app_role" as enum ('owner','admin','staff','client');

create type "public"."membership_status" as enum ('invited','active','suspended');

create table "public"."profiles" (
  "id" uuid not null,
  "email" text,
  "full_name" text,
  "avatar_url" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."app_memberships" (
  "user_id" uuid not null,
  "role" app_role default 'client'::app_role not null,
  "status" membership_status default 'invited'::membership_status not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."client_communications" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "project_id" uuid,
  "channel" text default 'note'::text not null,
  "direction" text default 'internal'::text not null,
  "subject" text,
  "body" text not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "recipient_email" text,
  "delivery_status" text default 'logged'::text not null,
  "provider" text,
  "provider_message_id" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "failure_reason" text,
  "client_visible" boolean default true not null
);

create table "public"."inquiry_memberships" (
  "inquiry_id" uuid not null,
  "user_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."clients" (
  "id" uuid default gen_random_uuid() not null,
  "source_inquiry_id" uuid,
  "name" text not null,
  "primary_contact_name" text not null,
  "primary_email" text not null,
  "status" text default 'onboarding'::text not null,
  "drive_folder_id" text,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "portal_unlocked" boolean default false not null
);

create table "public"."crm_activity" (
  "id" uuid default gen_random_uuid() not null,
  "entity_type" text not null,
  "entity_id" uuid not null,
  "action" text not null,
  "summary" text not null,
  "actor_user_id" uuid,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."lead_notes" (
  "id" uuid default gen_random_uuid() not null,
  "inquiry_id" uuid not null,
  "body" text not null,
  "author_user_id" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."client_memberships" (
  "client_id" uuid not null,
  "user_id" uuid not null,
  "role" text default 'client'::text not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."projects" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "source_inquiry_id" uuid,
  "name" text not null,
  "project_type" text,
  "status" text default 'planning'::text not null,
  "phase" text default 'kickoff'::text not null,
  "progress" smallint default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."project_inquiries" (
  "id" uuid default gen_random_uuid() not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "name" text not null,
  "email" text not null,
  "company" text,
  "project_type" text not null,
  "budget_range" text not null,
  "timeline" text not null,
  "involvement" text not null,
  "details" text not null,
  "status" text default 'new'::text not null,
  "source" text default 'website'::text not null,
  "request_id" uuid not null,
  "ip_hash" text,
  "origin" text,
  "user_agent" text,
  "metadata" jsonb default '{}'::jsonb not null
);

create table "public"."project_milestones" (
  "id" uuid default gen_random_uuid() not null,
  "project_id" uuid not null,
  "milestone_key" text not null,
  "title" text not null,
  "description" text,
  "position" smallint default 0 not null,
  "status" text default 'upcoming'::text not null,
  "client_visible" boolean default true not null,
  "due_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."document_versions" (
  "id" uuid default gen_random_uuid() not null,
  "document_id" uuid not null,
  "version_number" integer not null,
  "content_snapshot" text not null,
  "content_sha256" text generated always as (encode(digest(content_snapshot, 'sha256'::text), 'hex'::text)) stored,
  "drive_file_id" text,
  "state" text default 'draft'::text not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null
);

create table "public"."signature_requests" (
  "id" uuid default gen_random_uuid() not null,
  "document_id" uuid not null,
  "document_version_id" uuid not null,
  "client_id" uuid not null,
  "project_id" uuid,
  "signer_user_id" uuid,
  "signer_name" text not null,
  "signer_email" text not null,
  "signer_side" text not null,
  "signature_kind" text not null,
  "sequence" smallint default 1 not null,
  "status" text default 'pending'::text not null,
  "consent_text" text not null,
  "requested_by" uuid default auth.uid(),
  "requested_at" timestamp with time zone default now() not null,
  "viewed_at" timestamp with time zone,
  "signed_at" timestamp with time zone,
  "legal_name" text,
  "signature_value" text,
  "signed_content_sha256" text
);

create table "public"."client_documents" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "project_id" uuid,
  "drive_file_id" text,
  "name" text not null,
  "category" text default 'other'::text not null,
  "state" text default 'draft'::text not null,
  "client_visible" boolean default false not null,
  "created_by" uuid default auth.uid(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "requires_signature" boolean default false not null,
  "signature_kind" text,
  "fully_executed_at" timestamp with time zone,
  "executed_artifact_id" uuid
);

create table "public"."signature_events" (
  "id" uuid default gen_random_uuid() not null,
  "signature_request_id" uuid not null,
  "event_type" text not null,
  "actor_user_id" uuid,
  "legal_name" text,
  "document_sha256" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."notification_preferences" (
  "user_id" uuid not null,
  "project_updates" boolean default true not null,
  "documents" boolean default true not null,
  "approvals" boolean default true not null,
  "messages" boolean default true not null,
  "billing" boolean default true not null,
  "security" boolean default true not null,
  "marketing" boolean default false not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."app_integrations" (
  "provider" text not null,
  "status" text default 'not_configured'::text not null,
  "display_name" text,
  "root_folder_id" text,
  "root_folder_name" text,
  "connected_at" timestamp with time zone,
  "connected_by" uuid,
  "last_error" text,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."oauth_connection_states" (
  "state" text not null,
  "provider" text not null,
  "user_id" uuid not null,
  "expires_at" timestamp with time zone not null,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."executed_document_artifacts" (
  "id" uuid default gen_random_uuid() not null,
  "document_id" uuid not null,
  "document_version_id" uuid not null,
  "client_id" uuid not null,
  "project_id" uuid,
  "storage_bucket" text default 'executed-documents'::text not null,
  "storage_path" text not null,
  "final_sha256" text not null,
  "byte_size" bigint not null,
  "generated_at" timestamp with time zone default now() not null,
  "generated_by" uuid,
  "drive_sync_status" text default 'pending'::text not null,
  "drive_file_id" text,
  "drive_folder_id" text,
  "drive_synced_at" timestamp with time zone,
  "drive_error" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "original_storage_path" text,
  "original_sha256" text,
  "drive_original_file_id" text
);

create table "public"."push_subscriptions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "endpoint" text not null,
  "p256dh" text not null,
  "auth_key" text not null,
  "user_agent" text,
  "enabled" boolean default true not null,
  "consented_at" timestamp with time zone default now() not null,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."notification_consent_events" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "action" text not null,
  "consent_text_version" text not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."notification_outbox" (
  "id" uuid default gen_random_uuid() not null,
  "recipient_user_id" uuid not null,
  "category" text not null,
  "title" text not null,
  "body" text not null,
  "url" text default '/'::text not null,
  "tag" text,
  "status" text default 'pending'::text not null,
  "attempts" integer default 0 not null,
  "last_error" text,
  "created_at" timestamp with time zone default now() not null,
  "processed_at" timestamp with time zone
);

create table "public"."client_action_requests" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "project_id" uuid,
  "title" text not null,
  "description" text,
  "action_type" text default 'review'::text not null,
  "status" text default 'open'::text not null,
  "due_at" timestamp with time zone,
  "response" text,
  "client_visible" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "completed_at" timestamp with time zone
);

create table "public"."billing_invoice_items" (
  "id" uuid default gen_random_uuid() not null,
  "invoice_id" uuid not null,
  "description" text not null,
  "quantity" numeric(12,2) default 1 not null,
  "unit_amount_cents" bigint not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."project_deliverables" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "project_id" uuid not null,
  "name" text not null,
  "description" text,
  "storage_bucket" text default 'project-deliverables'::text not null,
  "storage_path" text not null,
  "file_name" text not null,
  "mime_type" text,
  "byte_size" bigint,
  "version" integer default 1 not null,
  "client_visible" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "source" text default 'srccvde'::text not null,
  "category" text default 'deliverable'::text not null,
  "replaces_deliverable_id" uuid
);

create table "public"."billing_payment_methods" (
  "id" uuid default gen_random_uuid() not null,
  "method" text not null,
  "label" text not null,
  "payment_handle" text not null,
  "instructions" text,
  "active" boolean default true not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null
);

create table "public"."billing_payments" (
  "id" uuid default gen_random_uuid() not null,
  "invoice_id" uuid not null,
  "client_id" uuid not null,
  "amount_cents" bigint not null,
  "currency" text default 'USD'::text not null,
  "status" text default 'pending'::text not null,
  "provider" text,
  "provider_payment_id" text,
  "method_label" text,
  "paid_at" timestamp with time zone,
  "failure_reason" text,
  "created_at" timestamp with time zone default now() not null,
  "reference" text,
  "note" text,
  "artifact_bucket" text,
  "artifact_path" text,
  "artifact_sha256" text
);

create table "public"."billing_invoices" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "project_id" uuid,
  "invoice_number" text not null,
  "status" text default 'draft'::text not null,
  "currency" text default 'USD'::text not null,
  "subtotal_cents" bigint default 0 not null,
  "tax_cents" bigint default 0 not null,
  "total_cents" bigint generated always as (subtotal_cents + tax_cents) stored,
  "amount_paid_cents" bigint default 0 not null,
  "issued_at" timestamp with time zone,
  "due_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "notes" text,
  "client_visible" boolean default false not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "artifact_bucket" text,
  "artifact_path" text,
  "artifact_sha256" text,
  "finalized_at" timestamp with time zone
);

create table "public"."billing_paypal_orders" (
  "id" uuid default gen_random_uuid() not null,
  "invoice_id" uuid not null,
  "client_id" uuid not null,
  "paypal_order_id" text not null,
  "amount_cents" bigint not null,
  "currency" text default 'USD'::text not null,
  "status" text default 'created'::text not null,
  "paypal_capture_id" text,
  "created_at" timestamp with time zone default now() not null,
  "completed_at" timestamp with time zone
);

create table "public"."billing_paypal_config" (
  "environment" text not null,
  "webhook_id" text,
  "webhook_url" text not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."client_handoffs" (
  "id" uuid default gen_random_uuid() not null,
  "client_id" uuid not null,
  "project_id" uuid,
  "status" text default 'planning'::text not null,
  "meeting_at" timestamp with time zone,
  "meeting_url" text,
  "verification_email" text,
  "verified_at" timestamp with time zone,
  "effective_at" timestamp with time zone,
  "aftercare_ends_at" timestamp with time zone,
  "admin_removal_notice_at" timestamp with time zone,
  "admin_removed_at" timestamp with time zone,
  "retention_ends_at" timestamp with time zone,
  "archive_generated_at" timestamp with time zone,
  "archive_downloaded_at" timestamp with time zone,
  "data_deleted_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table "public"."handoff_tasks" (
  "id" uuid default gen_random_uuid() not null,
  "handoff_id" uuid not null,
  "task_key" text not null,
  "title" text not null,
  "category" text not null,
  "position" integer default 0 not null,
  "required" boolean default true not null,
  "status" text default 'pending'::text not null,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

CREATE OR REPLACE FUNCTION public.set_project_inquiries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_app_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id,email,full_name)
  values (new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'))
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.is_src_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.app_memberships
    where user_id = auth.uid()
      and status = 'active'
      and role in ('owner','admin','staff')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.log_lead_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.status is distinct from new.status then
    insert into public.crm_activity(entity_type,entity_id,action,summary,actor_user_id,metadata)
    values('lead',new.id,'status_changed','Lead moved from '||old.status||' to '||new.status,auth.uid(),jsonb_build_object('from',old.status,'to',new.status));
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.log_lead_note()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.crm_activity(entity_type,entity_id,action,summary,actor_user_id,metadata)
  values('lead',new.inquiry_id,'note_added','Internal note added',new.author_user_id,jsonb_build_object('note_id',new.id));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_signable_document(p_client_id uuid, p_project_id uuid, p_name text, p_category text, p_content text, p_signature_kind text DEFAULT 'signature'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_document_id uuid;
  v_version_id uuid;
  v_client public.clients%rowtype;
  v_signer_user uuid;
  v_consent text;
begin
  if not private.is_src_staff() then raise exception 'not authorized'; end if;
  if p_signature_kind not in ('signature','acknowledgment') then raise exception 'invalid signature kind'; end if;
  if char_length(trim(p_content)) < 20 then raise exception 'document content is too short'; end if;

  select * into v_client from public.clients where id=p_client_id;
  if not found then raise exception 'client not found'; end if;

  select user_id into v_signer_user
  from public.client_memberships
  where client_id=p_client_id
  order by created_at
  limit 1;

  insert into public.client_documents(client_id,project_id,name,category,state,client_visible,requires_signature,signature_kind)
  values(p_client_id,p_project_id,trim(p_name),p_category,'requires_approval',true,true,p_signature_kind)
  returning id into v_document_id;

  insert into public.document_versions(document_id,version_number,content_snapshot,state)
  values(v_document_id,1,p_content,'sent')
  returning id into v_version_id;

  v_consent := case when p_signature_kind='signature'
    then 'I have reviewed this document and agree to use an electronic signature. By selecting Sign & Accept, I intend my electronic signature to have the same effect as my handwritten signature.'
    else 'I have reviewed this document. By selecting Reviewed & Acknowledged, I confirm my acknowledgment of this exact document version.'
  end;

  insert into public.signature_requests(document_id,document_version_id,client_id,project_id,signer_user_id,signer_name,signer_email,signer_side,signature_kind,sequence,consent_text)
  values(v_document_id,v_version_id,p_client_id,p_project_id,v_signer_user,v_client.primary_contact_name,v_client.primary_email,'client',p_signature_kind,1,v_consent);

  insert into public.signature_events(signature_request_id,event_type,actor_user_id,document_sha256)
  select sr.id,'requested',auth.uid(),dv.content_sha256
  from public.signature_requests sr
  join public.document_versions dv on dv.id=sr.document_version_id
  where sr.document_version_id=v_version_id and sr.signer_side='client';

  return v_document_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.countersign_document(p_document_id uuid, p_legal_name text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_doc public.client_documents%rowtype;
  v_version public.document_versions%rowtype;
  v_request_id uuid;
  v_email text;
begin
  if not private.is_src_staff() then raise exception 'not authorized'; end if;
  if char_length(trim(p_legal_name)) < 2 then raise exception 'legal name is required'; end if;
  select * into v_doc from public.client_documents where id=p_document_id;
  if not found then raise exception 'document not found'; end if;
  if v_doc.signature_kind <> 'signature' then raise exception 'acknowledgments do not require a countersignature'; end if;
  if v_doc.state='final' then return; end if;
  select * into v_version from public.document_versions where document_id=p_document_id order by version_number desc limit 1;
  if not exists(select 1 from public.signature_requests where document_version_id=v_version.id and signer_side='client' and status='signed') then raise exception 'client signature required first'; end if;
  select email into v_email from public.profiles where id=auth.uid();

  insert into public.signature_requests(document_id,document_version_id,client_id,project_id,signer_user_id,signer_name,signer_email,signer_side,signature_kind,sequence,status,consent_text,signed_at,legal_name,signature_value,signed_content_sha256)
  values(p_document_id,v_version.id,v_doc.client_id,v_doc.project_id,auth.uid(),trim(p_legal_name),coalesce(v_email,'SRCcvde'),'srccvde','signature',2,'signed','SRCcvde countersignature for this exact document version.',now(),trim(p_legal_name),trim(p_legal_name),v_version.content_sha256)
  on conflict(document_version_id,signer_side,signer_email) do update
  set status='signed',signed_at=excluded.signed_at,legal_name=excluded.legal_name,signature_value=excluded.signature_value,signed_content_sha256=excluded.signed_content_sha256
  returning id into v_request_id;

  insert into public.signature_events(signature_request_id,event_type,actor_user_id,legal_name,document_sha256)
  values(v_request_id,'signed',auth.uid(),trim(p_legal_name),v_version.content_sha256);

  update public.document_versions set state='final' where id=v_version.id;
  update public.client_documents set state='final',fully_executed_at=now() where id=p_document_id;

  if v_doc.category='agreement' then
    update public.clients set portal_unlocked=true,status='active',updated_at=now() where id=v_doc.client_id;
    if v_doc.project_id is not null then
      update public.projects set status='active',phase='kickoff',updated_at=now() where id=v_doc.project_id;
      update public.project_milestones set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
        where project_id=v_doc.project_id and milestone_key='contract';
      update public.project_milestones set status='current',updated_at=now()
        where project_id=v_doc.project_id and milestone_key='kickoff';
    end if;
  end if;

  insert into public.signature_events(signature_request_id,event_type,actor_user_id,legal_name,document_sha256)
  values(v_request_id,'fully_executed',auth.uid(),trim(p_legal_name),v_version.content_sha256);
end $function$
;

CREATE OR REPLACE FUNCTION public.google_drive_oauth_credentials()
 RETURNS TABLE(client_id text, client_secret text, refresh_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
begin
 if auth.role()<>'service_role' then raise exception 'not authorized'; end if;
 return query select
  (select decrypted_secret from vault.decrypted_secrets where name='srccvde_google_client_id' limit 1),
  (select decrypted_secret from vault.decrypted_secrets where name='srccvde_google_client_secret' limit 1),
  (select decrypted_secret from vault.decrypted_secrets where name='srccvde_google_refresh_token' limit 1);
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

CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_inquiry_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION private.notify_communication()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if new.direction='outbound' then
  perform private.enqueue_client_notification(new.client_id,'messages',coalesce(new.subject,'New message from SRCcvde'),
   left(new.body,180),coalesce('/project','/'),'message-'||new.id);
 elsif new.direction='inbound' then
  perform private.enqueue_staff_notification('messages',coalesce(new.subject,'New client message'),
   left(new.body,180),'/clients/'||new.client_id,'message-'||new.id);
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.store_google_drive_refresh_token(p_refresh_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_id uuid;
begin
 if auth.role()<>'service_role' then raise exception 'not authorized'; end if;
 if length(trim(p_refresh_token))<20 then raise exception 'invalid refresh token'; end if;
 select id into v_id from vault.secrets where name='srccvde_google_refresh_token';
 if v_id is null then perform vault.create_secret(trim(p_refresh_token),'srccvde_google_refresh_token','SRCcvde Google Drive OAuth refresh token',null);
 else perform vault.update_secret(v_id,trim(p_refresh_token),'srccvde_google_refresh_token','SRCcvde Google Drive OAuth refresh token',null); end if;
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

CREATE OR REPLACE FUNCTION private.web_push_config()
 RETURNS TABLE(public_key text, private_key text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$ select
 (select decrypted_secret from vault.decrypted_secrets where name='srccvde_web_push_vapid_public_key' limit 1),
 (select decrypted_secret from vault.decrypted_secrets where name='srccvde_web_push_vapid_private_key' limit 1) $function$
;

CREATE OR REPLACE FUNCTION public.begin_google_drive_oauth()
 RETURNS TABLE(client_id text, state text, redirect_uri text, scope text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare v_state text; v_client_id text;
begin
 if not exists(select 1 from public.app_memberships where user_id=auth.uid() and status='active' and role in ('owner','admin')) then raise exception 'not authorized'; end if;
 select decrypted_secret into v_client_id from vault.decrypted_secrets where name='srccvde_google_client_id' limit 1;
 if v_client_id is null then raise exception 'Google OAuth credentials are not configured'; end if;
 v_state:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.oauth_connection_states(state,provider,user_id,expires_at) values(v_state,'google_drive',auth.uid(),now()+interval '10 minutes');
 return query select v_client_id,v_state,'https://pszxarjungpoqvbwoblf.supabase.co/functions/v1/google-drive-oauth-callback'::text,'https://www.googleapis.com/auth/drive.file'::text;
end $function$
;

CREATE OR REPLACE FUNCTION private.notify_project_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if old.phase is distinct from new.phase or old.status is distinct from new.status or old.progress is distinct from new.progress then
  perform private.enqueue_client_notification(new.client_id,'project_updates','Project update',
   new.name||' is now in '||replace(new.phase,'_',' ')||' · '||new.progress||'% complete.','/project','project-'||new.id);
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.enqueue_client_notification(p_client uuid, p_category text, p_title text, p_body text, p_url text, p_tag text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
 insert into public.notification_outbox(recipient_user_id,category,title,body,url,tag)
 select distinct cm.user_id,p_category,p_title,p_body,p_url,p_tag
 from public.client_memberships cm
 join public.app_memberships am on am.user_id=cm.user_id
 where cm.client_id=p_client and am.status='active';
$function$
;

CREATE OR REPLACE FUNCTION private.enqueue_staff_notification(p_category text, p_title text, p_body text, p_url text, p_tag text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
 insert into public.notification_outbox(recipient_user_id,category,title,body,url,tag)
 select user_id,p_category,p_title,p_body,p_url,p_tag from public.app_memberships
 where status='active' and role in ('owner','admin','staff');
$function$
;

CREATE OR REPLACE FUNCTION private.notify_signature_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if new.signer_side='client' then
  perform private.enqueue_client_notification(new.client_id,'documents',
   case when new.signature_kind='acknowledgment' then 'Document ready to acknowledge' else 'Signature requested' end,
   new.signer_name||', a document is ready in your SRCcvde workspace.',
   '/documents/'||new.id,'document-'||new.id);
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.notify_signature_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if old.status is distinct from new.status and new.status='signed' and new.signer_side='client' then
  perform private.enqueue_staff_notification('approvals','Client document completed',
   new.signer_name||' completed a document action.','/clients/'||new.client_id,'signed-'||new.id);
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.notify_document_final()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if old.state is distinct from new.state and new.state='final' and new.client_visible then
  perform private.enqueue_client_notification(new.client_id,'documents','Document fully executed',
   new.name||' is fully executed and available in your workspace.','/documents','final-'||new.id);
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.notify_milestone_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare cid uuid;
begin
 if new.client_visible and old.status is distinct from new.status then
  select client_id into cid from public.projects where id=new.project_id;
  perform private.enqueue_client_notification(cid,'project_updates','Milestone updated',
   new.title||' is now '||replace(new.status,'_',' ')||'.','/project','milestone-'||new.id);
 end if;
 return new;
end $function$
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

CREATE OR REPLACE FUNCTION public.get_client_document_library()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid; v_claims jsonb; v_client_id uuid;
begin
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

CREATE OR REPLACE FUNCTION public.complete_client_action_request(p_action_id uuid)
 RETURNS client_action_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_action public.client_action_requests;
begin
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

CREATE OR REPLACE FUNCTION public.set_billing_invoice_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$begin new.updated_at=now();return new;end$function$
;

CREATE OR REPLACE FUNCTION public.retry_failed_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare n integer;
begin
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
 update public.notification_outbox set status='pending',last_error=null,processed_at=null
 where status='failed' and attempts<5;
 get diagnostics n = row_count;
 return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_billing_payment(p_invoice_id uuid, p_amount_cents bigint, p_method_label text DEFAULT 'Zelle for Business'::text, p_paid_at timestamp with time zone DEFAULT now(), p_reference text DEFAULT NULL::text, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_inv public.billing_invoices%rowtype; v_payment uuid:=gen_random_uuid(); v_new_paid bigint;
begin
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
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

CREATE OR REPLACE FUNCTION private.notify_client_action_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if tg_op='INSERT' and new.client_visible and new.status<>'completed' then
  perform private.enqueue_client_notification(new.client_id,'approvals',
   'Action requested by SRCcvde',
   left(new.title || case when new.due_at is not null then ' · Due '||to_char(new.due_at at time zone 'UTC','Mon DD') else '' end,180),
   '/actions','client-action-'||new.id);
 elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='completed' then
  perform private.enqueue_staff_notification('approvals',
   'Client completed an action',
   left(new.title,180),
   '/clients/'||new.client_id,'client-action-complete-'||new.id);
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.notify_successful_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if new.status='succeeded' then
  perform private.enqueue_client_notification(new.client_id,'billing',
   'Payment received',
   'SRCcvde received '||to_char(new.amount_cents/100.0,'FM$999,999,990.00')||case when new.method_label is not null then ' via '||new.method_label else '' end||'.',
   '/billing','payment-'||new.id);
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.prevent_archived_financial_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
begin
  if tg_table_name = 'billing_invoices' and old.finalized_at is not null then
    raise exception 'Finalized invoices cannot be deleted';
  end if;
  if tg_table_name = 'billing_payments' and (old.artifact_path is not null or old.status = 'succeeded') then
    raise exception 'Recorded payments and archived receipts cannot be deleted';
  end if;
  return old;
end $function$
;

CREATE OR REPLACE FUNCTION private.protect_billing_payment_artifact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
begin
  if old.artifact_path is not null then
    if new.artifact_bucket is distinct from old.artifact_bucket
      or new.artifact_path is distinct from old.artifact_path
      or new.artifact_sha256 is distinct from old.artifact_sha256
    then
      raise exception 'Archived payment receipt metadata is immutable';
    end if;
  end if;
  return new;
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

CREATE OR REPLACE FUNCTION private.protect_finalized_billing_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
begin
  if old.finalized_at is not null then
    if new.client_id is distinct from old.client_id
      or new.project_id is distinct from old.project_id
      or new.invoice_number is distinct from old.invoice_number
      or new.currency is distinct from old.currency
      or new.subtotal_cents is distinct from old.subtotal_cents
      or new.tax_cents is distinct from old.tax_cents
      or new.total_cents is distinct from old.total_cents
      or new.issued_at is distinct from old.issued_at
      or new.due_at is distinct from old.due_at
      or new.notes is distinct from old.notes
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.artifact_bucket is distinct from old.artifact_bucket
      or new.artifact_path is distinct from old.artifact_path
      or new.artifact_sha256 is distinct from old.artifact_sha256
      or new.finalized_at is distinct from old.finalized_at
    then
      raise exception 'Finalized invoice content and artifact metadata are immutable';
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.create_billing_invoice(p_client_id uuid, p_project_id uuid, p_description text, p_amount_cents bigint, p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_id uuid:=gen_random_uuid();v_number text;
begin
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
 if p_amount_cents<=0 then raise exception 'Invoice amount must be greater than zero'; end if;
 if not exists(select 1 from public.clients where id=p_client_id) then raise exception 'Client not found'; end if;
 if p_project_id is not null and not exists(select 1 from public.projects where id=p_project_id and client_id=p_client_id) then raise exception 'Project does not belong to client'; end if;
 v_number:='SRC-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(v_id::text,'-',''),1,6));
 insert into public.billing_invoices(id,client_id,project_id,invoice_number,subtotal_cents,due_at,notes,created_by)
 values(v_id,p_client_id,p_project_id,v_number,p_amount_cents,p_due_at,p_notes,auth.uid());
 insert into public.billing_invoice_items(invoice_id,description,quantity,unit_amount_cents,sort_order)
 values(v_id,trim(p_description),1,p_amount_cents,0);
 return v_id;
end$function$
;

CREATE OR REPLACE FUNCTION public.record_paypal_payment(p_paypal_order_id text, p_capture_id text, p_amount_cents bigint, p_paid_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare v_order public.billing_paypal_orders%rowtype;v_inv public.billing_invoices%rowtype;v_payment uuid:=gen_random_uuid();v_new_paid bigint;
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden'; end if;
 select * into v_order from public.billing_paypal_orders where paypal_order_id=p_paypal_order_id for update;
 if not found then raise exception 'PayPal order not found'; end if;
 if v_order.status='completed' then select id into v_payment from public.billing_payments where provider='paypal' and provider_payment_id=p_capture_id limit 1; return v_payment; end if;
 if v_order.amount_cents<>p_amount_cents then raise exception 'Captured amount mismatch'; end if;
 select * into v_inv from public.billing_invoices where id=v_order.invoice_id for update;
 if not found or v_inv.status in ('draft','void','paid') then raise exception 'Invoice is not payable'; end if;
 if v_inv.amount_paid_cents+p_amount_cents>v_inv.total_cents then raise exception 'Payment exceeds remaining balance'; end if;
 v_new_paid:=v_inv.amount_paid_cents+p_amount_cents;
 insert into public.billing_payments(id,invoice_id,client_id,amount_cents,currency,status,provider,provider_payment_id,method_label,paid_at,reference)
 values(v_payment,v_inv.id,v_inv.client_id,p_amount_cents,v_inv.currency,'succeeded','paypal',p_capture_id,'PayPal',coalesce(p_paid_at,now()),p_paypal_order_id);
 update public.billing_invoices set amount_paid_cents=v_new_paid,status=case when v_new_paid=total_cents then 'paid' else 'sent' end,paid_at=case when v_new_paid=total_cents then coalesce(p_paid_at,now()) else null end,client_visible=true where id=v_inv.id;
 update public.billing_paypal_orders set status='completed',paypal_capture_id=p_capture_id,completed_at=coalesce(p_paid_at,now()) where id=v_order.id;
 return v_payment;
end$function$
;

CREATE OR REPLACE FUNCTION public.get_staff_signature_preview(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid; v_claims jsonb; v_role text; v_status text; v_req public.signature_requests%rowtype; v_ver public.document_versions%rowtype; v_doc public.client_documents%rowtype;
begin
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

CREATE OR REPLACE FUNCTION public.set_client_portal_access(p_client_id uuid, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
begin
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
 update public.app_memberships am set status=case when p_enabled then 'active' else 'suspended' end
 where am.role='client' and exists(select 1 from public.client_memberships cm where cm.client_id=p_client_id and cm.user_id=am.user_id);
 if not found then raise exception 'No linked client account found'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.seed_handoff_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_handoff_agreement_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

alter table "public"."project_milestones" add constraint "project_milestones_project_id_milestone_key_key" UNIQUE (project_id, milestone_key);

alter table "public"."signature_requests" add constraint "signature_requests_pkey" PRIMARY KEY (id);

alter table "public"."signature_requests" add constraint "signature_requests_document_version_id_signer_side_signer_e_key" UNIQUE (document_version_id, signer_side, signer_email);

alter table "public"."signature_events" add constraint "signature_events_event_type_check" CHECK ((event_type = ANY (ARRAY['requested'::text, 'viewed'::text, 'consented'::text, 'signed'::text, 'declined'::text, 'cancelled'::text, 'fully_executed'::text])));

alter table "public"."signature_events" add constraint "signature_events_pkey" PRIMARY KEY (id);

alter table "public"."project_inquiries" add constraint "project_inquiries_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 120)));

alter table "public"."project_inquiries" add constraint "project_inquiries_email_check" CHECK (((char_length(email) >= 5) AND (char_length(email) <= 254)));

alter table "public"."project_inquiries" add constraint "project_inquiries_company_check" CHECK (((company IS NULL) OR (char_length(company) <= 160)));

alter table "public"."project_inquiries" add constraint "project_inquiries_project_type_check" CHECK ((project_type = ANY (ARRAY['Website'::text, 'Web app'::text, 'PWA'::text, 'E-commerce'::text, 'Portal or dashboard'::text, 'Operations / internal tool'::text, 'Not sure yet'::text, 'Something else'::text])));

alter table "public"."project_inquiries" add constraint "project_inquiries_budget_range_check" CHECK ((budget_range = ANY (ARRAY['Not sure yet'::text, 'Under $2,500'::text, '$2,500–$5,000'::text, '$5,000–$10,000'::text, '$10,000–$25,000'::text, '$25,000+'::text])));

alter table "public"."project_inquiries" add constraint "project_inquiries_timeline_check" CHECK ((timeline = ANY (ARRAY['Flexible'::text, 'Within 1 month'::text, '1–3 months'::text, '3–6 months'::text, '6+ months'::text])));

alter table "public"."project_inquiries" add constraint "project_inquiries_involvement_check" CHECK ((involvement = ANY (ARRAY['Hands-off'::text, 'Collaborative'::text, 'Very involved'::text, 'Not sure yet'::text])));

alter table "public"."project_inquiries" add constraint "project_inquiries_details_check" CHECK (((char_length(details) >= 20) AND (char_length(details) <= 5000)));

alter table "public"."project_inquiries" add constraint "project_inquiries_source_check" CHECK ((char_length(source) <= 80));

alter table "public"."project_inquiries" add constraint "project_inquiries_pkey" PRIMARY KEY (id);

alter table "public"."project_inquiries" add constraint "project_inquiries_request_id_key" UNIQUE (request_id);

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);

alter table "public"."app_memberships" add constraint "app_memberships_pkey" PRIMARY KEY (user_id);

alter table "public"."project_inquiries" add constraint "project_inquiries_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'discovery'::text, 'proposal'::text, 'contract'::text, 'won'::text, 'lost'::text, 'archived'::text])));

alter table "public"."crm_activity" add constraint "crm_activity_entity_type_check" CHECK ((entity_type = ANY (ARRAY['lead'::text, 'client'::text, 'project'::text, 'document'::text])));

alter table "public"."crm_activity" add constraint "crm_activity_action_check" CHECK (((char_length(action) >= 1) AND (char_length(action) <= 80)));

alter table "public"."crm_activity" add constraint "crm_activity_summary_check" CHECK (((char_length(summary) >= 1) AND (char_length(summary) <= 500)));

alter table "public"."crm_activity" add constraint "crm_activity_pkey" PRIMARY KEY (id);

alter table "public"."lead_notes" add constraint "lead_notes_body_check" CHECK (((char_length(body) >= 1) AND (char_length(body) <= 5000)));

alter table "public"."lead_notes" add constraint "lead_notes_pkey" PRIMARY KEY (id);

alter table "public"."clients" add constraint "clients_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 160)));

alter table "public"."clients" add constraint "clients_primary_contact_name_check" CHECK (((char_length(primary_contact_name) >= 2) AND (char_length(primary_contact_name) <= 120)));

alter table "public"."clients" add constraint "clients_primary_email_check" CHECK (((char_length(primary_email) >= 5) AND (char_length(primary_email) <= 254)));

alter table "public"."clients" add constraint "clients_pkey" PRIMARY KEY (id);

alter table "public"."clients" add constraint "clients_source_inquiry_id_key" UNIQUE (source_inquiry_id);

alter table "public"."client_memberships" add constraint "client_memberships_role_check" CHECK ((role = ANY (ARRAY['client'::text, 'collaborator'::text])));

alter table "public"."client_memberships" add constraint "client_memberships_pkey" PRIMARY KEY (client_id, user_id);

alter table "public"."projects" add constraint "projects_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 200)));

alter table "public"."billing_payment_methods" add constraint "billing_payment_methods_pkey" PRIMARY KEY (id);

alter table "public"."projects" add constraint "projects_status_check" CHECK ((status = ANY (ARRAY['planning'::text, 'active'::text, 'on_hold'::text, 'launching'::text, 'complete'::text, 'archived'::text])));

alter table "public"."projects" add constraint "projects_progress_check" CHECK (((progress >= 0) AND (progress <= 100)));

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY (id);

alter table "public"."projects" add constraint "projects_source_inquiry_id_key" UNIQUE (source_inquiry_id);

alter table "public"."client_documents" add constraint "client_documents_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 255)));

alter table "public"."client_documents" add constraint "client_documents_state_check" CHECK ((state = ANY (ARRAY['draft'::text, 'client_visible'::text, 'requires_approval'::text, 'signed'::text, 'superseded'::text, 'final'::text, 'internal_only'::text])));

alter table "public"."client_documents" add constraint "client_documents_pkey" PRIMARY KEY (id);

alter table "public"."billing_paypal_orders" add constraint "billing_paypal_orders_amount_cents_check" CHECK ((amount_cents > 0));

alter table "public"."client_communications" add constraint "client_communications_direction_check" CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text, 'internal'::text])));

alter table "public"."client_communications" add constraint "client_communications_body_check" CHECK (((char_length(body) >= 1) AND (char_length(body) <= 10000)));

alter table "public"."client_communications" add constraint "client_communications_pkey" PRIMARY KEY (id);

alter table "public"."inquiry_memberships" add constraint "inquiry_memberships_pkey" PRIMARY KEY (inquiry_id, user_id);

alter table "public"."project_milestones" add constraint "project_milestones_title_check" CHECK (((char_length(title) >= 1) AND (char_length(title) <= 160)));

alter table "public"."project_milestones" add constraint "project_milestones_status_check" CHECK ((status = ANY (ARRAY['upcoming'::text, 'current'::text, 'completed'::text, 'blocked'::text])));

alter table "public"."project_milestones" add constraint "project_milestones_pkey" PRIMARY KEY (id);

alter table "public"."client_documents" add constraint "client_documents_signature_kind_check" CHECK ((signature_kind = ANY (ARRAY['signature'::text, 'acknowledgment'::text])));

alter table "public"."document_versions" add constraint "document_versions_version_number_check" CHECK ((version_number > 0));

alter table "public"."document_versions" add constraint "document_versions_content_snapshot_check" CHECK (((char_length(content_snapshot) >= 1) AND (char_length(content_snapshot) <= 100000)));

alter table "public"."document_versions" add constraint "document_versions_state_check" CHECK ((state = ANY (ARRAY['draft'::text, 'sent'::text, 'signed'::text, 'superseded'::text, 'final'::text])));

alter table "public"."document_versions" add constraint "document_versions_pkey" PRIMARY KEY (id);

alter table "public"."document_versions" add constraint "document_versions_document_id_version_number_key" UNIQUE (document_id, version_number);

alter table "public"."signature_requests" add constraint "signature_requests_signer_side_check" CHECK ((signer_side = ANY (ARRAY['client'::text, 'srccvde'::text])));

alter table "public"."signature_requests" add constraint "signature_requests_signature_kind_check" CHECK ((signature_kind = ANY (ARRAY['signature'::text, 'acknowledgment'::text])));

alter table "public"."signature_requests" add constraint "signature_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'signed'::text, 'declined'::text, 'cancelled'::text])));

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_final_sha256_check" CHECK ((final_sha256 ~ '^[0-9a-f]{64}$'::text));

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_byte_size_check" CHECK ((byte_size > 0));

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_drive_sync_status_check" CHECK ((drive_sync_status = ANY (ARRAY['pending'::text, 'synced'::text, 'failed'::text, 'not_configured'::text])));

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_pkey" PRIMARY KEY (id);

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_document_id_key" UNIQUE (document_id);

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_storage_path_key" UNIQUE (storage_path);

alter table "public"."app_integrations" add constraint "app_integrations_status_check" CHECK ((status = ANY (ARRAY['not_configured'::text, 'configured'::text, 'connected'::text, 'error'::text])));

alter table "public"."app_integrations" add constraint "app_integrations_pkey" PRIMARY KEY (provider);

alter table "public"."oauth_connection_states" add constraint "oauth_connection_states_pkey" PRIMARY KEY (state);

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY (id);

alter table "public"."push_subscriptions" add constraint "push_subscriptions_endpoint_key" UNIQUE (endpoint);

alter table "public"."notification_preferences" add constraint "notification_preferences_pkey" PRIMARY KEY (user_id);

alter table "public"."notification_consent_events" add constraint "notification_consent_events_action_check" CHECK ((action = ANY (ARRAY['granted'::text, 'denied'::text, 'revoked'::text])));

alter table "public"."notification_consent_events" add constraint "notification_consent_events_pkey" PRIMARY KEY (id);

alter table "public"."notification_outbox" add constraint "notification_outbox_category_check" CHECK ((category = ANY (ARRAY['project_updates'::text, 'documents'::text, 'approvals'::text, 'messages'::text, 'billing'::text, 'security'::text, 'marketing'::text])));

alter table "public"."notification_outbox" add constraint "notification_outbox_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'skipped'::text, 'failed'::text])));

alter table "public"."notification_outbox" add constraint "notification_outbox_pkey" PRIMARY KEY (id);

alter table "public"."client_action_requests" add constraint "client_action_requests_pkey" PRIMARY KEY (id);

alter table "public"."project_deliverables" add constraint "project_deliverables_pkey" PRIMARY KEY (id);

alter table "public"."client_communications" add constraint "client_communications_channel_check" CHECK ((channel = ANY (ARRAY['email'::text, 'portal'::text, 'phone'::text, 'meeting'::text, 'text'::text, 'internal'::text])));

alter table "public"."billing_invoices" add constraint "billing_invoices_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'overdue'::text, 'void'::text])));

alter table "public"."billing_invoices" add constraint "billing_invoices_subtotal_cents_check" CHECK ((subtotal_cents >= 0));

alter table "public"."billing_invoices" add constraint "billing_invoices_tax_cents_check" CHECK ((tax_cents >= 0));

alter table "public"."billing_invoices" add constraint "billing_invoices_amount_paid_cents_check" CHECK ((amount_paid_cents >= 0));

alter table "public"."billing_invoices" add constraint "billing_invoices_pkey" PRIMARY KEY (id);

alter table "public"."billing_invoices" add constraint "billing_invoices_invoice_number_key" UNIQUE (invoice_number);

alter table "public"."billing_invoice_items" add constraint "billing_invoice_items_quantity_check" CHECK ((quantity > (0)::numeric));

alter table "public"."billing_invoice_items" add constraint "billing_invoice_items_unit_amount_cents_check" CHECK ((unit_amount_cents >= 0));

alter table "public"."billing_invoice_items" add constraint "billing_invoice_items_pkey" PRIMARY KEY (id);

alter table "public"."billing_payments" add constraint "billing_payments_amount_cents_check" CHECK ((amount_cents > 0));

alter table "public"."billing_payments" add constraint "billing_payments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text])));

alter table "public"."billing_payments" add constraint "billing_payments_pkey" PRIMARY KEY (id);

alter table "public"."billing_paypal_orders" add constraint "billing_paypal_orders_status_check" CHECK ((status = ANY (ARRAY['created'::text, 'approved'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])));

alter table "public"."billing_paypal_orders" add constraint "billing_paypal_orders_pkey" PRIMARY KEY (id);

alter table "public"."billing_paypal_orders" add constraint "billing_paypal_orders_paypal_order_id_key" UNIQUE (paypal_order_id);

alter table "public"."billing_paypal_orders" add constraint "billing_paypal_orders_paypal_capture_id_key" UNIQUE (paypal_capture_id);

alter table "public"."billing_paypal_config" add constraint "billing_paypal_config_environment_check" CHECK ((environment = ANY (ARRAY['sandbox'::text, 'live'::text])));

alter table "public"."billing_paypal_config" add constraint "billing_paypal_config_pkey" PRIMARY KEY (environment);

alter table "public"."clients" add constraint "clients_status_check" CHECK ((status = ANY (ARRAY['onboarding'::text, 'active'::text, 'inactive'::text, 'complete'::text, 'archived'::text])));

alter table "public"."client_handoffs" add constraint "client_handoffs_status_check" CHECK ((status = ANY (ARRAY['planning'::text, 'transferring'::text, 'aftercare'::text, 'retention'::text, 'completed'::text])));

alter table "public"."client_handoffs" add constraint "client_handoffs_timeline_check" CHECK ((((aftercare_ends_at IS NULL) OR (effective_at IS NOT NULL)) AND ((retention_ends_at IS NULL) OR (aftercare_ends_at IS NOT NULL))));

alter table "public"."client_handoffs" add constraint "client_handoffs_pkey" PRIMARY KEY (id);

alter table "public"."client_handoffs" add constraint "client_handoffs_client_id_key" UNIQUE (client_id);

alter table "public"."handoff_tasks" add constraint "handoff_tasks_category_check" CHECK ((category = ANY (ARRAY['meeting'::text, 'agreements'::text, 'verification'::text, 'transfer'::text, 'aftercare'::text, 'retention'::text, 'closeout'::text])));

alter table "public"."handoff_tasks" add constraint "handoff_tasks_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'complete'::text, 'not_applicable'::text])));

alter table "public"."handoff_tasks" add constraint "handoff_tasks_completion_check" CHECK ((((status = 'complete'::text) AND (completed_at IS NOT NULL)) OR (status <> 'complete'::text)));

alter table "public"."handoff_tasks" add constraint "handoff_tasks_pkey" PRIMARY KEY (id);

alter table "public"."handoff_tasks" add constraint "handoff_tasks_handoff_id_task_key_key" UNIQUE (handoff_id, task_key);

alter table "public"."project_milestones" add constraint "project_milestones_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

alter table "public"."signature_requests" add constraint "signature_requests_document_id_fkey" FOREIGN KEY (document_id) REFERENCES client_documents(id) ON DELETE CASCADE;

alter table "public"."signature_requests" add constraint "signature_requests_document_version_id_fkey" FOREIGN KEY (document_version_id) REFERENCES document_versions(id) ON DELETE RESTRICT;

alter table "public"."signature_requests" add constraint "signature_requests_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."signature_requests" add constraint "signature_requests_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table "public"."signature_requests" add constraint "signature_requests_signer_user_id_fkey" FOREIGN KEY (signer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."signature_requests" add constraint "signature_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."signature_events" add constraint "signature_events_signature_request_id_fkey" FOREIGN KEY (signature_request_id) REFERENCES signature_requests(id) ON DELETE CASCADE;

alter table "public"."signature_events" add constraint "signature_events_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."app_memberships" add constraint "app_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."crm_activity" add constraint "crm_activity_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."lead_notes" add constraint "lead_notes_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES project_inquiries(id) ON DELETE CASCADE;

alter table "public"."lead_notes" add constraint "lead_notes_author_user_id_fkey" FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."project_deliverables" add constraint "project_deliverables_replaces_deliverable_id_fkey" FOREIGN KEY (replaces_deliverable_id) REFERENCES project_deliverables(id) ON DELETE SET NULL;

alter table "public"."clients" add constraint "clients_source_inquiry_id_fkey" FOREIGN KEY (source_inquiry_id) REFERENCES project_inquiries(id) ON DELETE SET NULL;

alter table "public"."clients" add constraint "clients_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."client_memberships" add constraint "client_memberships_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."client_memberships" add constraint "client_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."projects" add constraint "projects_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."projects" add constraint "projects_source_inquiry_id_fkey" FOREIGN KEY (source_inquiry_id) REFERENCES project_inquiries(id) ON DELETE SET NULL;

alter table "public"."client_documents" add constraint "client_documents_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."client_documents" add constraint "client_documents_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

alter table "public"."client_documents" add constraint "client_documents_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."client_communications" add constraint "client_communications_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."client_communications" add constraint "client_communications_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table "public"."client_communications" add constraint "client_communications_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."inquiry_memberships" add constraint "inquiry_memberships_inquiry_id_fkey" FOREIGN KEY (inquiry_id) REFERENCES project_inquiries(id) ON DELETE CASCADE;

alter table "public"."inquiry_memberships" add constraint "inquiry_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."document_versions" add constraint "document_versions_document_id_fkey" FOREIGN KEY (document_id) REFERENCES client_documents(id) ON DELETE CASCADE;

alter table "public"."document_versions" add constraint "document_versions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_document_id_fkey" FOREIGN KEY (document_id) REFERENCES client_documents(id) ON DELETE CASCADE;

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_document_version_id_fkey" FOREIGN KEY (document_version_id) REFERENCES document_versions(id) ON DELETE RESTRICT;

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table "public"."executed_document_artifacts" add constraint "executed_document_artifacts_generated_by_fkey" FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."client_documents" add constraint "client_documents_executed_artifact_id_fkey" FOREIGN KEY (executed_artifact_id) REFERENCES executed_document_artifacts(id) ON DELETE SET NULL;

alter table "public"."app_integrations" add constraint "app_integrations_connected_by_fkey" FOREIGN KEY (connected_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table "public"."oauth_connection_states" add constraint "oauth_connection_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."notification_preferences" add constraint "notification_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."client_handoffs" add constraint "client_handoffs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table "public"."notification_consent_events" add constraint "notification_consent_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."notification_outbox" add constraint "notification_outbox_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table "public"."client_action_requests" add constraint "client_action_requests_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."client_action_requests" add constraint "client_action_requests_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

alter table "public"."project_deliverables" add constraint "project_deliverables_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."project_deliverables" add constraint "project_deliverables_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

alter table "public"."billing_invoices" add constraint "billing_invoices_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."billing_invoices" add constraint "billing_invoices_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

alter table "public"."billing_invoice_items" add constraint "billing_invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE CASCADE;

alter table "public"."billing_payments" add constraint "billing_payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE CASCADE;

alter table "public"."billing_payments" add constraint "billing_payments_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."billing_paypal_orders" add constraint "billing_paypal_orders_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE CASCADE;

alter table "public"."billing_paypal_orders" add constraint "billing_paypal_orders_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."client_handoffs" add constraint "client_handoffs_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

alter table "public"."handoff_tasks" add constraint "handoff_tasks_handoff_id_fkey" FOREIGN KEY (handoff_id) REFERENCES client_handoffs(id) ON DELETE CASCADE;

alter table "public"."handoff_tasks" add constraint "handoff_tasks_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX signature_requests_client_id_idx ON public.signature_requests USING btree (client_id);

CREATE INDEX client_documents_client_idx ON public.client_documents USING btree (client_id, created_at DESC);

CREATE INDEX handoff_tasks_completed_by_idx ON public.handoff_tasks USING btree (completed_by);

CREATE INDEX oauth_connection_states_expiry_idx ON public.oauth_connection_states USING btree (expires_at);

CREATE INDEX handoff_tasks_handoff_position_idx ON public.handoff_tasks USING btree (handoff_id, "position");

CREATE INDEX notification_outbox_pending_idx ON public.notification_outbox USING btree (status, created_at);

CREATE INDEX billing_paypal_orders_invoice_idx ON public.billing_paypal_orders USING btree (invoice_id, created_at DESC);

CREATE INDEX client_action_requests_project_idx ON public.client_action_requests USING btree (project_id, status);

CREATE INDEX notification_consent_events_user_id_idx ON public.notification_consent_events USING btree (user_id);

CREATE INDEX crm_activity_created_idx ON public.crm_activity USING btree (created_at DESC);

CREATE INDEX project_inquiries_ip_hash_created_at_idx ON public.project_inquiries USING btree (ip_hash, created_at DESC) WHERE (ip_hash IS NOT NULL);

CREATE INDEX signature_requests_signer_user_id_idx ON public.signature_requests USING btree (signer_user_id);

CREATE INDEX project_inquiries_created_at_idx ON public.project_inquiries USING btree (created_at DESC);

CREATE INDEX executed_artifacts_project_idx ON public.executed_document_artifacts USING btree (project_id);

CREATE INDEX billing_paypal_orders_client_id_idx ON public.billing_paypal_orders USING btree (client_id);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id) WHERE (enabled = true);

CREATE INDEX signature_events_actor_user_id_idx ON public.signature_events USING btree (actor_user_id);

CREATE INDEX client_action_requests_client_idx ON public.client_action_requests USING btree (client_id, status, created_at DESC);

CREATE INDEX clients_created_by_idx ON public.clients USING btree (created_by);

CREATE INDEX client_communications_created_by_idx ON public.client_communications USING btree (created_by);

CREATE INDEX project_inquiries_status_idx ON public.project_inquiries USING btree (status, created_at DESC);

CREATE INDEX clients_status_idx ON public.clients USING btree (status, created_at DESC);

CREATE INDEX client_documents_created_by_idx ON public.client_documents USING btree (created_by);

CREATE INDEX inquiry_memberships_user_id_idx ON public.inquiry_memberships USING btree (user_id);

CREATE INDEX clients_email_idx ON public.clients USING btree (lower(primary_email));

CREATE INDEX signature_events_request_id_idx ON public.signature_events USING btree (signature_request_id);

CREATE INDEX client_handoffs_project_id_idx ON public.client_handoffs USING btree (project_id);

CREATE INDEX lead_notes_author_user_id_idx ON public.lead_notes USING btree (author_user_id);

CREATE INDEX signature_requests_project_id_idx ON public.signature_requests USING btree (project_id);

CREATE INDEX billing_invoices_client_idx ON public.billing_invoices USING btree (client_id, created_at DESC);

CREATE INDEX executed_artifacts_drive_sync_idx ON public.executed_document_artifacts USING btree (drive_sync_status, generated_at) WHERE (drive_sync_status <> 'synced'::text);

CREATE INDEX client_communications_project_id_idx ON public.client_communications USING btree (project_id);

CREATE INDEX project_deliverables_project_idx ON public.project_deliverables USING btree (project_id, created_at DESC);

CREATE INDEX project_deliverables_client_idx ON public.project_deliverables USING btree (client_id, created_at DESC);

CREATE INDEX client_documents_executed_artifact_id_idx ON public.client_documents USING btree (executed_artifact_id);

CREATE INDEX projects_client_idx ON public.projects USING btree (client_id, status, created_at DESC);

CREATE INDEX project_deliverables_replaces_idx ON public.project_deliverables USING btree (replaces_deliverable_id);

CREATE INDEX notification_outbox_recipient_user_id_idx ON public.notification_outbox USING btree (recipient_user_id);

CREATE INDEX billing_payments_client_id_idx ON public.billing_payments USING btree (client_id);

CREATE INDEX crm_activity_entity_idx ON public.crm_activity USING btree (entity_type, entity_id, created_at DESC);

CREATE INDEX executed_artifacts_document_version_idx ON public.executed_document_artifacts USING btree (document_version_id);

CREATE INDEX oauth_connection_states_user_idx ON public.oauth_connection_states USING btree (user_id);

CREATE INDEX project_inquiries_email_idx ON public.project_inquiries USING btree (lower(email));

CREATE INDEX signature_requests_requested_by_idx ON public.signature_requests USING btree (requested_by);

CREATE INDEX client_communications_client_created_idx ON public.client_communications USING btree (client_id, created_at DESC);

CREATE INDEX billing_invoice_items_invoice_idx ON public.billing_invoice_items USING btree (invoice_id, sort_order);

CREATE INDEX billing_payments_invoice_idx ON public.billing_payments USING btree (invoice_id, created_at DESC);

CREATE INDEX client_memberships_user_id_idx ON public.client_memberships USING btree (user_id);

CREATE INDEX document_versions_created_by_idx ON public.document_versions USING btree (created_by);

CREATE INDEX billing_invoices_project_idx ON public.billing_invoices USING btree (project_id, created_at DESC);

CREATE INDEX signature_requests_document_id_idx ON public.signature_requests USING btree (document_id);

CREATE INDEX app_integrations_connected_by_idx ON public.app_integrations USING btree (connected_by);

CREATE INDEX crm_activity_actor_user_id_idx ON public.crm_activity USING btree (actor_user_id);

CREATE INDEX executed_artifacts_client_idx ON public.executed_document_artifacts USING btree (client_id, generated_at DESC);

CREATE INDEX lead_notes_inquiry_idx ON public.lead_notes USING btree (inquiry_id, created_at DESC);

CREATE INDEX executed_artifacts_generated_by_idx ON public.executed_document_artifacts USING btree (generated_by);

CREATE INDEX client_documents_project_id_idx ON public.client_documents USING btree (project_id);

alter table "public"."profiles" enable row level security;

alter table "public"."app_memberships" enable row level security;

alter table "public"."client_communications" enable row level security;

alter table "public"."inquiry_memberships" enable row level security;

alter table "public"."clients" enable row level security;

alter table "public"."crm_activity" enable row level security;

alter table "public"."lead_notes" enable row level security;

alter table "public"."client_memberships" enable row level security;

alter table "public"."projects" enable row level security;

alter table "public"."project_inquiries" enable row level security;

alter table "public"."project_milestones" enable row level security;

alter table "public"."document_versions" enable row level security;

alter table "public"."signature_requests" enable row level security;

alter table "public"."client_documents" enable row level security;

alter table "public"."signature_events" enable row level security;

alter table "public"."notification_preferences" enable row level security;

alter table "public"."app_integrations" enable row level security;

alter table "public"."oauth_connection_states" enable row level security;

alter table "public"."executed_document_artifacts" enable row level security;

alter table "public"."push_subscriptions" enable row level security;

alter table "public"."notification_consent_events" enable row level security;

alter table "public"."notification_outbox" enable row level security;

alter table "public"."client_action_requests" enable row level security;

alter table "public"."billing_invoice_items" enable row level security;

alter table "public"."project_deliverables" enable row level security;

alter table "public"."billing_payment_methods" enable row level security;

alter table "public"."billing_payments" enable row level security;

alter table "public"."billing_invoices" enable row level security;

alter table "public"."billing_paypal_orders" enable row level security;

alter table "public"."billing_paypal_config" enable row level security;

alter table "public"."client_handoffs" enable row level security;

alter table "public"."handoff_tasks" enable row level security;

create policy "staff_read_project_inquiries" on "public"."project_inquiries" as PERMISSIVE for SELECT to "authenticated" using (private.is_src_staff());

create policy "staff_all_activity" on "public"."crm_activity" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_notes" on "public"."lead_notes" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_clients" on "public"."clients" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_client_memberships" on "public"."client_memberships" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_projects" on "public"."projects" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_documents" on "public"."client_documents" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_communications" on "public"."client_communications" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_update_project_inquiries" on "public"."project_inquiries" as PERMISSIVE for UPDATE to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_inquiry_memberships" on "public"."inquiry_memberships" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_milestones" on "public"."project_milestones" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_document_versions" on "public"."document_versions" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_signature_requests" on "public"."signature_requests" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_signature_events" on "public"."signature_events" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_read_executed_artifacts" on "public"."executed_document_artifacts" as PERMISSIVE for SELECT to "authenticated" using (private.is_src_staff());

create policy "client_read_own_milestones" on "public"."project_milestones" as PERMISSIVE for SELECT to "authenticated" using ((client_visible AND (EXISTS ( SELECT 1
   FROM (projects p
     JOIN client_memberships cm ON ((cm.client_id = p.client_id)))
  WHERE ((p.id = project_milestones.project_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "client_read_visible_document_versions" on "public"."document_versions" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (client_documents d
     JOIN client_memberships cm ON ((cm.client_id = d.client_id)))
  WHERE ((d.id = document_versions.document_id) AND d.client_visible AND (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "staff_read_app_integrations" on "public"."app_integrations" as PERMISSIVE for SELECT to "authenticated" using (private.is_src_staff());

create policy "staff_all_client_action_requests" on "public"."client_action_requests" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "client_read_own_executed_artifacts" on "public"."executed_document_artifacts" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = executed_document_artifacts.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "staff_all_project_deliverables" on "public"."project_deliverables" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_manage_project_deliverable_files" on "storage"."objects" as PERMISSIVE for ALL to "authenticated" using (((bucket_id = 'project-deliverables'::text) AND private.is_src_staff())) with check (((bucket_id = 'project-deliverables'::text) AND private.is_src_staff()));

create policy "clients_read_own_project_deliverables" on "public"."project_deliverables" as PERMISSIVE for SELECT to "authenticated" using ((client_visible AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = project_deliverables.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "clients_upload_own_project_files" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'project-deliverables'::text) AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.user_id = auth.uid()) AND ((storage.foldername(objects.name))[1] = (cm.client_id)::text))))));

create policy "staff_all_billing_invoices" on "public"."billing_invoices" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_billing_invoice_items" on "public"."billing_invoice_items" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_all_billing_payments" on "public"."billing_payments" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "staff_manage_billing_payment_methods" on "public"."billing_payment_methods" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "clients_read_own_billing_invoice_items" on "public"."billing_invoice_items" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (billing_invoices i
     JOIN client_memberships cm ON ((cm.client_id = i.client_id)))
  WHERE ((i.id = billing_invoice_items.invoice_id) AND i.client_visible AND (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "staff_read_paypal_orders" on "public"."billing_paypal_orders" as PERMISSIVE for SELECT to "authenticated" using (private.is_src_staff());

create policy "staff_read_paypal_config" on "public"."billing_paypal_config" as PERMISSIVE for SELECT to "authenticated" using (private.is_src_staff());

create policy "staff_read_billing_invoice_files" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'billing-invoices'::text) AND private.is_src_staff()));

create policy "staff_read_billing_receipts" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'billing-receipts'::text) AND private.is_src_staff()));

create policy "staff can read notification outbox" on "public"."notification_outbox" as PERMISSIVE for SELECT to "authenticated" using (private.is_src_staff());

create policy "profiles_update_self" on "public"."profiles" as PERMISSIVE for UPDATE to "authenticated" using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));

create policy "staff_all_handoff_tasks" on "public"."handoff_tasks" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "profiles_read_self_or_staff" on "public"."profiles" as PERMISSIVE for SELECT to "authenticated" using (((id = ( SELECT auth.uid() AS uid)) OR private.is_src_staff()));

create policy "memberships_read_self_or_staff" on "public"."app_memberships" as PERMISSIVE for SELECT to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) OR private.is_src_staff()));

create policy "client_read_own_client" on "public"."clients" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = clients.id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "client_read_own_projects" on "public"."projects" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = projects.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "client_read_visible_documents" on "public"."client_documents" as PERMISSIVE for SELECT to "authenticated" using ((client_visible AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = client_documents.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "client_read_own_communications" on "public"."client_communications" as PERMISSIVE for SELECT to "authenticated" using (((direction <> 'internal'::text) AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = client_communications.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "applicant_read_own_inquiry_membership" on "public"."inquiry_memberships" as PERMISSIVE for SELECT to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "applicant_read_own_inquiry" on "public"."project_inquiries" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM inquiry_memberships im
  WHERE ((im.inquiry_id = project_inquiries.id) AND (im.user_id = ( SELECT auth.uid() AS uid))))));

create policy "signer_read_signature_requests" on "public"."signature_requests" as PERMISSIVE for SELECT to "authenticated" using ((signer_user_id = ( SELECT auth.uid() AS uid)));

create policy "signer_read_signature_events" on "public"."signature_events" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM signature_requests sr
  WHERE ((sr.id = signature_events.signature_request_id) AND (sr.signer_user_id = ( SELECT auth.uid() AS uid))))));

create policy "users manage own push subscriptions" on "public"."push_subscriptions" as PERMISSIVE for ALL to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy "users manage own notification preferences" on "public"."notification_preferences" as PERMISSIVE for ALL to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy "users read own notification consent" on "public"."notification_consent_events" as PERMISSIVE for SELECT to "authenticated" using ((user_id = ( SELECT auth.uid() AS uid)));

create policy "users record own notification consent" on "public"."notification_consent_events" as PERMISSIVE for INSERT to "authenticated" with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy "clients_read_own_action_requests" on "public"."client_action_requests" as PERMISSIVE for SELECT to "authenticated" using ((client_visible AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = client_action_requests.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "clients_create_own_portal_messages" on "public"."client_communications" as PERMISSIVE for INSERT to "authenticated" with check (((channel = 'portal'::text) AND (direction = 'inbound'::text) AND (client_visible = true) AND (created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = client_communications.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "clients_create_own_project_deliverables" on "public"."project_deliverables" as PERMISSIVE for INSERT to "authenticated" with check (((source = 'client'::text) AND (created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = project_deliverables.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_deliverables.project_id) AND (p.client_id = project_deliverables.client_id))))));

create policy "clients_read_own_billing_invoices" on "public"."billing_invoices" as PERMISSIVE for SELECT to "authenticated" using ((client_visible AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = billing_invoices.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)))))));

create policy "clients_read_own_billing_payments" on "public"."billing_payments" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = billing_payments.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "clients_read_active_billing_payment_methods" on "public"."billing_payment_methods" as PERMISSIVE for SELECT to "authenticated" using ((active AND (EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "clients_read_own_paypal_orders" on "public"."billing_paypal_orders" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM client_memberships cm
  WHERE ((cm.client_id = billing_paypal_orders.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid))))));

create policy "client_read_own_memberships" on "public"."client_memberships" as PERMISSIVE for SELECT to "authenticated" using (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_memberships am
  WHERE ((am.user_id = ( SELECT auth.uid() AS uid)) AND (am.role = 'client'::app_role) AND (am.status = 'active'::membership_status))))));

create policy "staff_all_client_handoffs" on "public"."client_handoffs" as PERMISSIVE for ALL to "authenticated" using (private.is_src_staff()) with check (private.is_src_staff());

create policy "client_read_own_handoff" on "public"."client_handoffs" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (client_memberships cm
     JOIN app_memberships am ON ((am.user_id = cm.user_id)))
  WHERE ((cm.client_id = client_handoffs.client_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (am.role = 'client'::app_role) AND (am.status = 'active'::membership_status)))));

create policy "client_read_own_handoff_tasks" on "public"."handoff_tasks" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM ((client_handoffs h
     JOIN client_memberships cm ON ((cm.client_id = h.client_id)))
     JOIN app_memberships am ON ((am.user_id = cm.user_id)))
  WHERE ((h.id = handoff_tasks.handoff_id) AND (cm.user_id = ( SELECT auth.uid() AS uid)) AND (am.role = 'client'::app_role) AND (am.status = 'active'::membership_status)))));

CREATE TRIGGER set_project_inquiries_updated_at BEFORE UPDATE ON public.project_inquiries FOR EACH ROW EXECUTE FUNCTION set_project_inquiries_updated_at();

CREATE TRIGGER on_auth_user_created_src_app AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_app_user();

CREATE TRIGGER trg_lead_status_activity AFTER UPDATE OF status ON public.project_inquiries FOR EACH ROW EXECUTE FUNCTION log_lead_status_change();

CREATE TRIGGER trg_lead_note_activity AFTER INSERT ON public.lead_notes FOR EACH ROW EXECUTE FUNCTION log_lead_note();

CREATE TRIGGER trg_notify_signature_request AFTER INSERT ON public.signature_requests FOR EACH ROW EXECUTE FUNCTION private.notify_signature_request();

CREATE TRIGGER trg_notify_signature_completed AFTER UPDATE OF status ON public.signature_requests FOR EACH ROW EXECUTE FUNCTION private.notify_signature_completed();

CREATE TRIGGER trg_notify_document_final AFTER UPDATE OF state ON public.client_documents FOR EACH ROW EXECUTE FUNCTION private.notify_document_final();

CREATE TRIGGER trg_notify_project_change AFTER UPDATE OF phase, status, progress ON public.projects FOR EACH ROW EXECUTE FUNCTION private.notify_project_change();

CREATE TRIGGER trg_notify_milestone_change AFTER UPDATE OF status ON public.project_milestones FOR EACH ROW EXECUTE FUNCTION private.notify_milestone_change();

CREATE TRIGGER trg_notify_communication AFTER INSERT ON public.client_communications FOR EACH ROW EXECUTE FUNCTION private.notify_communication();

CREATE TRIGGER billing_invoices_updated_at BEFORE UPDATE ON public.billing_invoices FOR EACH ROW EXECUTE FUNCTION set_billing_invoice_updated_at();

CREATE TRIGGER protect_finalized_billing_invoice BEFORE UPDATE ON public.billing_invoices FOR EACH ROW EXECUTE FUNCTION private.protect_finalized_billing_invoice();

CREATE TRIGGER protect_billing_payment_artifact BEFORE UPDATE ON public.billing_payments FOR EACH ROW EXECUTE FUNCTION private.protect_billing_payment_artifact();

CREATE TRIGGER prevent_archived_invoice_delete BEFORE DELETE ON public.billing_invoices FOR EACH ROW EXECUTE FUNCTION private.prevent_archived_financial_delete();

CREATE TRIGGER prevent_archived_payment_delete BEFORE DELETE ON public.billing_payments FOR EACH ROW EXECUTE FUNCTION private.prevent_archived_financial_delete();

CREATE TRIGGER trg_notify_client_action_request AFTER INSERT OR UPDATE OF status ON public.client_action_requests FOR EACH ROW EXECUTE FUNCTION private.notify_client_action_request();

CREATE TRIGGER trg_notify_successful_payment AFTER INSERT ON public.billing_payments FOR EACH ROW EXECUTE FUNCTION private.notify_successful_payment();

CREATE TRIGGER seed_handoff_tasks_after_insert AFTER INSERT ON public.client_handoffs FOR EACH ROW EXECUTE FUNCTION seed_handoff_tasks();

CREATE TRIGGER sync_handoff_agreement_task_after_document AFTER INSERT OR UPDATE OF state ON public.client_documents FOR EACH ROW EXECUTE FUNCTION sync_handoff_agreement_task();

revoke all on "public"."profiles" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."app_memberships" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."client_communications" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."inquiry_memberships" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."clients" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."crm_activity" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."lead_notes" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."client_memberships" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."projects" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."project_inquiries" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."project_milestones" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."document_versions" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."signature_requests" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."client_documents" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."signature_events" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."notification_preferences" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."app_integrations" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."oauth_connection_states" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."executed_document_artifacts" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."push_subscriptions" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."notification_consent_events" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."notification_outbox" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."client_action_requests" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."billing_invoice_items" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."project_deliverables" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."billing_payment_methods" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."billing_payments" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."billing_invoices" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."billing_paypal_orders" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."billing_paypal_config" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."client_handoffs" from PUBLIC,anon,authenticated,service_role;

revoke all on "public"."handoff_tasks" from PUBLIC,anon,authenticated,service_role;

grant INSERT on "public"."profiles" to "anon";

grant SELECT on "public"."profiles" to "anon";

grant UPDATE on "public"."profiles" to "anon";

grant DELETE on "public"."profiles" to "anon";

grant TRUNCATE on "public"."profiles" to "anon";

grant REFERENCES on "public"."profiles" to "anon";

grant TRIGGER on "public"."profiles" to "anon";

grant INSERT on "public"."profiles" to "authenticated";

grant SELECT on "public"."profiles" to "authenticated";

grant UPDATE on "public"."profiles" to "authenticated";

grant DELETE on "public"."profiles" to "authenticated";

grant TRUNCATE on "public"."profiles" to "authenticated";

grant REFERENCES on "public"."profiles" to "authenticated";

grant TRIGGER on "public"."profiles" to "authenticated";

grant INSERT on "public"."profiles" to "service_role";

grant SELECT on "public"."profiles" to "service_role";

grant UPDATE on "public"."profiles" to "service_role";

grant DELETE on "public"."profiles" to "service_role";

grant TRUNCATE on "public"."profiles" to "service_role";

grant REFERENCES on "public"."profiles" to "service_role";

grant TRIGGER on "public"."profiles" to "service_role";

grant INSERT on "public"."app_memberships" to "anon";

grant SELECT on "public"."app_memberships" to "anon";

grant UPDATE on "public"."app_memberships" to "anon";

grant DELETE on "public"."app_memberships" to "anon";

grant TRUNCATE on "public"."app_memberships" to "anon";

grant REFERENCES on "public"."app_memberships" to "anon";

grant TRIGGER on "public"."app_memberships" to "anon";

grant INSERT on "public"."app_memberships" to "authenticated";

grant SELECT on "public"."app_memberships" to "authenticated";

grant UPDATE on "public"."app_memberships" to "authenticated";

grant DELETE on "public"."app_memberships" to "authenticated";

grant TRUNCATE on "public"."app_memberships" to "authenticated";

grant REFERENCES on "public"."app_memberships" to "authenticated";

grant TRIGGER on "public"."app_memberships" to "authenticated";

grant INSERT on "public"."app_memberships" to "service_role";

grant SELECT on "public"."app_memberships" to "service_role";

grant UPDATE on "public"."app_memberships" to "service_role";

grant DELETE on "public"."app_memberships" to "service_role";

grant TRUNCATE on "public"."app_memberships" to "service_role";

grant REFERENCES on "public"."app_memberships" to "service_role";

grant TRIGGER on "public"."app_memberships" to "service_role";

grant INSERT on "public"."client_communications" to "anon";

grant SELECT on "public"."client_communications" to "anon";

grant UPDATE on "public"."client_communications" to "anon";

grant DELETE on "public"."client_communications" to "anon";

grant TRUNCATE on "public"."client_communications" to "anon";

grant REFERENCES on "public"."client_communications" to "anon";

grant TRIGGER on "public"."client_communications" to "anon";

grant INSERT on "public"."client_communications" to "authenticated";

grant SELECT on "public"."client_communications" to "authenticated";

grant UPDATE on "public"."client_communications" to "authenticated";

grant DELETE on "public"."client_communications" to "authenticated";

grant TRUNCATE on "public"."client_communications" to "authenticated";

grant REFERENCES on "public"."client_communications" to "authenticated";

grant TRIGGER on "public"."client_communications" to "authenticated";

grant INSERT on "public"."client_communications" to "service_role";

grant SELECT on "public"."client_communications" to "service_role";

grant UPDATE on "public"."client_communications" to "service_role";

grant DELETE on "public"."client_communications" to "service_role";

grant TRUNCATE on "public"."client_communications" to "service_role";

grant REFERENCES on "public"."client_communications" to "service_role";

grant TRIGGER on "public"."client_communications" to "service_role";

grant INSERT on "public"."inquiry_memberships" to "anon";

grant SELECT on "public"."inquiry_memberships" to "anon";

grant UPDATE on "public"."inquiry_memberships" to "anon";

grant DELETE on "public"."inquiry_memberships" to "anon";

grant TRUNCATE on "public"."inquiry_memberships" to "anon";

grant REFERENCES on "public"."inquiry_memberships" to "anon";

grant TRIGGER on "public"."inquiry_memberships" to "anon";

grant INSERT on "public"."inquiry_memberships" to "authenticated";

grant SELECT on "public"."inquiry_memberships" to "authenticated";

grant UPDATE on "public"."inquiry_memberships" to "authenticated";

grant DELETE on "public"."inquiry_memberships" to "authenticated";

grant TRUNCATE on "public"."inquiry_memberships" to "authenticated";

grant REFERENCES on "public"."inquiry_memberships" to "authenticated";

grant TRIGGER on "public"."inquiry_memberships" to "authenticated";

grant INSERT on "public"."inquiry_memberships" to "service_role";

grant SELECT on "public"."inquiry_memberships" to "service_role";

grant UPDATE on "public"."inquiry_memberships" to "service_role";

grant DELETE on "public"."inquiry_memberships" to "service_role";

grant TRUNCATE on "public"."inquiry_memberships" to "service_role";

grant REFERENCES on "public"."inquiry_memberships" to "service_role";

grant TRIGGER on "public"."inquiry_memberships" to "service_role";

grant INSERT on "public"."clients" to "anon";

grant SELECT on "public"."clients" to "anon";

grant UPDATE on "public"."clients" to "anon";

grant DELETE on "public"."clients" to "anon";

grant TRUNCATE on "public"."clients" to "anon";

grant REFERENCES on "public"."clients" to "anon";

grant TRIGGER on "public"."clients" to "anon";

grant INSERT on "public"."clients" to "authenticated";

grant SELECT on "public"."clients" to "authenticated";

grant UPDATE on "public"."clients" to "authenticated";

grant DELETE on "public"."clients" to "authenticated";

grant TRUNCATE on "public"."clients" to "authenticated";

grant REFERENCES on "public"."clients" to "authenticated";

grant TRIGGER on "public"."clients" to "authenticated";

grant INSERT on "public"."clients" to "service_role";

grant SELECT on "public"."clients" to "service_role";

grant UPDATE on "public"."clients" to "service_role";

grant DELETE on "public"."clients" to "service_role";

grant TRUNCATE on "public"."clients" to "service_role";

grant REFERENCES on "public"."clients" to "service_role";

grant TRIGGER on "public"."clients" to "service_role";

grant INSERT on "public"."crm_activity" to "anon";

grant SELECT on "public"."crm_activity" to "anon";

grant UPDATE on "public"."crm_activity" to "anon";

grant DELETE on "public"."crm_activity" to "anon";

grant TRUNCATE on "public"."crm_activity" to "anon";

grant REFERENCES on "public"."crm_activity" to "anon";

grant TRIGGER on "public"."crm_activity" to "anon";

grant INSERT on "public"."crm_activity" to "authenticated";

grant SELECT on "public"."crm_activity" to "authenticated";

grant UPDATE on "public"."crm_activity" to "authenticated";

grant DELETE on "public"."crm_activity" to "authenticated";

grant TRUNCATE on "public"."crm_activity" to "authenticated";

grant REFERENCES on "public"."crm_activity" to "authenticated";

grant TRIGGER on "public"."crm_activity" to "authenticated";

grant INSERT on "public"."crm_activity" to "service_role";

grant SELECT on "public"."crm_activity" to "service_role";

grant UPDATE on "public"."crm_activity" to "service_role";

grant DELETE on "public"."crm_activity" to "service_role";

grant TRUNCATE on "public"."crm_activity" to "service_role";

grant REFERENCES on "public"."crm_activity" to "service_role";

grant TRIGGER on "public"."crm_activity" to "service_role";

grant INSERT on "public"."lead_notes" to "anon";

grant SELECT on "public"."lead_notes" to "anon";

grant UPDATE on "public"."lead_notes" to "anon";

grant DELETE on "public"."lead_notes" to "anon";

grant TRUNCATE on "public"."lead_notes" to "anon";

grant REFERENCES on "public"."lead_notes" to "anon";

grant TRIGGER on "public"."lead_notes" to "anon";

grant INSERT on "public"."lead_notes" to "authenticated";

grant SELECT on "public"."lead_notes" to "authenticated";

grant UPDATE on "public"."lead_notes" to "authenticated";

grant DELETE on "public"."lead_notes" to "authenticated";

grant TRUNCATE on "public"."lead_notes" to "authenticated";

grant REFERENCES on "public"."lead_notes" to "authenticated";

grant TRIGGER on "public"."lead_notes" to "authenticated";

grant INSERT on "public"."lead_notes" to "service_role";

grant SELECT on "public"."lead_notes" to "service_role";

grant UPDATE on "public"."lead_notes" to "service_role";

grant DELETE on "public"."lead_notes" to "service_role";

grant TRUNCATE on "public"."lead_notes" to "service_role";

grant REFERENCES on "public"."lead_notes" to "service_role";

grant TRIGGER on "public"."lead_notes" to "service_role";

grant INSERT on "public"."client_memberships" to "anon";

grant SELECT on "public"."client_memberships" to "anon";

grant UPDATE on "public"."client_memberships" to "anon";

grant DELETE on "public"."client_memberships" to "anon";

grant TRUNCATE on "public"."client_memberships" to "anon";

grant REFERENCES on "public"."client_memberships" to "anon";

grant TRIGGER on "public"."client_memberships" to "anon";

grant INSERT on "public"."client_memberships" to "authenticated";

grant SELECT on "public"."client_memberships" to "authenticated";

grant UPDATE on "public"."client_memberships" to "authenticated";

grant DELETE on "public"."client_memberships" to "authenticated";

grant TRUNCATE on "public"."client_memberships" to "authenticated";

grant REFERENCES on "public"."client_memberships" to "authenticated";

grant TRIGGER on "public"."client_memberships" to "authenticated";

grant INSERT on "public"."client_memberships" to "service_role";

grant SELECT on "public"."client_memberships" to "service_role";

grant UPDATE on "public"."client_memberships" to "service_role";

grant DELETE on "public"."client_memberships" to "service_role";

grant TRUNCATE on "public"."client_memberships" to "service_role";

grant REFERENCES on "public"."client_memberships" to "service_role";

grant TRIGGER on "public"."client_memberships" to "service_role";

grant INSERT on "public"."projects" to "anon";

grant SELECT on "public"."projects" to "anon";

grant UPDATE on "public"."projects" to "anon";

grant DELETE on "public"."projects" to "anon";

grant TRUNCATE on "public"."projects" to "anon";

grant REFERENCES on "public"."projects" to "anon";

grant TRIGGER on "public"."projects" to "anon";

grant INSERT on "public"."projects" to "authenticated";

grant SELECT on "public"."projects" to "authenticated";

grant UPDATE on "public"."projects" to "authenticated";

grant DELETE on "public"."projects" to "authenticated";

grant TRUNCATE on "public"."projects" to "authenticated";

grant REFERENCES on "public"."projects" to "authenticated";

grant TRIGGER on "public"."projects" to "authenticated";

grant INSERT on "public"."projects" to "service_role";

grant SELECT on "public"."projects" to "service_role";

grant UPDATE on "public"."projects" to "service_role";

grant DELETE on "public"."projects" to "service_role";

grant TRUNCATE on "public"."projects" to "service_role";

grant REFERENCES on "public"."projects" to "service_role";

grant TRIGGER on "public"."projects" to "service_role";

grant INSERT on "public"."project_inquiries" to "service_role";

grant SELECT on "public"."project_inquiries" to "service_role";

grant UPDATE on "public"."project_inquiries" to "service_role";

grant DELETE on "public"."project_inquiries" to "service_role";

grant TRUNCATE on "public"."project_inquiries" to "service_role";

grant REFERENCES on "public"."project_inquiries" to "service_role";

grant TRIGGER on "public"."project_inquiries" to "service_role";

grant SELECT on "public"."project_inquiries" to "authenticated";

grant UPDATE on "public"."project_inquiries" to "authenticated";

grant INSERT on "public"."project_milestones" to "anon";

grant SELECT on "public"."project_milestones" to "anon";

grant UPDATE on "public"."project_milestones" to "anon";

grant DELETE on "public"."project_milestones" to "anon";

grant TRUNCATE on "public"."project_milestones" to "anon";

grant REFERENCES on "public"."project_milestones" to "anon";

grant TRIGGER on "public"."project_milestones" to "anon";

grant INSERT on "public"."project_milestones" to "authenticated";

grant SELECT on "public"."project_milestones" to "authenticated";

grant UPDATE on "public"."project_milestones" to "authenticated";

grant DELETE on "public"."project_milestones" to "authenticated";

grant TRUNCATE on "public"."project_milestones" to "authenticated";

grant REFERENCES on "public"."project_milestones" to "authenticated";

grant TRIGGER on "public"."project_milestones" to "authenticated";

grant INSERT on "public"."project_milestones" to "service_role";

grant SELECT on "public"."project_milestones" to "service_role";

grant UPDATE on "public"."project_milestones" to "service_role";

grant DELETE on "public"."project_milestones" to "service_role";

grant TRUNCATE on "public"."project_milestones" to "service_role";

grant REFERENCES on "public"."project_milestones" to "service_role";

grant TRIGGER on "public"."project_milestones" to "service_role";

grant INSERT on "public"."document_versions" to "anon";

grant SELECT on "public"."document_versions" to "anon";

grant UPDATE on "public"."document_versions" to "anon";

grant DELETE on "public"."document_versions" to "anon";

grant TRUNCATE on "public"."document_versions" to "anon";

grant REFERENCES on "public"."document_versions" to "anon";

grant TRIGGER on "public"."document_versions" to "anon";

grant INSERT on "public"."document_versions" to "authenticated";

grant SELECT on "public"."document_versions" to "authenticated";

grant UPDATE on "public"."document_versions" to "authenticated";

grant DELETE on "public"."document_versions" to "authenticated";

grant TRUNCATE on "public"."document_versions" to "authenticated";

grant REFERENCES on "public"."document_versions" to "authenticated";

grant TRIGGER on "public"."document_versions" to "authenticated";

grant INSERT on "public"."document_versions" to "service_role";

grant SELECT on "public"."document_versions" to "service_role";

grant UPDATE on "public"."document_versions" to "service_role";

grant DELETE on "public"."document_versions" to "service_role";

grant TRUNCATE on "public"."document_versions" to "service_role";

grant REFERENCES on "public"."document_versions" to "service_role";

grant TRIGGER on "public"."document_versions" to "service_role";

grant INSERT on "public"."signature_requests" to "anon";

grant SELECT on "public"."signature_requests" to "anon";

grant UPDATE on "public"."signature_requests" to "anon";

grant DELETE on "public"."signature_requests" to "anon";

grant TRUNCATE on "public"."signature_requests" to "anon";

grant REFERENCES on "public"."signature_requests" to "anon";

grant TRIGGER on "public"."signature_requests" to "anon";

grant INSERT on "public"."signature_requests" to "authenticated";

grant SELECT on "public"."signature_requests" to "authenticated";

grant UPDATE on "public"."signature_requests" to "authenticated";

grant DELETE on "public"."signature_requests" to "authenticated";

grant TRUNCATE on "public"."signature_requests" to "authenticated";

grant REFERENCES on "public"."signature_requests" to "authenticated";

grant TRIGGER on "public"."signature_requests" to "authenticated";

grant INSERT on "public"."signature_requests" to "service_role";

grant SELECT on "public"."signature_requests" to "service_role";

grant UPDATE on "public"."signature_requests" to "service_role";

grant DELETE on "public"."signature_requests" to "service_role";

grant TRUNCATE on "public"."signature_requests" to "service_role";

grant REFERENCES on "public"."signature_requests" to "service_role";

grant TRIGGER on "public"."signature_requests" to "service_role";

grant INSERT on "public"."client_documents" to "anon";

grant SELECT on "public"."client_documents" to "anon";

grant UPDATE on "public"."client_documents" to "anon";

grant DELETE on "public"."client_documents" to "anon";

grant TRUNCATE on "public"."client_documents" to "anon";

grant REFERENCES on "public"."client_documents" to "anon";

grant TRIGGER on "public"."client_documents" to "anon";

grant INSERT on "public"."client_documents" to "authenticated";

grant SELECT on "public"."client_documents" to "authenticated";

grant UPDATE on "public"."client_documents" to "authenticated";

grant DELETE on "public"."client_documents" to "authenticated";

grant TRUNCATE on "public"."client_documents" to "authenticated";

grant REFERENCES on "public"."client_documents" to "authenticated";

grant TRIGGER on "public"."client_documents" to "authenticated";

grant INSERT on "public"."client_documents" to "service_role";

grant SELECT on "public"."client_documents" to "service_role";

grant UPDATE on "public"."client_documents" to "service_role";

grant DELETE on "public"."client_documents" to "service_role";

grant TRUNCATE on "public"."client_documents" to "service_role";

grant REFERENCES on "public"."client_documents" to "service_role";

grant TRIGGER on "public"."client_documents" to "service_role";

grant INSERT on "public"."signature_events" to "anon";

grant SELECT on "public"."signature_events" to "anon";

grant UPDATE on "public"."signature_events" to "anon";

grant DELETE on "public"."signature_events" to "anon";

grant TRUNCATE on "public"."signature_events" to "anon";

grant REFERENCES on "public"."signature_events" to "anon";

grant TRIGGER on "public"."signature_events" to "anon";

grant INSERT on "public"."signature_events" to "authenticated";

grant SELECT on "public"."signature_events" to "authenticated";

grant UPDATE on "public"."signature_events" to "authenticated";

grant DELETE on "public"."signature_events" to "authenticated";

grant TRUNCATE on "public"."signature_events" to "authenticated";

grant REFERENCES on "public"."signature_events" to "authenticated";

grant TRIGGER on "public"."signature_events" to "authenticated";

grant INSERT on "public"."signature_events" to "service_role";

grant SELECT on "public"."signature_events" to "service_role";

grant UPDATE on "public"."signature_events" to "service_role";

grant DELETE on "public"."signature_events" to "service_role";

grant TRUNCATE on "public"."signature_events" to "service_role";

grant REFERENCES on "public"."signature_events" to "service_role";

grant TRIGGER on "public"."signature_events" to "service_role";

grant INSERT on "public"."notification_preferences" to "anon";

grant SELECT on "public"."notification_preferences" to "anon";

grant UPDATE on "public"."notification_preferences" to "anon";

grant DELETE on "public"."notification_preferences" to "anon";

grant TRUNCATE on "public"."notification_preferences" to "anon";

grant REFERENCES on "public"."notification_preferences" to "anon";

grant TRIGGER on "public"."notification_preferences" to "anon";

grant INSERT on "public"."notification_preferences" to "authenticated";

grant SELECT on "public"."notification_preferences" to "authenticated";

grant UPDATE on "public"."notification_preferences" to "authenticated";

grant DELETE on "public"."notification_preferences" to "authenticated";

grant TRUNCATE on "public"."notification_preferences" to "authenticated";

grant REFERENCES on "public"."notification_preferences" to "authenticated";

grant TRIGGER on "public"."notification_preferences" to "authenticated";

grant INSERT on "public"."notification_preferences" to "service_role";

grant SELECT on "public"."notification_preferences" to "service_role";

grant UPDATE on "public"."notification_preferences" to "service_role";

grant DELETE on "public"."notification_preferences" to "service_role";

grant TRUNCATE on "public"."notification_preferences" to "service_role";

grant REFERENCES on "public"."notification_preferences" to "service_role";

grant TRIGGER on "public"."notification_preferences" to "service_role";

grant INSERT on "public"."app_integrations" to "anon";

grant SELECT on "public"."app_integrations" to "anon";

grant UPDATE on "public"."app_integrations" to "anon";

grant DELETE on "public"."app_integrations" to "anon";

grant TRUNCATE on "public"."app_integrations" to "anon";

grant REFERENCES on "public"."app_integrations" to "anon";

grant TRIGGER on "public"."app_integrations" to "anon";

grant INSERT on "public"."app_integrations" to "authenticated";

grant SELECT on "public"."app_integrations" to "authenticated";

grant UPDATE on "public"."app_integrations" to "authenticated";

grant DELETE on "public"."app_integrations" to "authenticated";

grant TRUNCATE on "public"."app_integrations" to "authenticated";

grant REFERENCES on "public"."app_integrations" to "authenticated";

grant TRIGGER on "public"."app_integrations" to "authenticated";

grant INSERT on "public"."app_integrations" to "service_role";

grant SELECT on "public"."app_integrations" to "service_role";

grant UPDATE on "public"."app_integrations" to "service_role";

grant DELETE on "public"."app_integrations" to "service_role";

grant TRUNCATE on "public"."app_integrations" to "service_role";

grant REFERENCES on "public"."app_integrations" to "service_role";

grant TRIGGER on "public"."app_integrations" to "service_role";

grant INSERT on "public"."oauth_connection_states" to "anon";

grant SELECT on "public"."oauth_connection_states" to "anon";

grant UPDATE on "public"."oauth_connection_states" to "anon";

grant DELETE on "public"."oauth_connection_states" to "anon";

grant TRUNCATE on "public"."oauth_connection_states" to "anon";

grant REFERENCES on "public"."oauth_connection_states" to "anon";

grant TRIGGER on "public"."oauth_connection_states" to "anon";

grant INSERT on "public"."oauth_connection_states" to "authenticated";

grant SELECT on "public"."oauth_connection_states" to "authenticated";

grant UPDATE on "public"."oauth_connection_states" to "authenticated";

grant DELETE on "public"."oauth_connection_states" to "authenticated";

grant TRUNCATE on "public"."oauth_connection_states" to "authenticated";

grant REFERENCES on "public"."oauth_connection_states" to "authenticated";

grant TRIGGER on "public"."oauth_connection_states" to "authenticated";

grant INSERT on "public"."oauth_connection_states" to "service_role";

grant SELECT on "public"."oauth_connection_states" to "service_role";

grant UPDATE on "public"."oauth_connection_states" to "service_role";

grant DELETE on "public"."oauth_connection_states" to "service_role";

grant TRUNCATE on "public"."oauth_connection_states" to "service_role";

grant REFERENCES on "public"."oauth_connection_states" to "service_role";

grant TRIGGER on "public"."oauth_connection_states" to "service_role";

grant INSERT on "public"."executed_document_artifacts" to "anon";

grant SELECT on "public"."executed_document_artifacts" to "anon";

grant UPDATE on "public"."executed_document_artifacts" to "anon";

grant DELETE on "public"."executed_document_artifacts" to "anon";

grant TRUNCATE on "public"."executed_document_artifacts" to "anon";

grant REFERENCES on "public"."executed_document_artifacts" to "anon";

grant TRIGGER on "public"."executed_document_artifacts" to "anon";

grant INSERT on "public"."executed_document_artifacts" to "authenticated";

grant SELECT on "public"."executed_document_artifacts" to "authenticated";

grant UPDATE on "public"."executed_document_artifacts" to "authenticated";

grant DELETE on "public"."executed_document_artifacts" to "authenticated";

grant TRUNCATE on "public"."executed_document_artifacts" to "authenticated";

grant REFERENCES on "public"."executed_document_artifacts" to "authenticated";

grant TRIGGER on "public"."executed_document_artifacts" to "authenticated";

grant INSERT on "public"."executed_document_artifacts" to "service_role";

grant SELECT on "public"."executed_document_artifacts" to "service_role";

grant UPDATE on "public"."executed_document_artifacts" to "service_role";

grant DELETE on "public"."executed_document_artifacts" to "service_role";

grant TRUNCATE on "public"."executed_document_artifacts" to "service_role";

grant REFERENCES on "public"."executed_document_artifacts" to "service_role";

grant TRIGGER on "public"."executed_document_artifacts" to "service_role";

grant INSERT on "public"."push_subscriptions" to "anon";

grant SELECT on "public"."push_subscriptions" to "anon";

grant UPDATE on "public"."push_subscriptions" to "anon";

grant DELETE on "public"."push_subscriptions" to "anon";

grant TRUNCATE on "public"."push_subscriptions" to "anon";

grant REFERENCES on "public"."push_subscriptions" to "anon";

grant TRIGGER on "public"."push_subscriptions" to "anon";

grant INSERT on "public"."push_subscriptions" to "authenticated";

grant SELECT on "public"."push_subscriptions" to "authenticated";

grant UPDATE on "public"."push_subscriptions" to "authenticated";

grant DELETE on "public"."push_subscriptions" to "authenticated";

grant TRUNCATE on "public"."push_subscriptions" to "authenticated";

grant REFERENCES on "public"."push_subscriptions" to "authenticated";

grant TRIGGER on "public"."push_subscriptions" to "authenticated";

grant INSERT on "public"."push_subscriptions" to "service_role";

grant SELECT on "public"."push_subscriptions" to "service_role";

grant UPDATE on "public"."push_subscriptions" to "service_role";

grant DELETE on "public"."push_subscriptions" to "service_role";

grant TRUNCATE on "public"."push_subscriptions" to "service_role";

grant REFERENCES on "public"."push_subscriptions" to "service_role";

grant TRIGGER on "public"."push_subscriptions" to "service_role";

grant INSERT on "public"."notification_consent_events" to "anon";

grant SELECT on "public"."notification_consent_events" to "anon";

grant UPDATE on "public"."notification_consent_events" to "anon";

grant DELETE on "public"."notification_consent_events" to "anon";

grant TRUNCATE on "public"."notification_consent_events" to "anon";

grant REFERENCES on "public"."notification_consent_events" to "anon";

grant TRIGGER on "public"."notification_consent_events" to "anon";

grant INSERT on "public"."notification_consent_events" to "authenticated";

grant SELECT on "public"."notification_consent_events" to "authenticated";

grant UPDATE on "public"."notification_consent_events" to "authenticated";

grant DELETE on "public"."notification_consent_events" to "authenticated";

grant TRUNCATE on "public"."notification_consent_events" to "authenticated";

grant REFERENCES on "public"."notification_consent_events" to "authenticated";

grant TRIGGER on "public"."notification_consent_events" to "authenticated";

grant INSERT on "public"."notification_consent_events" to "service_role";

grant SELECT on "public"."notification_consent_events" to "service_role";

grant UPDATE on "public"."notification_consent_events" to "service_role";

grant DELETE on "public"."notification_consent_events" to "service_role";

grant TRUNCATE on "public"."notification_consent_events" to "service_role";

grant REFERENCES on "public"."notification_consent_events" to "service_role";

grant TRIGGER on "public"."notification_consent_events" to "service_role";

grant INSERT on "public"."notification_outbox" to "service_role";

grant SELECT on "public"."notification_outbox" to "service_role";

grant UPDATE on "public"."notification_outbox" to "service_role";

grant DELETE on "public"."notification_outbox" to "service_role";

grant TRUNCATE on "public"."notification_outbox" to "service_role";

grant REFERENCES on "public"."notification_outbox" to "service_role";

grant TRIGGER on "public"."notification_outbox" to "service_role";

grant INSERT on "public"."client_action_requests" to "anon";

grant SELECT on "public"."client_action_requests" to "anon";

grant UPDATE on "public"."client_action_requests" to "anon";

grant DELETE on "public"."client_action_requests" to "anon";

grant TRUNCATE on "public"."client_action_requests" to "anon";

grant REFERENCES on "public"."client_action_requests" to "anon";

grant TRIGGER on "public"."client_action_requests" to "anon";

grant INSERT on "public"."client_action_requests" to "authenticated";

grant SELECT on "public"."client_action_requests" to "authenticated";

grant UPDATE on "public"."client_action_requests" to "authenticated";

grant DELETE on "public"."client_action_requests" to "authenticated";

grant TRUNCATE on "public"."client_action_requests" to "authenticated";

grant REFERENCES on "public"."client_action_requests" to "authenticated";

grant TRIGGER on "public"."client_action_requests" to "authenticated";

grant INSERT on "public"."client_action_requests" to "service_role";

grant SELECT on "public"."client_action_requests" to "service_role";

grant UPDATE on "public"."client_action_requests" to "service_role";

grant DELETE on "public"."client_action_requests" to "service_role";

grant TRUNCATE on "public"."client_action_requests" to "service_role";

grant REFERENCES on "public"."client_action_requests" to "service_role";

grant TRIGGER on "public"."client_action_requests" to "service_role";

grant INSERT on "public"."billing_invoice_items" to "anon";

grant SELECT on "public"."billing_invoice_items" to "anon";

grant UPDATE on "public"."billing_invoice_items" to "anon";

grant DELETE on "public"."billing_invoice_items" to "anon";

grant TRUNCATE on "public"."billing_invoice_items" to "anon";

grant REFERENCES on "public"."billing_invoice_items" to "anon";

grant TRIGGER on "public"."billing_invoice_items" to "anon";

grant INSERT on "public"."billing_invoice_items" to "authenticated";

grant SELECT on "public"."billing_invoice_items" to "authenticated";

grant UPDATE on "public"."billing_invoice_items" to "authenticated";

grant DELETE on "public"."billing_invoice_items" to "authenticated";

grant TRUNCATE on "public"."billing_invoice_items" to "authenticated";

grant REFERENCES on "public"."billing_invoice_items" to "authenticated";

grant TRIGGER on "public"."billing_invoice_items" to "authenticated";

grant INSERT on "public"."billing_invoice_items" to "service_role";

grant SELECT on "public"."billing_invoice_items" to "service_role";

grant UPDATE on "public"."billing_invoice_items" to "service_role";

grant DELETE on "public"."billing_invoice_items" to "service_role";

grant TRUNCATE on "public"."billing_invoice_items" to "service_role";

grant REFERENCES on "public"."billing_invoice_items" to "service_role";

grant TRIGGER on "public"."billing_invoice_items" to "service_role";

grant INSERT on "public"."project_deliverables" to "anon";

grant SELECT on "public"."project_deliverables" to "anon";

grant UPDATE on "public"."project_deliverables" to "anon";

grant DELETE on "public"."project_deliverables" to "anon";

grant TRUNCATE on "public"."project_deliverables" to "anon";

grant REFERENCES on "public"."project_deliverables" to "anon";

grant TRIGGER on "public"."project_deliverables" to "anon";

grant INSERT on "public"."project_deliverables" to "authenticated";

grant SELECT on "public"."project_deliverables" to "authenticated";

grant UPDATE on "public"."project_deliverables" to "authenticated";

grant DELETE on "public"."project_deliverables" to "authenticated";

grant TRUNCATE on "public"."project_deliverables" to "authenticated";

grant REFERENCES on "public"."project_deliverables" to "authenticated";

grant TRIGGER on "public"."project_deliverables" to "authenticated";

grant INSERT on "public"."project_deliverables" to "service_role";

grant SELECT on "public"."project_deliverables" to "service_role";

grant UPDATE on "public"."project_deliverables" to "service_role";

grant DELETE on "public"."project_deliverables" to "service_role";

grant TRUNCATE on "public"."project_deliverables" to "service_role";

grant REFERENCES on "public"."project_deliverables" to "service_role";

grant TRIGGER on "public"."project_deliverables" to "service_role";

grant INSERT on "public"."billing_payment_methods" to "anon";

grant SELECT on "public"."billing_payment_methods" to "anon";

grant UPDATE on "public"."billing_payment_methods" to "anon";

grant DELETE on "public"."billing_payment_methods" to "anon";

grant TRUNCATE on "public"."billing_payment_methods" to "anon";

grant REFERENCES on "public"."billing_payment_methods" to "anon";

grant TRIGGER on "public"."billing_payment_methods" to "anon";

grant INSERT on "public"."billing_payment_methods" to "authenticated";

grant SELECT on "public"."billing_payment_methods" to "authenticated";

grant UPDATE on "public"."billing_payment_methods" to "authenticated";

grant DELETE on "public"."billing_payment_methods" to "authenticated";

grant TRUNCATE on "public"."billing_payment_methods" to "authenticated";

grant REFERENCES on "public"."billing_payment_methods" to "authenticated";

grant TRIGGER on "public"."billing_payment_methods" to "authenticated";

grant INSERT on "public"."billing_payment_methods" to "service_role";

grant SELECT on "public"."billing_payment_methods" to "service_role";

grant UPDATE on "public"."billing_payment_methods" to "service_role";

grant DELETE on "public"."billing_payment_methods" to "service_role";

grant TRUNCATE on "public"."billing_payment_methods" to "service_role";

grant REFERENCES on "public"."billing_payment_methods" to "service_role";

grant TRIGGER on "public"."billing_payment_methods" to "service_role";

grant INSERT on "public"."billing_payments" to "anon";

grant SELECT on "public"."billing_payments" to "anon";

grant UPDATE on "public"."billing_payments" to "anon";

grant DELETE on "public"."billing_payments" to "anon";

grant TRUNCATE on "public"."billing_payments" to "anon";

grant REFERENCES on "public"."billing_payments" to "anon";

grant TRIGGER on "public"."billing_payments" to "anon";

grant INSERT on "public"."billing_payments" to "authenticated";

grant SELECT on "public"."billing_payments" to "authenticated";

grant UPDATE on "public"."billing_payments" to "authenticated";

grant DELETE on "public"."billing_payments" to "authenticated";

grant TRUNCATE on "public"."billing_payments" to "authenticated";

grant REFERENCES on "public"."billing_payments" to "authenticated";

grant TRIGGER on "public"."billing_payments" to "authenticated";

grant INSERT on "public"."billing_payments" to "service_role";

grant SELECT on "public"."billing_payments" to "service_role";

grant UPDATE on "public"."billing_payments" to "service_role";

grant DELETE on "public"."billing_payments" to "service_role";

grant TRUNCATE on "public"."billing_payments" to "service_role";

grant REFERENCES on "public"."billing_payments" to "service_role";

grant TRIGGER on "public"."billing_payments" to "service_role";

grant INSERT on "public"."billing_invoices" to "anon";

grant SELECT on "public"."billing_invoices" to "anon";

grant UPDATE on "public"."billing_invoices" to "anon";

grant DELETE on "public"."billing_invoices" to "anon";

grant TRUNCATE on "public"."billing_invoices" to "anon";

grant REFERENCES on "public"."billing_invoices" to "anon";

grant TRIGGER on "public"."billing_invoices" to "anon";

grant INSERT on "public"."billing_invoices" to "authenticated";

grant SELECT on "public"."billing_invoices" to "authenticated";

grant UPDATE on "public"."billing_invoices" to "authenticated";

grant DELETE on "public"."billing_invoices" to "authenticated";

grant TRUNCATE on "public"."billing_invoices" to "authenticated";

grant REFERENCES on "public"."billing_invoices" to "authenticated";

grant TRIGGER on "public"."billing_invoices" to "authenticated";

grant INSERT on "public"."billing_invoices" to "service_role";

grant SELECT on "public"."billing_invoices" to "service_role";

grant UPDATE on "public"."billing_invoices" to "service_role";

grant DELETE on "public"."billing_invoices" to "service_role";

grant TRUNCATE on "public"."billing_invoices" to "service_role";

grant REFERENCES on "public"."billing_invoices" to "service_role";

grant TRIGGER on "public"."billing_invoices" to "service_role";

grant INSERT on "public"."billing_paypal_orders" to "anon";

grant SELECT on "public"."billing_paypal_orders" to "anon";

grant UPDATE on "public"."billing_paypal_orders" to "anon";

grant DELETE on "public"."billing_paypal_orders" to "anon";

grant TRUNCATE on "public"."billing_paypal_orders" to "anon";

grant REFERENCES on "public"."billing_paypal_orders" to "anon";

grant TRIGGER on "public"."billing_paypal_orders" to "anon";

grant INSERT on "public"."billing_paypal_orders" to "authenticated";

grant SELECT on "public"."billing_paypal_orders" to "authenticated";

grant UPDATE on "public"."billing_paypal_orders" to "authenticated";

grant DELETE on "public"."billing_paypal_orders" to "authenticated";

grant TRUNCATE on "public"."billing_paypal_orders" to "authenticated";

grant REFERENCES on "public"."billing_paypal_orders" to "authenticated";

grant TRIGGER on "public"."billing_paypal_orders" to "authenticated";

grant INSERT on "public"."billing_paypal_orders" to "service_role";

grant SELECT on "public"."billing_paypal_orders" to "service_role";

grant UPDATE on "public"."billing_paypal_orders" to "service_role";

grant DELETE on "public"."billing_paypal_orders" to "service_role";

grant TRUNCATE on "public"."billing_paypal_orders" to "service_role";

grant REFERENCES on "public"."billing_paypal_orders" to "service_role";

grant TRIGGER on "public"."billing_paypal_orders" to "service_role";

grant INSERT on "public"."billing_paypal_config" to "anon";

grant SELECT on "public"."billing_paypal_config" to "anon";

grant UPDATE on "public"."billing_paypal_config" to "anon";

grant DELETE on "public"."billing_paypal_config" to "anon";

grant TRUNCATE on "public"."billing_paypal_config" to "anon";

grant REFERENCES on "public"."billing_paypal_config" to "anon";

grant TRIGGER on "public"."billing_paypal_config" to "anon";

grant INSERT on "public"."billing_paypal_config" to "authenticated";

grant SELECT on "public"."billing_paypal_config" to "authenticated";

grant UPDATE on "public"."billing_paypal_config" to "authenticated";

grant DELETE on "public"."billing_paypal_config" to "authenticated";

grant TRUNCATE on "public"."billing_paypal_config" to "authenticated";

grant REFERENCES on "public"."billing_paypal_config" to "authenticated";

grant TRIGGER on "public"."billing_paypal_config" to "authenticated";

grant INSERT on "public"."billing_paypal_config" to "service_role";

grant SELECT on "public"."billing_paypal_config" to "service_role";

grant UPDATE on "public"."billing_paypal_config" to "service_role";

grant DELETE on "public"."billing_paypal_config" to "service_role";

grant TRUNCATE on "public"."billing_paypal_config" to "service_role";

grant REFERENCES on "public"."billing_paypal_config" to "service_role";

grant TRIGGER on "public"."billing_paypal_config" to "service_role";

grant INSERT on "public"."client_handoffs" to "anon";

grant SELECT on "public"."client_handoffs" to "anon";

grant UPDATE on "public"."client_handoffs" to "anon";

grant DELETE on "public"."client_handoffs" to "anon";

grant TRUNCATE on "public"."client_handoffs" to "anon";

grant REFERENCES on "public"."client_handoffs" to "anon";

grant TRIGGER on "public"."client_handoffs" to "anon";

grant INSERT on "public"."client_handoffs" to "authenticated";

grant SELECT on "public"."client_handoffs" to "authenticated";

grant UPDATE on "public"."client_handoffs" to "authenticated";

grant DELETE on "public"."client_handoffs" to "authenticated";

grant TRUNCATE on "public"."client_handoffs" to "authenticated";

grant REFERENCES on "public"."client_handoffs" to "authenticated";

grant TRIGGER on "public"."client_handoffs" to "authenticated";

grant INSERT on "public"."client_handoffs" to "service_role";

grant SELECT on "public"."client_handoffs" to "service_role";

grant UPDATE on "public"."client_handoffs" to "service_role";

grant DELETE on "public"."client_handoffs" to "service_role";

grant TRUNCATE on "public"."client_handoffs" to "service_role";

grant REFERENCES on "public"."client_handoffs" to "service_role";

grant TRIGGER on "public"."client_handoffs" to "service_role";

grant INSERT on "public"."handoff_tasks" to "anon";

grant SELECT on "public"."handoff_tasks" to "anon";

grant UPDATE on "public"."handoff_tasks" to "anon";

grant DELETE on "public"."handoff_tasks" to "anon";

grant TRUNCATE on "public"."handoff_tasks" to "anon";

grant REFERENCES on "public"."handoff_tasks" to "anon";

grant TRIGGER on "public"."handoff_tasks" to "anon";

grant INSERT on "public"."handoff_tasks" to "authenticated";

grant SELECT on "public"."handoff_tasks" to "authenticated";

grant UPDATE on "public"."handoff_tasks" to "authenticated";

grant DELETE on "public"."handoff_tasks" to "authenticated";

grant TRUNCATE on "public"."handoff_tasks" to "authenticated";

grant REFERENCES on "public"."handoff_tasks" to "authenticated";

grant TRIGGER on "public"."handoff_tasks" to "authenticated";

grant INSERT on "public"."handoff_tasks" to "service_role";

grant SELECT on "public"."handoff_tasks" to "service_role";

grant UPDATE on "public"."handoff_tasks" to "service_role";

grant DELETE on "public"."handoff_tasks" to "service_role";

grant TRUNCATE on "public"."handoff_tasks" to "service_role";

grant REFERENCES on "public"."handoff_tasks" to "service_role";

grant TRIGGER on "public"."handoff_tasks" to "service_role";

revoke all on function "public"."set_project_inquiries_updated_at"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."handle_new_app_user"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."is_src_staff"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."log_lead_status_change"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."log_lead_note"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."create_signable_document"(p_client_id uuid, p_project_id uuid, p_name text, p_category text, p_content text, p_signature_kind text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."countersign_document"(p_document_id uuid, p_legal_name text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."google_drive_oauth_credentials"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."sign_document"(p_request_id uuid, p_legal_name text, p_signature_value text, p_consent boolean) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."convert_lead_to_client"(p_inquiry_id uuid) from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_communication"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."store_google_drive_refresh_token"(p_refresh_token text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."configure_google_drive_oauth"(p_client_id text, p_client_secret text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."web_push_config"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."begin_google_drive_oauth"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_project_change"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."enqueue_client_notification"(p_client uuid, p_category text, p_title text, p_body text, p_url text, p_tag text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."enqueue_staff_notification"(p_category text, p_title text, p_body text, p_url text, p_tag text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_signature_request"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_signature_completed"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_document_final"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_milestone_change"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."mark_signature_viewed"(p_request_id uuid) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."get_client_document_library"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."complete_client_action_request"(p_action_id uuid) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."set_billing_invoice_updated_at"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."retry_failed_notifications"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."record_billing_payment"(p_invoice_id uuid, p_amount_cents bigint, p_method_label text, p_paid_at timestamp with time zone, p_reference text, p_note text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_client_action_request"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."notify_successful_payment"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."prevent_archived_financial_delete"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."protect_billing_payment_artifact"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."create_billing_invoice_v2"(p_client_id uuid, p_project_id uuid, p_items jsonb, p_due_at timestamp with time zone, p_notes text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "private"."protect_finalized_billing_invoice"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."create_billing_invoice"(p_client_id uuid, p_project_id uuid, p_description text, p_amount_cents bigint, p_due_at timestamp with time zone, p_notes text) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."record_paypal_payment"(p_paypal_order_id text, p_capture_id text, p_amount_cents bigint, p_paid_at timestamp with time zone) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."get_staff_signature_preview"(p_request_id uuid) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."set_client_portal_access"(p_client_id uuid, p_enabled boolean) from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."seed_handoff_tasks"() from PUBLIC,anon,authenticated,service_role;

revoke all on function "public"."sync_handoff_agreement_task"() from PUBLIC,anon,authenticated,service_role;

grant EXECUTE on function "public"."set_project_inquiries_updated_at"() to PUBLIC;

grant EXECUTE on function "public"."set_project_inquiries_updated_at"() to "anon";

grant EXECUTE on function "public"."set_project_inquiries_updated_at"() to "authenticated";

grant EXECUTE on function "public"."set_project_inquiries_updated_at"() to "service_role";

grant EXECUTE on function "public"."handle_new_app_user"() to "service_role";

grant EXECUTE on function "private"."is_src_staff"() to "authenticated";

grant EXECUTE on function "public"."log_lead_status_change"() to "service_role";

grant EXECUTE on function "public"."log_lead_note"() to "service_role";

grant EXECUTE on function "public"."create_signable_document"(p_client_id uuid, p_project_id uuid, p_name text, p_category text, p_content text, p_signature_kind text) to PUBLIC;

grant EXECUTE on function "public"."create_signable_document"(p_client_id uuid, p_project_id uuid, p_name text, p_category text, p_content text, p_signature_kind text) to "anon";

grant EXECUTE on function "public"."create_signable_document"(p_client_id uuid, p_project_id uuid, p_name text, p_category text, p_content text, p_signature_kind text) to "authenticated";

grant EXECUTE on function "public"."create_signable_document"(p_client_id uuid, p_project_id uuid, p_name text, p_category text, p_content text, p_signature_kind text) to "service_role";

grant EXECUTE on function "public"."countersign_document"(p_document_id uuid, p_legal_name text) to PUBLIC;

grant EXECUTE on function "public"."countersign_document"(p_document_id uuid, p_legal_name text) to "anon";

grant EXECUTE on function "public"."countersign_document"(p_document_id uuid, p_legal_name text) to "authenticated";

grant EXECUTE on function "public"."countersign_document"(p_document_id uuid, p_legal_name text) to "service_role";

grant EXECUTE on function "public"."google_drive_oauth_credentials"() to "service_role";

grant EXECUTE on function "public"."sign_document"(p_request_id uuid, p_legal_name text, p_signature_value text, p_consent boolean) to "authenticated";

grant EXECUTE on function "public"."sign_document"(p_request_id uuid, p_legal_name text, p_signature_value text, p_consent boolean) to "service_role";

grant EXECUTE on function "public"."convert_lead_to_client"(p_inquiry_id uuid) to "authenticated";

grant EXECUTE on function "public"."convert_lead_to_client"(p_inquiry_id uuid) to "service_role";

grant EXECUTE on function "private"."notify_communication"() to PUBLIC;

grant EXECUTE on function "public"."store_google_drive_refresh_token"(p_refresh_token text) to "service_role";

grant EXECUTE on function "public"."configure_google_drive_oauth"(p_client_id text, p_client_secret text) to "authenticated";

grant EXECUTE on function "public"."configure_google_drive_oauth"(p_client_id text, p_client_secret text) to "service_role";

grant EXECUTE on function "private"."web_push_config"() to "service_role";

grant EXECUTE on function "public"."begin_google_drive_oauth"() to "authenticated";

grant EXECUTE on function "public"."begin_google_drive_oauth"() to "service_role";

grant EXECUTE on function "private"."notify_project_change"() to PUBLIC;

grant EXECUTE on function "private"."enqueue_client_notification"(p_client uuid, p_category text, p_title text, p_body text, p_url text, p_tag text) to PUBLIC;

grant EXECUTE on function "private"."enqueue_staff_notification"(p_category text, p_title text, p_body text, p_url text, p_tag text) to PUBLIC;

grant EXECUTE on function "private"."notify_signature_request"() to PUBLIC;

grant EXECUTE on function "private"."notify_signature_completed"() to PUBLIC;

grant EXECUTE on function "private"."notify_document_final"() to PUBLIC;

grant EXECUTE on function "private"."notify_milestone_change"() to PUBLIC;

grant EXECUTE on function "public"."mark_signature_viewed"(p_request_id uuid) to "authenticated";

grant EXECUTE on function "public"."mark_signature_viewed"(p_request_id uuid) to "service_role";

grant EXECUTE on function "public"."get_client_document_library"() to "authenticated";

grant EXECUTE on function "public"."get_client_document_library"() to "service_role";

grant EXECUTE on function "public"."complete_client_action_request"(p_action_id uuid) to "authenticated";

grant EXECUTE on function "public"."complete_client_action_request"(p_action_id uuid) to "service_role";

grant EXECUTE on function "public"."set_billing_invoice_updated_at"() to PUBLIC;

grant EXECUTE on function "public"."set_billing_invoice_updated_at"() to "anon";

grant EXECUTE on function "public"."set_billing_invoice_updated_at"() to "authenticated";

grant EXECUTE on function "public"."set_billing_invoice_updated_at"() to "service_role";

grant EXECUTE on function "public"."retry_failed_notifications"() to "authenticated";

grant EXECUTE on function "public"."retry_failed_notifications"() to "service_role";

grant EXECUTE on function "public"."record_billing_payment"(p_invoice_id uuid, p_amount_cents bigint, p_method_label text, p_paid_at timestamp with time zone, p_reference text, p_note text) to "service_role";

grant EXECUTE on function "private"."notify_client_action_request"() to PUBLIC;

grant EXECUTE on function "private"."notify_successful_payment"() to PUBLIC;

grant EXECUTE on function "private"."prevent_archived_financial_delete"() to PUBLIC;

grant EXECUTE on function "private"."protect_billing_payment_artifact"() to PUBLIC;

grant EXECUTE on function "public"."create_billing_invoice_v2"(p_client_id uuid, p_project_id uuid, p_items jsonb, p_due_at timestamp with time zone, p_notes text) to "authenticated";

grant EXECUTE on function "public"."create_billing_invoice_v2"(p_client_id uuid, p_project_id uuid, p_items jsonb, p_due_at timestamp with time zone, p_notes text) to "service_role";

grant EXECUTE on function "private"."protect_finalized_billing_invoice"() to PUBLIC;

grant EXECUTE on function "public"."create_billing_invoice"(p_client_id uuid, p_project_id uuid, p_description text, p_amount_cents bigint, p_due_at timestamp with time zone, p_notes text) to "service_role";

grant EXECUTE on function "public"."record_paypal_payment"(p_paypal_order_id text, p_capture_id text, p_amount_cents bigint, p_paid_at timestamp with time zone) to "service_role";

grant EXECUTE on function "public"."get_staff_signature_preview"(p_request_id uuid) to "authenticated";

grant EXECUTE on function "public"."get_staff_signature_preview"(p_request_id uuid) to "service_role";

grant EXECUTE on function "public"."set_client_portal_access"(p_client_id uuid, p_enabled boolean) to PUBLIC;

grant EXECUTE on function "public"."set_client_portal_access"(p_client_id uuid, p_enabled boolean) to "anon";

grant EXECUTE on function "public"."set_client_portal_access"(p_client_id uuid, p_enabled boolean) to "authenticated";

grant EXECUTE on function "public"."set_client_portal_access"(p_client_id uuid, p_enabled boolean) to "service_role";

grant EXECUTE on function "public"."seed_handoff_tasks"() to PUBLIC;

grant EXECUTE on function "public"."seed_handoff_tasks"() to "anon";

grant EXECUTE on function "public"."seed_handoff_tasks"() to "authenticated";

grant EXECUTE on function "public"."seed_handoff_tasks"() to "service_role";

grant EXECUTE on function "public"."sync_handoff_agreement_task"() to PUBLIC;

grant EXECUTE on function "public"."sync_handoff_agreement_task"() to "anon";

grant EXECUTE on function "public"."sync_handoff_agreement_task"() to "authenticated";

grant EXECUTE on function "public"."sync_handoff_agreement_task"() to "service_role";

set check_function_bodies = on;
