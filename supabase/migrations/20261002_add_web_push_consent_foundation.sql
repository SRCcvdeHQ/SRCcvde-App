-- Web Push subscriptions and consent/preferences for SRCcvde PWA.
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth_key text not null,
 user_agent text,
 enabled boolean not null default true,
 consented_at timestamptz not null default now(),
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "users manage own push subscriptions" on public.push_subscriptions for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id) where enabled=true;
create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 project_updates boolean not null default true, documents boolean not null default true,
 approvals boolean not null default true, messages boolean not null default true,
 billing boolean not null default true, security boolean not null default true,
 marketing boolean not null default false, updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy "users manage own notification preferences" on public.notification_preferences for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create table if not exists public.notification_consent_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 action text not null check(action in ('granted','denied','revoked')), consent_text_version text not null,
 created_at timestamptz not null default now()
);
alter table public.notification_consent_events enable row level security;
create policy "users read own notification consent" on public.notification_consent_events for select to authenticated using (user_id=auth.uid());
create policy "users record own notification consent" on public.notification_consent_events for insert to authenticated with check (user_id=auth.uid());
