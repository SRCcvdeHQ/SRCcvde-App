create or replace function public.mark_signature_viewed(p_request_id uuid)
returns void language plpgsql security definer set search_path to 'public','auth'
as $function$
declare v_req public.signature_requests%rowtype; v_uid uuid; v_email text; v_claims jsonb; v_hash text;
begin
 v_claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 v_uid:=nullif(v_claims->>'sub','')::uuid; v_email:=lower(coalesce(v_claims->>'email',''));
 if v_uid is null then raise exception 'authentication required'; end if;
 select * into v_req from public.signature_requests where id=p_request_id for update;
 if not found then raise exception 'signature request not found'; end if;
 if not (v_req.signer_user_id=v_uid or (v_email<>'' and lower(coalesce(v_req.signer_email,''))=v_email)) then raise exception 'not authorized'; end if;
 if v_req.viewed_at is null then
  select content_sha256 into v_hash from public.document_versions where id=v_req.document_version_id;
  update public.signature_requests set viewed_at=now(),signer_user_id=coalesce(signer_user_id,v_uid) where id=p_request_id;
  insert into public.signature_events(signature_request_id,event_type,actor_user_id,document_sha256) values(p_request_id,'viewed',v_uid,v_hash);
 end if;
end
$function$;
revoke all on function public.mark_signature_viewed(uuid) from public,anon;
grant execute on function public.mark_signature_viewed(uuid) to authenticated;
