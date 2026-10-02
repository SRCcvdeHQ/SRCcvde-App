# SRCcvde App Architecture

## Product boundary
- **srccvde.com** — public marketing and project intake
- **app.srccvde.com** — authenticated CRM and client workspace
- **Supabase** — authentication, relational data, permissions, audit events
- **Google Drive** — source-of-truth file/document storage
- **GitHub** — application source and deployment
- **Cloudflare** — DNS and edge/security controls

## Lifecycle
Inquiry → Discovery → Proposal → Contract → Active project → Launch → Handoff

The same identity/workspace evolves as the relationship advances. Clients do not create a second account after contract execution.

## Security principles
- No public sign-up in the app UI.
- Membership is required in addition to authentication.
- RLS is the authorization boundary.
- Client records must be isolated by membership/project access.
- Drive files are never made public merely to render them in the portal.
- Signed document versions are immutable; new revisions require new signature events.
- Server secrets never ship in Vite/browser bundles.
