import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

/** The server also requires aal2: hiding the workspace alone does not protect it. */
export function StaffMfa({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    setVerified(data.currentLevel === "aal2");
    if (data.currentLevel !== "aal2") {
      const { data: factors, error: factorError } =
        await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      setFactor(factors.totp.find((f) => f.status === "verified")?.id || null);
    }
  };
  useEffect(() => {
    refresh()
      .catch(() => setError("Unable to verify MFA. Please sign in again."))
      .finally(() => setLoading(false));
  }, []);
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      // Remove only abandoned, unverified enrollments before retrying setup.
      const { data: factors, error: listError } =
        await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      for (const old of factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: old.id,
        });
        if (error) throw error;
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "SRCcvde staff",
      });
      if (error) throw error;
      setFactor(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch {
      setError("Unable to set up MFA. Please retry or contact an owner.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!factor) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (error) throw error;
      setSecret("");
      setQr("");
      setCode("");
      await refresh();
    } catch {
      setError(
        "That code could not be verified. Use a fresh code and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="loading" role="status">
        Checking account security…
      </main>
    );
  if (verified) return <>{children}</>;
  return (
    <main className="auth-page">
      <section className="auth-copy">
        <h1>Verify your staff account.</h1>
        <p>
          An authenticator code protects client documents, billing, and
          administrative actions.
        </p>
      </section>
      <section className="auth-panel">
        {!factor ? (
          <button className="primary" disabled={busy} onClick={enroll}>
            Set up authenticator
          </button>
        ) : (
          <form onSubmit={verify}>
            {qr && (
              <>
                <p>
                  Scan this code with your authenticator app. Keep the setup key
                  private.
                </p>
                <img
                  src={qr}
                  width="220"
                  height="220"
                  alt="Authenticator setup QR code"
                />
                <p>
                  Manual setup key: <code>{secret}</code>
                </p>
              </>
            )}
            <label>
              Authenticator code
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Verifying…" : "Verify & open workspace"}
            </button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="ghost" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
        <p className="fine">
          Lost your authenticator? Contact another owner through an established
          channel. Access recovery requires identity verification.
        </p>
      </section>
    </main>
  );
}
