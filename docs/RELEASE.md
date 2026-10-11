# Coordinated release

Review this PR with the website PR before merging. No production settings are changed by source changes alone.

## Staging first

Create a separate Supabase project. On a fresh project, restore `supabase/baseline/schema.sql` instead of replaying historical migrations through 2026-10-09, then apply `20261011171941_enforce_active_access_and_atomic_intake.sql`. Recreate private buckets/limits, Auth settings/redirects, Vault entries and provider configuration separately. Never apply the baseline to the existing production database.

Use staging synthetic owner, client A, client B, and suspended accounts. Verify staff TOTP enrollment, login with AAL1 denial then AAL2 success, recovery, tenant isolation, storage downloads, signatures, manual payments, PayPal sandbox checkout/webhook/replay, Resend delivery webhooks, OAuth state verification, archive generation, and push notification delivery. Verify malformed and repeated intake requests and concurrent requests using a real multi-session PostgreSQL test. Local PGlite queues queries; it verifies admission outcomes but is not a multi-process contention/load test.

## Existing production project

1. Back up the database and record the current Edge Function versions and Auth settings. Inspect remote migration history; apply only the new security migration after review. Do not run a blind database push of all historical files.
2. Confirm Auth allows TOTP enrollment/verification and **enable leaked password protection**. Existing accounts still need normal recovery procedures. Confirm the owner can enroll and has a supported recovery path before enforcing staff MFA.
3. Release the MFA frontend and access-guard migration/functions in one planned window. Active staff must enroll/verify an authenticator to resume staff access. Clients do not acquire a new MFA requirement. Do not roll back server checks to bypass a broken frontend.
4. Set encrypted Supabase secrets `INTAKE_GATEWAY_SECRET` and independent `INTAKE_HASH_SECRET`; set the identical gateway secret in the public website Pages Function. Keep existing provider secrets. Deploy intake and website gateway together; the old direct browser intake stops working after enforcement.
5. Deploy all changed Edge Functions. Preserve existing `verify_jwt` settings: true for `google-drive-oauth-start` and `handoff-contract-archive`; false for the other 17 functions, which perform application-token validation or provider verification themselves. Public intake authenticates the gateway secret. Webhooks must remain provider-verified. Do not accidentally enable legacy JWT gateway verification on publishable-key intake/webhooks.
6. Create `srccvde-workspace` in Cloudflare Pages. Build `npm ci && npm run build`, output `dist`, with public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Production manual workflow uses the `cloudflare-production` environment, encrypted `CLOUDFLARE_API_TOKEN`, and account variable `CLOUDFLARE_ACCOUNT_ID`. Use Pages-edit access scoped to the account.
7. Verify staging headers with the PayPal SDK. CSP allows the configured sandbox script/frame/connect hosts; do not weaken it without identifying a required origin. Auth recovery/redirect URLs must include the final production workspace; use staging redirects only for staging. Inspect deep links, service-worker upgrades, login, recovery, and mobile layouts before custom-domain cutover.
8. Attach `app.srccvde.com` to Pages and review the DNS target. Preserve unrelated DNS/email records. Keep the prior hosting deployment for rollback. Run the staging checklist again on production using authorized accounts and controlled records before declaring completion.

## Verification completed in the review branch

Frontend TypeScript/build, all 19 Edge Function typechecks, schema restore/new migration, RLS tenant isolation, suspended access denial, staff AAL1/AAL2 policy, anonymous RPC denial, validation of all current budget/timeline choices, duplicate admission, and rolling limit outcomes are checked locally. Production Auth changes, hosting/DNS, real MFA recovery, payments, signatures, provider callbacks, and multi-session concurrency remain release checks.
