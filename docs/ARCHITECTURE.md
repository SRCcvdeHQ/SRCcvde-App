# Architecture

`srccvde.com` serves prerendered marketing pages and a Cloudflare Pages intake gateway. `app.srccvde.com` serves an authenticated SPA with lazy feature modules. Both use the shared Supabase backend. The workspace uses Pages’ native SPA fallback (no top-level 404.html); public pages retain a real 404. Public publishable keys identify the project; authorization comes from validated user JWTs, memberships, RLS, and service-side checks.

## Access boundary

Clients require active `app_memberships` and linked `client_memberships`. Staff require active owner/admin/staff membership and an AAL2 MFA session. `private.has_active_account` is a restrictive RLS predicate on application tables and storage; `private.is_src_staff` additionally restricts staff roles. Self-profile and membership reads remain available so the UI can explain account status and enroll MFA.

Security-definer RPCs check active account status before bypassing RLS. Protected Edge Functions validate tokens through Auth, read current membership using a server client, and check MFA before continuing. Service-only payment and intake RPCs are not callable by browser roles. Public webhooks retain their provider verification; Google OAuth callbacks retain state verification.

## Storage and integrations

Postgres contains project, client, document/version/signature, billing, activity, and notification metadata. Supabase private buckets store uploaded source artifacts, project files, invoice PDFs, and receipts where configured. Google Drive is used for server-side document/archive workflows; it is not the sole storage implementation. Browser clients receive only authorized signed downloads. Resend and PayPal credentials remain server secrets; PayPal deployment stays sandbox-only until separately tested and configured.

## Intake

The browser posts JSON to `/api/inquiry` on its own origin. Cloudflare supplies `CF-Connecting-IP`; the gateway forwards that value with a server secret. The Edge Function verifies the secret and bounds/validates input. A separate HMAC secret hashes IPs. The service-only RPC serializes admission with advisory transaction locks, checks duplicate briefs, and applies a rolling per-IP limit before insert. Duplicate retries do not create new leads. Push notifications run in a background task after the lead is committed so delivery cannot delay confirmation. Background tasks are not a durable queue guarantee; failed delivery still requires operational monitoring.

## Reproducibility

`supabase/baseline/schema.sql` is a schema-only snapshot of the live public/private schema as of 2026-10-11, before the new security migration. It supports fresh-environment restore testing. It contains no row data or secret values and does not recreate managed Auth, Vault, bucket configuration, OAuth/provider credentials, or platform settings. Historical migrations alone omit the original schema; do not replay them on top of this snapshot. Existing databases receive only new migrations after migration-history review.
