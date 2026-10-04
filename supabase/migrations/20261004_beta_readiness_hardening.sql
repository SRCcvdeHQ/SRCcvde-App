-- Production hardening applied to SRCcvde on 2026-10-04.
-- This file mirrors the live changes so the repository can reproduce them.

create or replace function private.notify_client_action_request()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if tg_op='INSERT' and new.client_visible and new.status<>'completed' then
  perform private.enqueue_client_notification(new.client_id,'approvals','Action requested by SRCcvde',
   left(new.title || case when new.due_at is not null then ' · Due '||to_char(new.due_at at time zone 'UTC','Mon DD') else '' end,180),
   '/actions','client-action-'||new.id);
 elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='completed' then
  perform private.enqueue_staff_notification('approvals','Client completed an action',left(new.title,180),
   '/clients/'||new.client_id,'client-action-complete-'||new.id);
 end if;
 return new;
end $$;
drop trigger if exists trg_notify_client_action_request on public.client_action_requests;
create trigger trg_notify_client_action_request after insert or update of status on public.client_action_requests
for each row execute function private.notify_client_action_request();

create or replace function private.notify_successful_payment()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
 if new.status='succeeded' then
  perform private.enqueue_client_notification(new.client_id,'billing','Payment received',
   'SRCcvde received '||to_char(new.amount_cents/100.0,'FM$999,999,990.00')||
   case when new.method_label is not null then ' via '||new.method_label else '' end||'.',
   '/billing','payment-'||new.id);
 end if;
 return new;
end $$;
drop trigger if exists trg_notify_successful_payment on public.billing_payments;
create trigger trg_notify_successful_payment after insert on public.billing_payments
for each row execute function private.notify_successful_payment();

drop policy if exists "staff can read notification outbox" on public.notification_outbox;
create policy "staff can read notification outbox" on public.notification_outbox
for select to authenticated using (private.is_src_staff());

create or replace function public.retry_failed_notifications()
returns integer language plpgsql security definer set search_path=public,private as $$
declare n integer;
begin
 if not private.is_src_staff() then raise exception 'Forbidden'; end if;
 update public.notification_outbox set status='pending',last_error=null,processed_at=null
 where status='failed' and attempts<5;
 get diagnostics n = row_count;
 return n;
end $$;
revoke all on function public.retry_failed_notifications() from public;
revoke execute on function public.retry_failed_notifications() from anon;
grant execute on function public.retry_failed_notifications() to authenticated;

revoke execute on function public.complete_client_action_request(uuid) from anon;
revoke execute on function public.create_billing_invoice(uuid,uuid,text,bigint,timestamptz,text) from anon,authenticated;
revoke execute on function public.create_billing_invoice_v2(uuid,uuid,jsonb,timestamptz,text) from anon;
revoke execute on function public.record_billing_payment(uuid,bigint,text,timestamptz,text,text) from anon,authenticated;
revoke execute on function public.record_paypal_payment(text,text,bigint,timestamptz) from anon,authenticated;
grant execute on function public.record_billing_payment(uuid,bigint,text,timestamptz,text,text) to service_role;
grant execute on function public.record_paypal_payment(text,text,bigint,timestamptz) to service_role;

alter function public.set_billing_invoice_updated_at() set search_path=public,private;
alter function private.prevent_archived_financial_delete() set search_path=public,private;
alter function private.protect_finalized_billing_invoice() set search_path=public,private;
alter function private.protect_billing_payment_artifact() set search_path=public,private;

create index if not exists app_integrations_connected_by_idx on public.app_integrations(connected_by);
create index if not exists billing_payments_client_id_idx on public.billing_payments(client_id);
create index if not exists billing_paypal_orders_client_id_idx on public.billing_paypal_orders(client_id);
create index if not exists notification_consent_events_user_id_idx on public.notification_consent_events(user_id);
create index if not exists notification_outbox_recipient_user_id_idx on public.notification_outbox(recipient_user_id);
drop index if exists public.client_communications_client_idx;
