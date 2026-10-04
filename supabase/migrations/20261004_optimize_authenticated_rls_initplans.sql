-- Mirrors the production RLS init-plan optimization applied during beta readiness.
-- Wrapping auth.uid() in a scalar SELECT lets PostgreSQL evaluate it once per statement
-- instead of once per row, without changing policy semantics.
do $$
declare r record; v_using text; v_check text; v_sql text;
begin
 for r in
  select tablename,policyname,cmd,qual,with_check
  from pg_policies
  where schemaname='public'
    and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
 loop
  v_using:=case when r.qual is null then null else replace(r.qual,'auth.uid()','(select auth.uid())') end;
  v_check:=case when r.with_check is null then null else replace(r.with_check,'auth.uid()','(select auth.uid())') end;
  v_sql:='alter policy '||quote_ident(r.policyname)||' on public.'||quote_ident(r.tablename);
  if v_using is not null then v_sql:=v_sql||' using ('||v_using||')'; end if;
  if v_check is not null then v_sql:=v_sql||' with check ('||v_check||')'; end if;
  execute v_sql;
 end loop;
end $$;
