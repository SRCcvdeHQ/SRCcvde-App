# Google Drive executed-document archive

The app's executed-document engine always writes the final signed PDF to the private Supabase Storage bucket `executed-documents`.

Google Drive synchronization activates automatically when these Supabase Edge Function secrets are present:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

The archive root is SRCcvde's existing `03 — Clients` folder (`1j23qs5KZowr6BuVbbRnQdQvGN6mHhsG2`).

## Runtime behavior

Once OAuth is connected, `finalize-executed-document` automatically:

1. creates the client folder under `03 — Clients` when needed;
2. creates the standard seven client subfolders;
3. routes agreements to `01 — Agreements`, proposals/scopes to `02 — Scope & Proposals`, and other executed documents to `03 — Project Files`;
4. uploads `<document> - EXECUTED.pdf`;
5. stores the Drive file/folder IDs in Supabase;
6. marks the artifact `synced`.

If Drive is unavailable or not configured, finalization still succeeds. The immutable PDF remains in the private Supabase vault and the artifact is marked `not_configured` or `failed` for later retry.

## Security

- Never store Google OAuth secrets in Vite/browser environment variables.
- Never commit a refresh token to GitHub.
- Never make client Drive folders public to support portal access.
- Portal authorization remains controlled by Supabase Auth/RLS.
- Executed PDFs are generated from the immutable document version plus signature/audit records.
