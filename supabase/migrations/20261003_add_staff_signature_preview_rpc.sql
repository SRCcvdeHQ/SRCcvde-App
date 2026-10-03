create or replace function public.get_staff_signature_preview(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','auth'
as $function$
declare v_uid uuid; v_claims jsonb; v_role text; v_status text; v_req public.signature_requests%rowtype; v_ver public.document_versions%rowtype; v_doc public.client_documents%rowtype;
begin
 v_claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 v_uid:=nullif(v_claims->>'sub','')::uuid;
 if v_uid is null then raise exception 'authentication required'; end if;
 select role::text,status::text into v_role,v_status from public.app_memberships where user_id=v_uid;
 if v_status is distinct from 'active' or v_role not in ('admin','staff') then raise exception 'not authorized'; end if;
 select * into v_req from public.signature_requests where id=p_request_id;
 if not found then raise exception 'signature request not found'; end if;
 select * into v_ver from public.document_versions where id=v_req.document_version_id;
 select * into v_doc from public.client_documents where id=v_req.document_id;
 return jsonb_build_object('request',to_jsonb(v_req)-'signature_value','version',to_jsonb(v_ver),'document',to_jsonb(v_doc));
end
$function$;
revoke all on function public.get_staff_signature_preview(uuid) from public,anon;
grant execute on function public.get_staff_signature_preview(uuid) to authenticated;