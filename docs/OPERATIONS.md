# Operating the SRCcvde workspace

## Recovery and backups

The owner enrolled a verified authenticator after the October 11 release. Keep its recovery/export material in your password manager and a separate secure copy. A second trusted administrator must use their own account and authenticator. Do not share the owner's login, remove MFA from the only owner as a troubleshooting step, or grant staff access to an unverified email address.

Before changing access, verify the second administrator can sign in with MFA, then test recovery with a controlled test account. Recovery messages and invitations require an authorized test inbox. A password-reset email alone does not replace a lost authenticator. If the only owner loses access, use the documented Supabase administrator recovery process, verify their identity, revoke old sessions, and immediately re-enroll MFA.

The current local recovery snapshot contains application rows and release configuration; it is **not a complete, independently tested backup**. Production has no confirmed downloadable physical backup or PITR. A standard Supabase CLI dump was attempted but could not run because Docker/Podman is absent on the release computer.

To establish backups:

1. Install/start Docker or Podman, and authenticate the Supabase CLI to the SRCcvde organization.
2. Use the pinned CLI's `db dump --help` before exporting roles, schema, and data with `--linked --project-ref pszxarjungpoqvbwoblf`. Store output outside the repository with restrictive permissions; never commit exports. Stop on errors and reject empty files.
3. Separately export Storage object contents. Database backups contain metadata, not the stored documents. Record Auth settings, deployed function versions, private bucket rules, DNS, and provider configuration. Keep secret recovery material encrypted and separately controlled.
4. Encrypt the backup, copy it to an owner-approved offsite destination, and retain daily/weekly versions with documented retention. A local snapshot on this computer is insufficient for disaster recovery.
5. Restore into a separate nonproduction project, with email, payments, notifications, and provider callbacks disabled. Verify representative row counts, tenant policies, Auth recovery, document downloads, and object integrity before marking a backup usable.

## Staging

Create a separate project only after the owner chooses the organization. Use synthetic users and documents, PayPal sandbox credentials, an isolated email destination, and independent gateway/hash secrets. Production data and provider secrets must not be copied by default. Follow `RELEASE.md` for the fresh-project baseline, then compare remote migration history before applying any migration. Hosted staging and provider tests remain pending; local database and mocked browser suites do not prove provider delivery.

## Deployment

Both repositories have manual production workflows restricted to `main`. Configure each repository's `cloudflare-production` environment:

- Variable `CLOUDFLARE_ACCOUNT_ID`: `e59cc8c4b6d34ce2867993d9eda8c634`.
- Encrypted secret `CLOUDFLARE_API_TOKEN`: an owner-created token with Pages edit access scoped to that account. Never paste this token into a chat, source file, or workflow log.
- Environment review/branch rules appropriate to the repository's GitHub plan.

The connector cannot administer GitHub environment secrets, the local GitHub CLI currently needs reauthentication, and the connected Cloudflare token cannot create account tokens. Credential setup therefore requires the owner's secure handoff. The workflow reports missing credentials before upload and runs database/browser checks before deploying. No database migration is performed by the Pages workflow.

## Monitoring and incidents

Hourly monitoring is active in the Codex thread. It checks public availability, security headers, the public 404, workspace deep links, canonical redirection, and rejection of an empty inquiry. It sends no valid inquiry or payment. This local automation depends on the host being available; it is not independently hosted 24-hour monitoring.

The website repository's `npm run check:live` prints machine-readable probe results. A failing deployment health check requires investigation; it does not automatically roll back. Record the failing URL, response status, time, and recent deployment before changing anything. Keep customer data and tokens out of logs. Check Supabase/Cloudflare provider logs for function failures and deployment errors; no external error-tracking service has been configured.

## Verification from this follow-up

- Local database suite: tenant separation, active membership/MFA gates, approval idempotency, signing consent and request ownership, invoice arithmetic, exact payment amounts, service-only capture, and payment replay idempotency.
- Twelve desktop/mobile browser checks: accessible sign-in, inactive recovery link, suspended membership, staff MFA, billing failure/retry, unavailable document, and document-library retry. All provider traffic is mocked or blocked.
- Live public checks: HTTPS pages/headers, workspace deep links, 404, canonical path/query redirect, and invalid inquiry rejection.

Real invitation/recovery delivery, signed PDF downloads, PayPal sandbox callbacks, OAuth/archive callbacks, offsite backup restoration, and a second administrator remain outstanding.
