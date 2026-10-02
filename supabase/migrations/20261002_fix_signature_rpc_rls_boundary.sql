-- Signing RPC: authenticated signer identity is read from PostgREST JWT claims.
-- SECURITY DEFINER is intentional so the atomic multi-table signing transaction can
-- cross client RLS after the function verifies the assigned signer.
create or replace function public.sign_document(
  p_request_id uuid,
  p_legal_name text,
  p_signature_value text,
  p_consent boolean
) returns void
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
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

  select * into v_req from public.signature_requests where id=p_request_id for update;
  if not found then raise exception 'signature request not found'; end if;

  if not (v_req.signer_user_id=v_uid or (v_email<>'' and lower(coalesce(v_req.signer_email,''))=v_email))
    then raise exception 'not authorized';
  end if;
  if v_req.status<>'pending' then raise exception 'request is not pending'; end if;

  select content_sha256 into v_hash from public.document_versions where id=v_req.document_version_id;

  insert into public.signature_events(signature_request_id,event_type,actor_user_id,legal_name,document_sha256)
  values(p_request_id,'consented',v_uid,trim(p_legal_name),v_hash);

  update public.signature_requests
  set status='signed',signed_at=now(),signer_user_id=v_uid,legal_name=trim(p_legal_name),
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
$function$;

revoke all on function public.sign_document(uuid,text,text,boolean) from public, anon;
grant execute on function public.sign_document(uuid,text,text,boolean) to authenticated;
