import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Brand } from "../components/WorkspaceLayout";

export function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setMessage(error.message);
  }
  async function reset() {
    if (!email) {
      setMessage("Enter your email first.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://app.srccvde.com/set-password",
    });
    setBusy(false);
    setMessage(error ? error.message : "Password reset email sent.");
  }
  return (
    <main className="auth-page">
      <section className="auth-copy">
        <Brand />
        <div className="auth-story">
          <p className="eyebrow">SRCcvde Workspace</p>
          <h1>Your project has a home.</h1>
          <p>
            One secure place for progress, documents, approvals, and everything
            we build together.
          </p>
          <div className="auth-points">
            <div className="auth-point">
              <b>01</b>
              <span>Project progress</span>
            </div>
            <div className="auth-point">
              <b>02</b>
              <span>Shared decisions</span>
            </div>
            <div className="auth-point">
              <b>03</b>
              <span>One clear journey</span>
            </div>
          </div>
        </div>
        <p className="auth-signature">
          A thoughtful workspace for the work we create together.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <header className="auth-card-head">
            <p className="eyebrow">Private access</p>
            <h2>Welcome back.</h2>
            <p>Sign in to pick up where your project left off.</p>
          </header>
          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="auth-email">
              Email address
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <div className="auth-password-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="auth-form-meta">
              <button
                className="text-button"
                type="button"
                onClick={reset}
                disabled={busy}
              >
                Forgot password?
              </button>
            </div>
            <button className="primary auth-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            {message && (
              <p
                id="auth-message"
                className="form-message"
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            )}
            <p className="fine">
              Accounts are created by SRCcvde. Access is provided when your
              project workspace is ready.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

export function SetPassword() {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 12) {
      setMessage("Use at least 12 characters.");
      return;
    }
    if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setMessage("Use uppercase, lowercase, a number, and a symbol.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    history.replaceState({}, "", "/");
    location.reload();
  }
  return (
    <main className="auth-page">
      <section className="auth-copy">
        <Brand />
        <p className="eyebrow">SRCcvde Workspace</p>
        <h1>Make this workspace yours.</h1>
        <p>
          Create the password you'll use whenever you return to app.srccvde.com.
        </p>
      </section>
      <section className="auth-panel">
        <form onSubmit={submit}>
          <p className="eyebrow">Account setup</p>
          <h2>Set your password.</h2>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={12}
            />
          </label>
          <p className="fine">
            Use 12+ characters with uppercase, lowercase, a number, and a
            symbol.
          </p>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save password & continue"}
          </button>
          {message && (
            <p className="form-message" role="status" aria-live="polite">
              {message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

export function PendingAccess({ email }: { email?: string }) {
  return (
    <main className="pending">
      <Brand />
      <p className="eyebrow">Workspace access</p>
      <h1>You're signed in.</h1>
      <p>{email} does not have an active SRCcvde workspace membership yet.</p>
      <button className="primary" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </main>
  );
}
