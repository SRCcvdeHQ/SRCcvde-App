import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { date } from "../shared/workspace";
import type {
  SignatureRequest,
  DocumentVersion,
  DocumentRow,
} from "../shared/workspace";
import { Brand } from "../components/WorkspaceLayout";

export function SignatureCard({
  request,
  navigate,
}: {
  request: SignatureRequest;
  navigate: (p: string) => void;
}) {
  return (
    <button
      className="signature-card"
      onClick={() => navigate("/documents/" + request.id)}
    >
      <div>
        <span className="signature-icon">✦</span>
        <div>
          <b>
            {request.signature_kind === "signature"
              ? "Signature required"
              : "Acknowledgment required"}
          </b>
          <small>
            {request.signer_name} · requested {date(request.requested_at)}
          </small>
        </div>
      </div>
      <span>Review →</span>
    </button>
  );
}

export function SignDocumentPage({
  requestId,
  navigate,
  staffPreview = false,
}: {
  requestId: string;
  navigate: (p: string) => void;
  staffPreview?: boolean;
}) {
  const [request, setRequest] = useState<SignatureRequest | null>(null),
    [version, setVersion] = useState<DocumentVersion | null>(null),
    [doc, setDoc] = useState<DocumentRow | null>(null),
    [legalName, setLegalName] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    (async () => {
      if (staffPreview) {
        const { data, error } = await supabase.rpc(
          "get_staff_signature_preview",
          { p_request_id: requestId },
        );
        if (error) {
          setMessage(error.message);
          return;
        }
        const preview = data as {
          request: SignatureRequest;
          version: DocumentVersion;
          document: DocumentRow;
        };
        setRequest(preview.request);
        setVersion(preview.version);
        setDoc(preview.document);
        return;
      }
      const { data: r } = await supabase
        .from("signature_requests")
        .select("*")
        .eq("id", requestId)
        .single();
      if (!r) return;
      setRequest(r as SignatureRequest);
      const [v, d] = await Promise.all([
        supabase
          .from("document_versions")
          .select("*")
          .eq("id", r.document_version_id)
          .single(),
        supabase
          .from("client_documents")
          .select("*")
          .eq("id", r.document_id)
          .single(),
      ]);
      setVersion(v.data as DocumentVersion);
      setDoc(d.data as DocumentRow);
      const { error: viewError } = await supabase.rpc("mark_signature_viewed", {
        p_request_id: requestId,
      });
      if (viewError) console.error("Could not record document view", viewError);
    })();
  }, [requestId, staffPreview]);
  async function sign() {
    if (!request) return;
    setBusy(true);
    setMessage("Recording your action…");
    const { error } = await supabase.rpc("sign_document", {
      p_request_id: requestId,
      p_legal_name: legalName,
      p_signature_value: legalName,
      p_consent: consent,
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    const signedAt = new Date().toISOString();
    setRequest({
      ...request,
      status: "signed",
      legal_name: legalName,
      signed_at: signedAt,
    });
    setBusy(false);
    setMessage(
      request.signature_kind === "signature"
        ? "Signed successfully. SRCcvde has been notified."
        : "Acknowledgment recorded. Finalizing your secure document in the background…",
    );
    void (async () => {
      if (request.signature_kind === "acknowledgment") {
        const { error: finalError } = await supabase.functions.invoke(
          "finalize-executed-document",
          { body: { document_id: request.document_id } },
        );
        if (finalError)
          setMessage(
            "Acknowledgment recorded. Your secure PDF archive is still finalizing.",
          );
        else
          setMessage(
            "Acknowledgment recorded. Your secure document is finalized and archived.",
          );
      }
      await supabase.functions.invoke("dispatch-notifications");
    })();
  }
  if (!request || !version || !doc)
    return <p className="muted">Opening secure document…</p>;
  const complete = request.status === "signed";
  return (
    <section className="review-v2">
      <div className="review-v2-top">
        <button className="back" onClick={() => navigate("/")}>
          ← Workspace
        </button>
        <span className="review-v2-badge">
          {staffPreview ? "Staff preview" : "Secure document"}
        </span>
      </div>
      <header className="review-v2-title">
        <p className="eyebrow">
          Secure document · version {version.version_number}
        </p>
        <h1>{doc.name}</h1>
        <p>
          Review the exact immutable document below, then complete the requested
          action.
        </p>
      </header>
      <div className="review-v2-stack">
        <article className="review-v2-document">
          <header className="review-v2-dochead">
            <div className="review-v2-brand">
              <Brand />
              <small>Digital document services</small>
            </div>
            <span
              className={
                complete
                  ? "review-v2-status complete"
                  : "review-v2-status pending"
              }
            >
              {complete ? "Completed" : "Pending review"}
            </span>
          </header>
          <div className="review-v2-version">
            <div>
              <small>Document integrity</small>
              <b>Exact immutable version</b>
            </div>
            <span>Version {version.version_number}</span>
          </div>
          <div className="review-v2-text">{version.content_snapshot}</div>
          <footer>
            <div>
              <span>SHA-256 fingerprint</span>
              <small>
                This identifier verifies the exact document version you
                reviewed.
              </small>
            </div>
            <code>{version.content_sha256}</code>
          </footer>
        </article>
        <section className="review-v2-action">
          <div>
            <p className="eyebrow">
              {request.signature_kind === "signature"
                ? "Electronic signature"
                : "Acknowledgment"}
            </p>
            {complete ? (
              <>
                <h2>Completed.</h2>
                <p className="muted">
                  Recorded as {request.legal_name}
                  {request.signed_at ? " on " + date(request.signed_at) : ""}.
                </p>
              </>
            ) : (
              <>
                <h2>
                  {request.signature_kind === "signature"
                    ? "Sign this document"
                    : "Confirm your review"}
                </h2>
                <p className="review-v2-consent">{request.consent_text}</p>
              </>
            )}
          </div>
          {!complete && !staffPreview && (
            <div className="review-v2-form">
              <label>
                Legal name
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder={request.signer_name}
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>I agree to the electronic signing statement above.</span>
              </label>
              <button
                className="primary"
                disabled={busy || !consent || legalName.trim().length < 2}
                onClick={sign}
              >
                {busy
                  ? "Recording…"
                  : request.signature_kind === "signature"
                    ? "Sign & Accept"
                    : "Reviewed & Acknowledged"}
              </button>
            </div>
          )}
          {staffPreview && (
            <p className="fine">
              Staff preview only. This does not record a signer view and staff
              cannot sign on the client's behalf.
            </p>
          )}
          {message && <p className="success-message">{message}</p>}
          {!staffPreview && (
            <p className="fine">
              Your action is recorded against this exact immutable document
              version and its cryptographic fingerprint.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
