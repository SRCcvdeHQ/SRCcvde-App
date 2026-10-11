# SRCcvde workspace

Authenticated React/TypeScript client workspace and staff CRM backed by Supabase. Cloudflare Pages serves the SPA; Supabase provides Auth, Postgres/RLS, private object storage, and Edge Functions. Google Drive receives server-side document archives. PayPal remains sandbox-only in this release.

Use Node 22.18+ and `npm ci`. Copy `.env.example` to `.env.local`, supply the public Supabase URL/key, then run `npm run dev`. No service-role key belongs in browser variables.

Before committing: `npm test`, `npm run check:functions`, and `npm run build`. Tests restore the schema in isolated PGlite, exercise the real migration and RLS, and validate active account/MFA and intake policies. Managed Supabase services use stand-ins; these tests do not replace staging integration checks.

Read [architecture](docs/ARCHITECTURE.md) and [release instructions](docs/RELEASE.md) before deploying. Production deployment is manual after review; no migration or DNS update is automatic.
