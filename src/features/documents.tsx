import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { label } from "../shared/workspace";
import type {
  DocumentRow,
  ExecutedArtifact,
  SignatureRequest,
  Client,
} from "../shared/workspace";
import {
  PageTitle,
  LoadState,
  StatusPill,
  Empty,
} from "../components/WorkspaceLayout";

export function DocumentsPage() {
  const [rows, setRows] = useState<DocumentRow[]>([]),
    [artifacts, setArtifacts] = useState<ExecutedArtifact[]>([]),
    [requests, setRequests] = useState<SignatureRequest[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [integration, setIntegration] = useState<any>(null),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [downloadUrl, setDownloadUrl] = useState(""),
    [originalDownloadUrl, setOriginalDownloadUrl] = useState(""),
    [clientId, setClientId] = useState(""),
    [clientSecret, setClientSecret] = useState(""),
    [query, setQuery] = useState(""),
    [docFilter, setDocFilter] = useState(
      () => new URLSearchParams(location.search).get("view") || "all",
    ),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [d, a, r, c, g] = await Promise.all([
        supabase
          .from("client_documents")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("executed_document_artifacts")
          .select("*")
          .order("generated_at", { ascending: false }),
        supabase
          .from("signature_requests")
          .select("*")
          .eq("signer_side", "client")
          .order("requested_at", { ascending: false }),
        supabase.from("clients").select("*"),
        supabase
          .from("app_integrations")
          .select("*")
          .eq("provider", "google_drive")
          .maybeSingle(),
      ]);
      if (d.error || a.error || r.error || c.error || g.error)
        throw new Error();
      setRows((d.data || []) as DocumentRow[]);
      setArtifacts((a.data || []) as ExecutedArtifact[]);
      setRequests((r.data || []) as SignatureRequest[]);
      setClients((c.data || []) as Client[]);
      setIntegration(g.data || null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const p = new URLSearchParams(location.search);
    if (p.get("drive") === "connected") {
      setMessage(
        "Google Drive connected. Executed documents can now archive automatically.",
      );
      history.replaceState({}, "", location.pathname);
    } else if (p.get("drive") === "error") {
      setMessage(
        "Google Drive connection failed: " +
          label(p.get("reason") || "unknown error"),
      );
      history.replaceState({}, "", location.pathname);
    }
  }, []);
  async function saveGoogleCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy("google-config");
    setMessage("");
    const { error } = await supabase.rpc("configure_google_drive_oauth", {
      p_client_id: clientId.trim(),
      p_client_secret: clientSecret.trim(),
    });
    setBusy("");
    setClientSecret("");
    if (error) setMessage(error.message);
    else {
      setMessage(
        "OAuth credentials stored securely. Now connect the SRCcvde Drive account.",
      );
      load();
    }
  }
  async function connectGoogle() {
    setBusy("google-connect");
    setMessage("");
    const { data, error } = await supabase.rpc("begin_google_drive_oauth");
    setBusy("");
    const c = data?.[0];
    if (error || !c?.client_id || !c?.state) {
      setMessage(error?.message || "Could not start Google authorization.");
      return;
    }
    const p = new URLSearchParams({
      client_id: c.client_id,
      redirect_uri: c.redirect_uri,
      response_type: "code",
      scope: c.scope,
      access_type: "offline",
      prompt: "consent",
      state: c.state,
      trigger_onepick: "true",
      allow_folder_selection: "true",
      file_ids: "1j23qs5KZowr6BuVbbRnQdQvGN6mHhsG2",
    });
    window.location.assign(
      "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString(),
    );
  }
  async function archive(documentId: string) {
    setBusy(documentId);
    setMessage("");
    setDownloadUrl("");
    setOriginalDownloadUrl("");
    const { data, error } = await supabase.functions.invoke(
      "finalize-executed-document",
      { body: { document_id: documentId } },
    );
    setBusy("");
    if (error) {
      let detail = error.message;
      try {
        const response = (error as any).context as Response | undefined;
        if (response) {
          const body = await response.clone().json();
          detail = body?.detail || body?.error || detail;
        }
      } catch {}
      setMessage(detail);
    } else {
      setDownloadUrl(data?.download_url || "");
      setOriginalDownloadUrl(data?.original_download_url || "");
      setMessage(
        data?.drive?.status === "synced"
          ? "Executed PDF is safely archived in Google Drive."
          : data?.artifact?.drive_sync_status === "synced"
            ? "Executed PDF is safely archived in Google Drive."
            : "Executed PDF is in the secure vault. Google Drive sync needs attention.",
      );
      load();
    }
  }
  async function countersign(documentId: string) {
    const legalName = prompt(
      "Type your legal name to countersign this exact document version.",
    );
    if (!legalName) return;
    setBusy(documentId);
    setMessage("Countersigning and finalizing…");
    setDownloadUrl("");
    setOriginalDownloadUrl("");
    const { error } = await supabase.rpc("countersign_document", {
      p_document_id: documentId,
      p_legal_name: legalName.trim(),
    });
    if (error) {
      setBusy("");
      setMessage(error.message);
      return;
    }
    const { data, error: finalError } = await supabase.functions.invoke(
      "finalize-executed-document",
      { body: { document_id: documentId } },
    );
    setBusy("");
    if (finalError) {
      let detail = finalError.message;
      try {
        const response = (finalError as any).context as Response | undefined;
        if (response) {
          const body = await response.clone().json();
          detail = body?.detail || body?.error || detail;
        }
      } catch {}
      setMessage(
        "Countersigned. The PDF archive still needs attention: " + detail,
      );
    } else {
      setDownloadUrl(data?.download_url || "");
      setOriginalDownloadUrl(data?.original_download_url || "");
      setMessage(
        data?.drive?.status === "synced"
          ? "Countersigned, fully executed, and archived to Google Drive."
          : data?.drive?.status === "failed"
            ? "Countersigned and fully executed. The secure PDF is stored in SRCcvde; reconnect Google Drive to restore the Drive copy."
            : "Countersigned and fully executed. The secure PDF was generated; Google Drive is not connected yet.",
      );
    }
    await supabase.functions.invoke("dispatch-notifications");
    load();
  }
  const artifactFor = (id: string) =>
    artifacts.find((a) => a.document_id === id);
  const requestFor = (id: string) =>
    requests.find((r) => r.document_id === id && r.signer_side === "client");
  const openReview = (requestId: string) => {
    history.pushState({}, "", "/documents/" + requestId);
    dispatchEvent(new PopStateEvent("popstate"));
  };
  const filteredRows = rows.filter((d) => {
    const a = artifactFor(d.id);
    const client = clients.find((c) => c.id === d.client_id);
    const matchesQuery =
      !query.trim() ||
      [
        d.name,
        d.category,
        d.state,
        client?.name,
        client?.primary_contact_name,
        client?.primary_email,
      ].some((v) =>
        (v || "").toLowerCase().includes(query.trim().toLowerCase()),
      );
    const matchesFilter =
      docFilter === "all" ||
      (docFilter === "pending" && d.state !== "final") ||
      (docFilter === "final" && d.state === "final") ||
      (docFilter === "archived" && !!a) ||
      (docFilter === "attention" && !!a && a.drive_sync_status === "failed");
    return matchesQuery && matchesFilter;
  });
  return (
    <>
      <PageTitle
        eyebrow="Vault"
        title="Documents"
        copy="Immutable executed PDFs, signature certificates and the Google Drive archive index."
      />
      {message && (
        <p className="success-message">
          {message}
          {originalDownloadUrl && (
            <>
              {" "}
              ·{" "}
              <a href={originalDownloadUrl} target="_blank" rel="noreferrer">
                Original
              </a>
            </>
          )}
          {downloadUrl && (
            <>
              {" "}
              ·{" "}
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                Executed
              </a>
            </>
          )}
        </p>
      )}
      <section className="panel drive-connect">
        <div className="section-head">
          <div>
            <p className="eyebrow">Archive integration</p>
            <h2>Google Drive</h2>
          </div>
          <span
            className={
              "sync-state " +
              (integration?.status === "connected" ? "synced" : "")
            }
          >
            {integration?.status === "connected"
              ? "Connected"
              : integration?.status === "configured"
                ? "Ready to connect"
                : "Not connected"}
          </span>
        </div>
        {integration?.status === "connected" ? (
          <div className="connected-drive">
            <div>
              <b>{integration.root_folder_name || "03 — Clients"}</b>
              <small>
                Executed PDFs archive automatically into each client's folder.
              </small>
            </div>
            <button
              className="ghost"
              onClick={connectGoogle}
              disabled={busy === "google-connect"}
            >
              Reconnect
            </button>
          </div>
        ) : integration?.status === "configured" ? (
          <>
            <p className="muted">
              Credentials are encrypted in Supabase Vault. Authorize SRCcvde to
              the client archive folder to finish.
            </p>
            <button
              className="primary inline"
              onClick={connectGoogle}
              disabled={busy === "google-connect"}
            >
              {busy === "google-connect"
                ? "Opening Google…"
                : "Connect SRCcvde Drive"}
            </button>
          </>
        ) : (
          <form
            className="google-credential-form"
            onSubmit={saveGoogleCredentials}
          >
            <p className="muted">
              Paste the OAuth credential here instead of chat. The client secret
              is sent directly to Supabase over HTTPS and stored encrypted in
              Vault; it is never committed to GitHub.
            </p>
            <label>
              Google OAuth Client ID
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
                required
                placeholder="…apps.googleusercontent.com"
              />
            </label>
            <label>
              Google OAuth Client Secret
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
                required
                placeholder="GOCSPX-…"
              />
            </label>
            <button
              className="primary inline"
              disabled={busy === "google-config"}
            >
              {busy === "google-config" ? "Securing…" : "Save securely"}
            </button>
          </form>
        )}
      </section>
      <section className="panel document-index">
        <div className="directory-tools">
          <label>
            Search documents
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Document, client, category, or state…"
            />
          </label>
          <label>
            View
            <select
              value={docFilter}
              onChange={(e) => {
                const v = e.target.value;
                setDocFilter(v);
                const u = new URL(location.href);
                if (v === "all") u.searchParams.delete("view");
                else u.searchParams.set("view", v);
                history.replaceState({}, "", u.pathname + u.search);
              }}
            >
              <option value="all">All documents</option>
              <option value="pending">Needs action</option>
              <option value="final">Final</option>
              <option value="archived">Archived</option>
              <option value="attention">Archive attention</option>
            </select>
          </label>
          <span className="directory-count">
            {loading ? "Loading…" : `${filteredRows.length} of ${rows.length}`}
          </span>
        </div>
        <LoadState
          loading={loading}
          error={loadError ? "Could not load documents. Try again." : null}
          onRetry={load}
          loadingText="Loading documents…"
        />
        {!loading &&
          !loadError &&
          filteredRows.map((d) => {
            const a = artifactFor(d.id);
            const client = clients.find((c) => c.id === d.client_id);
            const req = requestFor(d.id);
            const awaitingCountersign =
              d.signature_kind === "signature" &&
              d.state === "signed" &&
              req?.status === "signed";
            return (
              <div className="doc-row vault-row" key={d.id}>
                <div>
                  <b>{d.name}</b>
                  <small>
                    {client?.name ? client.name + " · " : ""}
                    {label(d.category)} ·{" "}
                    {a
                      ? "Executed"
                      : awaitingCountersign
                        ? "Client signed · awaiting SRCcvde"
                        : label(d.state)}
                  </small>
                </div>
                <div className="vault-actions">
                  {a && (
                    <span className={"sync-state " + a.drive_sync_status}>
                      {a.drive_sync_status === "synced" &&
                      a.drive_original_file_id
                        ? "Original + executed archived"
                        : a.drive_sync_status === "synced"
                          ? "Executed archived"
                          : a.drive_sync_status === "failed"
                            ? "Drive retry needed"
                            : "Secure vault"}
                    </span>
                  )}
                  {d.state === "final" ? (
                    <button
                      className="ghost"
                      disabled={busy === d.id}
                      onClick={() => archive(d.id)}
                    >
                      {busy === d.id
                        ? "Preparing…"
                        : a
                          ? "Open document archive"
                          : "Generate document archive"}
                    </button>
                  ) : awaitingCountersign ? (
                    <>
                      <button
                        className="ghost"
                        onClick={() => openReview(req!.id)}
                      >
                        Review signed document
                      </button>
                      <button
                        className="primary inline"
                        disabled={busy === d.id}
                        onClick={() => countersign(d.id)}
                      >
                        {busy === d.id
                          ? "Finalizing…"
                          : "Countersign & archive"}
                      </button>
                    </>
                  ) : req ? (
                    <button
                      className="ghost"
                      onClick={() => openReview(req.id)}
                    >
                      Review document
                    </button>
                  ) : (
                    <StatusPill value={d.state} />
                  )}
                </div>
              </div>
            );
          })}
        {!loading &&
          !loadError &&
          (!rows.length ? (
            <Empty>No documents indexed yet.</Empty>
          ) : (
            !filteredRows.length && <Empty>No documents match this view.</Empty>
          ))}
      </section>
    </>
  );
}
