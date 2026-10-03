create or replace function public.get_client_document_library()
returns jsonb language plpgsql security definer set search_path to 'public','auth'
as $function$
declare v_uid uuid; v_claims jsonb; v_client_id uuid;
begin
 v_claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
 v_uid:=nullif(v_claims->>'sub','')::uuid;
 if v_uid is null then raise exception 'authentication required'; end if;
 select client_id into v_client_id from public.client_memberships where user_id=v_uid limit 1;
 if v_client_id is null then raise exception 'client membership required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('document',to_jsonb(d),'request',case when sr.id is null then null else to_jsonb(sr)-'signature_value' end,'artifact',case when a.id is null then null else to_jsonb(a) end) order by d.created_at desc)
 from public.client_documents d
 left join lateral (select x.* from public.signature_requests x where x.document_id=d.id and x.signer_side='client' order by x.requested_at desc limit 1) sr on true
 left join public.executed_document_artifacts a on a.document_id=d.id
 where d.client_id=v_client_id and d.client_visible=true),'[]'::jsonb);
end
$function$;
revoke all on function public.get_client_document_library() from public,anon;
grant execute on function public.get_client_document_library() to authenticated;