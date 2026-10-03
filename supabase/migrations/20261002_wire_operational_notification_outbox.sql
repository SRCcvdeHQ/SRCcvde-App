-- Operational notification outbox and workflow triggers.
-- Applied to production as migration: wire_operational_notification_outbox
-- Source of truth for notification categories and recipient routing.
create table if not exists public.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check (category in ('project_updates','documents','approvals','messages','billing','security','marketing')),
 title text not null, body text not null, url text not null default '/', tag text,
 status text not null default 'pending' check (status in ('pending','processing','sent','skipped','failed')),
 attempts integer not null default 0, last_error text,
 created_at timestamptz not null default now(), processed_at timestamptz
);
create index if not exists notification_outbox_pending_idx on public.notification_outbox(status,created_at);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;
-- Recipient helpers and triggers are installed by the production migration:
-- signature request -> client documents notification
-- client signature/acknowledgment -> staff approval notification
-- final document -> client documents notification
-- project phase/status/progress -> client project update
-- milestone status -> client project update
-- inbound/outbound client communication -> staff/client message notification
