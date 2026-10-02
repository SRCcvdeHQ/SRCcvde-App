# SRCcvde App Architecture

## Product boundary
- **srccvde.com** — public marketing and project intake
- **app.srccvde.com** — authenticated CRM and client workspace
- **Supabase** — authentication, CRM/application state, RLS, audit events
- **Google Drive** — source-of-truth file/document storage
- **GitHub** — application source and deployment
- **Cloudflare** — DNS and edge/security controls

## CRM lifecycle
Website inquiry → lead pipeline → discovery → proposal → contract → conversion → client + project workspace.

Lead conversion is idempotent and creates a client plus its initial project without re-keying inquiry data. Portal invitations are sent server-side through the `invite-client` Edge Function; the browser never receives service-role credentials.

## Core tables
- `project_inquiries` — website leads and pipeline state
- `lead_notes` — staff-only notes
- `crm_activity` — timestamped audit/activity events
- `clients` — accepted client records
- `client_memberships` — client-to-auth-user access
- `projects` — delivery workspaces
- `client_documents` — Google Drive metadata/index
- `client_communications` — communication history
- `app_memberships` — global app role and access state
- `profiles` — user profile data

## Security principles
- No public sign-up in the app UI.
- Authentication and active app membership are both required.
- RLS is the authorization boundary.
- Staff access is evaluated by a private security-definer helper.
- Clients only read records linked through `client_memberships`.
- Internal notes are never client-readable.
- Drive files are never made public merely to render them in the portal.
- Server secrets never ship in Vite/browser bundles.
- Signed document versions will be immutable; revisions require new signature events.
