import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { money, date } from "../shared/workspace";
import type { BillingInvoice, Client, Project } from "../shared/workspace";
import { LoadState, StatusPill, Empty } from "../components/WorkspaceLayout";

export function AdminBillingPage() {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [clientId, setClientId] = useState(""),
    [projectId, setProjectId] = useState(""),
    [items, setItems] = useState([
      { description: "", quantity: "1", amount: "" },
    ]),
    [due, setDue] = useState(""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [paymentInvoice, setPaymentInvoice] = useState<BillingInvoice | null>(null),
    [payAmount, setPayAmount] = useState(""),
    [payMethod, setPayMethod] = useState("Zelle for Business"),
    [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10)),
    [payReference, setPayReference] = useState(""),
    [payNote, setPayNote] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [i, c, p] = await Promise.all([
        supabase
          .from("billing_invoices")
          .select("*,clients(name),projects(name)")
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("*").order("name"),
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (i.error || c.error || p.error) throw new Error();
      setInvoices((i.data || []) as unknown as BillingInvoice[]);
      setClients((c.data || []) as Client[]);
      setProjects((p.data || []) as Project[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const draftTotal = items.reduce(
    (n, x) => n + (Number(x.quantity) || 0) * (Number(x.amount) || 0),
    0,
  );
  const setItem = (
    index: number,
    key: "description" | "quantity" | "amount",
    value: string,
  ) =>
    setItems((v) =>
      v.map((x, i) => (i === index ? { ...x, [key]: value } : x)),
    );
  async function createInvoice(e: FormEvent) {
    e.preventDefault();
    const payload = items.map((x) => ({
      description: x.description.trim(),
      quantity: Number(x.quantity),
      unit_amount_cents: Math.round(Number(x.amount) * 100),
    }));
    if (
      !clientId ||
      payload.some(
        (x) =>
          !x.description ||
          !Number.isFinite(x.quantity) ||
          x.quantity <= 0 ||
          !Number.isFinite(x.unit_amount_cents) ||
          x.unit_amount_cents < 0,
      ) ||
      draftTotal <= 0
    )
      return setMessage("Choose a client and complete each line item.");
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("create_billing_invoice_v2", {
      p_client_id: clientId,
      p_project_id: projectId || null,
      p_items: payload,
      p_due_at: due ? new Date(due + "T23:59:59").toISOString() : null,
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setItems([{ description: "", quantity: "1", amount: "" }]);
      setDue("");
      setNotes("");
      setMessage("Draft invoice created and ready to review.");
      load();
    }
  }
  async function sendInvoice(inv: BillingInvoice) {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "send-invoice-email",
      { body: { invoice_id: inv.id } },
    );
    if (!error) {
      const { data: members } = await supabase
        .from("client_memberships")
        .select("user_id")
        .eq("client_id", inv.client_id);
      await Promise.all(
        (members || []).map((m) =>
          supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: m.user_id,
              category: "billing",
              title: "New invoice from SRCcvde",
              body:
                inv.invoice_number +
                " · " +
                money(inv.total_cents, inv.currency),
              url: "/billing",
              tag: "invoice-" + inv.id,
            },
          }),
        ),
      );
    }
    setBusy(false);
    setMessage(
      error
        ? error.message || "Invoice could not be sent."
        : data?.sent
          ? "Invoice emailed, archived and shared with the client."
          : "Invoice could not be sent.",
    );
    if (!error) load();
  }
  async function openInvoicePdf(inv: BillingInvoice) {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "invoice-pdf-download",
      { body: { invoice_id: inv.id } },
    );
    setBusy(false);
    if (error || !data?.url) {
      setMessage(
        error?.message ||
          "Invoice PDF is not available yet. Send the invoice first to finalize it.",
      );
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  function beginPayment(inv: BillingInvoice) {
    const remaining = Math.max(
      0,
      inv.total_cents - (inv.amount_paid_cents || 0),
    );
    setPaymentInvoice(inv);
    setPayAmount((remaining / 100).toFixed(2));
    setPayMethod("Zelle for Business");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayReference("");
    setPayNote("");
  }
  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!paymentInvoice) return;
    const cents = Math.round(Number(payAmount) * 100),
      remaining =
        paymentInvoice.total_cents - (paymentInvoice.amount_paid_cents || 0);
    if (!Number.isFinite(cents) || cents <= 0 || cents > remaining)
      return setMessage(
        "Enter a payment no greater than the remaining balance.",
      );
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "record-invoice-payment",
      {
        body: {
          invoice_id: paymentInvoice.id,
          amount_cents: cents,
          method_label: payMethod,
          paid_at: new Date(payDate + "T12:00:00").toISOString(),
          reference: payReference.trim() || null,
          note: payNote.trim() || null,
        },
      },
    );
    setBusy(false);
    if (error) {
      setMessage(error.message || "Payment could not be recorded.");
      return;
    }
    setPaymentInvoice(null);
    setMessage(
      data?.paid_in_full
        ? "Payment recorded. Invoice is paid in full and the client receipt was issued."
        : "Partial payment recorded and the client balance was updated.",
    );
    load();
  }
  async function voidInvoice(inv: BillingInvoice) {
    if (!confirm("Void " + inv.invoice_number + "?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("billing_invoices")
      .update({ status: "void", client_visible: false })
      .eq("id", inv.id);
    setBusy(false);
    setMessage(error ? error.message : "Invoice voided.");
    if (!error) load();
  }
  const clientProjects = projects.filter((p) => p.client_id === clientId),
    selectedClient = clients.find((x) => x.id === clientId),
    selectedProject = projects.find((x) => x.id === projectId);
  return (
    <div className="billing-page admin-billing-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Billing & payments</p>
          <h1>Invoices</h1>
        </div>
        <span className="live-dot">Financial workspace</span>
      </header>
      {message && <p className="success-message">{message}</p>}
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Invoice builder</p>
            <h2>Create & preview</h2>
            <p className="section-copy">
              Build a professional invoice with multiple line items. Sending
              finalizes the archived PDF.
            </p>
          </div>
          <strong>{money(Math.round(draftTotal * 100))}</strong>
        </div>
        <form className="document-form" onSubmit={createInvoice}>
          <div className="form-split">
            <label>
              Client
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProjectId("");
                }}
                required
              >
                <option value="">Select client</option>
                {clients.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Project
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">No specific project</option>
                {clientProjects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="invoice-builder-items">
            {items.map((item, index) => (
              <div className="invoice-builder-row" key={index}>
                <label>
                  Description
                  <input
                    value={item.description}
                    onChange={(e) =>
                      setItem(index, "description", e.target.value)
                    }
                    placeholder="Website development milestone"
                    required
                  />
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => setItem(index, "quantity", e.target.value)}
                    required
                  />
                </label>
                <label>
                  Unit price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.amount}
                    onChange={(e) => setItem(index, "amount", e.target.value)}
                    placeholder="1500.00"
                    required
                  />
                </label>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      setItems((v) => v.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setItems((v) => [
                ...v,
                { description: "", quantity: "1", amount: "" },
              ])
            }
          >
            + Add line item
          </button>
          <div className="form-split">
            <label>
              Due date
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <label>
              Client notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms or invoice notes"
              />
            </label>
          </div>
          <div className="invoice-preview">
            <div>
              <p className="eyebrow">Live preview</p>
              <h2>{selectedClient?.name || "Client invoice"}</h2>
              <small>
                {selectedProject?.name || "SRCcvde project"} ·{" "}
                {due
                  ? "Due " + date(new Date(due + "T12:00:00").toISOString())
                  : "Due upon receipt"}
              </small>
            </div>
            <div className="invoice-preview-lines">
              {items
                .filter((x) => x.description || x.amount)
                .map((x, i) => (
                  <div key={i}>
                    <span>
                      {x.description || "Line item"} × {x.quantity || "0"}
                    </span>
                    <b>
                      {money(
                        Math.round(
                          (Number(x.quantity) || 0) *
                            (Number(x.amount) || 0) *
                            100,
                        ),
                      )}
                    </b>
                  </div>
                ))}
            </div>
            <div className="invoice-preview-total">
              <span>Total</span>
              <strong>{money(Math.round(draftTotal * 100))}</strong>
            </div>
          </div>
          <button className="primary" disabled={busy}>
            {busy ? "Working…" : "Create draft invoice"}
          </button>
        </form>
      </section>
      {paymentInvoice && (
        <section className="panel billing-payment-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Record payment</p>
              <h2>{paymentInvoice.invoice_number}</h2>
              <p className="section-copy">
                {money(
                  Math.max(
                    0,
                    paymentInvoice.total_cents -
                      (paymentInvoice.amount_paid_cents || 0),
                  ),
                )}{" "}
                currently owed.
              </p>
            </div>
            <button className="ghost" onClick={() => setPaymentInvoice(null)}>
              Cancel
            </button>
          </div>
          <form className="document-form" onSubmit={recordPayment}>
            <div className="form-split">
              <label>
                Amount received
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={(
                    Math.max(
                      0,
                      paymentInvoice.total_cents -
                        (paymentInvoice.amount_paid_cents || 0),
                    ) / 100
                  ).toFixed(2)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </label>
              <label>
                Payment date
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="form-split">
              <label>
                Method
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option>Zelle for Business</option>
                  <option>Cash</option>
                  <option>Check</option>
                  <option>Bank transfer</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Reference / confirmation
                <input
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="Optional transaction reference"
                />
              </label>
            </div>
            <label>
              Internal note
              <textarea
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Optional payment note"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Recording…" : "Record payment & issue receipt"}
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2>Invoice history</h2>
          </div>
          <span className="status">{invoices.length}</span>
        </div>
        <div className="communication-history">
          <LoadState
            loading={loading}
            error={loadError ? "Could not load invoices. Try again." : null}
            onRetry={load}
            loadingText="Loading invoices…"
          />
          {!loading &&
            !loadError &&
            invoices.map((inv) => {
              const remaining = Math.max(
                  0,
                  inv.total_cents - (inv.amount_paid_cents || 0),
                ),
                displayStatus =
                  inv.status === "void"
                    ? "void"
                    : remaining === 0
                      ? "paid"
                      : inv.amount_paid_cents > 0
                        ? "partial_paid"
                        : inv.status === "sent" &&
                            inv.due_at &&
                            new Date(inv.due_at) < new Date()
                          ? "overdue"
                          : inv.status;
              return (
                <article className="communication-row" key={inv.id}>
                  <div className="communication-meta">
                    <span className="communication-channel">
                      {inv.invoice_number}
                    </span>
                    <small>
                      {inv.clients?.name || "Client"}
                      {inv.projects?.name
                        ? " · " + inv.projects.name
                        : ""} · {date(inv.created_at)}
                    </small>
                  </div>
                  <div>
                    <b>{money(inv.total_cents, inv.currency)}</b>
                    <p>
                      Paid {money(inv.amount_paid_cents || 0, inv.currency)} ·
                      Owed {money(remaining, inv.currency)}
                    </p>
                    <small>
                      {inv.due_at ? "Due " + date(inv.due_at) : "No due date"} ·{" "}
                      <StatusPill value={displayStatus} />
                    </small>
                  </div>
                  <div className="detail-actions">
                    {inv.status === "draft" && (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => sendInvoice(inv)}
                      >
                        Send
                      </button>
                    )}
                    {inv.artifact_path && (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => openInvoicePdf(inv)}
                      >
                        PDF
                      </button>
                    )}
                    {!["draft", "paid", "void"].includes(inv.status) &&
                      remaining > 0 && (
                        <button
                          className="ghost"
                          disabled={busy}
                          onClick={() => beginPayment(inv)}
                        >
                          Record payment
                        </button>
                      )}
                    {!["void", "paid"].includes(inv.status) && (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => voidInvoice(inv)}
                      >
                        Void
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          {!loading && !loadError && !invoices.length && (
            <Empty>No invoices yet.</Empty>
          )}
        </div>
      </section>
    </div>
  );
}

export const PAYPAL_SANDBOX_CLIENT_ID =
  "ARtSWJTQJ-r9RUNall75_EWLq0pM7oIi6UKPvtTUgH681RW473sRndRlobqxpQtDt9GXXQJc2PzX1lvs";

export function loadPayPalSandbox() {
  if ((window as any).paypal) return Promise.resolve((window as any).paypal);
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      "script[data-srccvde-paypal]",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).paypal), {
        once: true,
      });
      existing.addEventListener(
        "error",
        () => reject(new Error("PayPal could not load")),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = "https://www.sandbox.paypal.com/web-sdk/v6/core";
    s.async = true;
    s.dataset.srccvdePaypal = "1";
    s.onload = () => resolve((window as any).paypal);
    s.onerror = () => reject(new Error("PayPal could not load"));
    document.head.appendChild(s);
  });
  return paypalSdkPromise;
}

export function PayPalInvoiceButton({
  invoice,
  onPaid,
}: {
  invoice: BillingInvoice;
  onPaid: () => void;
}) {
  const host = useRef<HTMLDivElement | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      button: any = null;
    const setup = async () => {
      try {
        const paypal = await loadPayPalSandbox();
        if (!alive || !host.current) return;
        const sdk = await paypal.createInstance({
            clientId: PAYPAL_SANDBOX_CLIENT_ID,
            components: ["paypal-payments"],
            pageType: "checkout",
          }),
          eligibility = await sdk.findEligibleMethods({
            currencyCode: invoice.currency || "USD",
          });
        if (!alive || !eligibility.isEligible("paypal")) {
          setError("PayPal is unavailable for this payment.");
          return;
        }
        const session = sdk.createPayPalOneTimePaymentSession({
          onApprove: async (data: any) => {
            const { data: result, error: e } = await supabase.functions.invoke(
              "paypal-checkout",
              { body: { action: "capture", order_id: data.orderId } },
            );
            if (e || !result?.completed)
              throw new Error(
                e?.message || result?.error || "PayPal capture failed",
              );
            onPaid();
          },
          onCancel: () => setError("PayPal checkout was cancelled."),
          onError: (e: any) =>
            setError(e?.message || "PayPal checkout could not be completed."),
        });
        button = document.createElement("paypal-button");
        button.setAttribute("type", "pay");
        button.addEventListener("click", async () => {
          setError("");
          try {
            const orderPromise = supabase.functions
              .invoke("paypal-checkout", {
                body: { action: "create", invoice_id: invoice.id },
              })
              .then(({ data, error: e }) => {
                if (e || !data?.orderId)
                  throw new Error(
                    e?.message ||
                      data?.error ||
                      "Could not start PayPal checkout",
                  );
                return { orderId: data.orderId };
              });
            await session.start({ presentationMode: "auto" }, orderPromise);
          } catch (e: any) {
            setError(e?.message || "Could not start PayPal checkout.");
          }
        });
        host.current.replaceChildren(button);
      } catch (e: any) {
        if (alive) setError(e?.message || "PayPal could not initialize.");
      }
    };
    setup();
    return () => {
      alive = false;
      if (button) button.remove();
    };
  }, [invoice.id, invoice.currency]);
  return (
    <div className="paypal-checkout">
      <div ref={host} />
      {error && <small>{error}</small>}
      <em>Sandbox</em>
    </div>
  );
}

export function ClientBillingPage() {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]),
    [payments, setPayments] = useState<any[]>([]),
    [methods, setMethods] = useState<any[]>([]),
    [refreshKey, setRefreshKey] = useState(0),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false),
    [downloadError, setDownloadError] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const { data: members, error: membershipError } = await supabase
          .from("client_memberships")
          .select("client_id")
          .limit(1);
        const cid = members?.[0]?.client_id;
        if (membershipError || !cid)
          throw new Error("Billing workspace unavailable");
        const [i, p, m] = await Promise.all([
          supabase
            .from("billing_invoices")
            .select("*,projects(name)")
            .eq("client_id", cid)
            .eq("client_visible", true)
            .order("created_at", { ascending: false }),
          supabase
            .from("billing_payments")
            .select("*")
            .eq("client_id", cid)
            .order("created_at", { ascending: false }),
          supabase
            .from("billing_payment_methods")
            .select("*")
            .eq("active", true)
            .order("sort_order"),
        ]);
        if (i.error || p.error || m.error)
          throw new Error("Billing unavailable");
        if (!alive) return;
        setInvoices((i.data || []) as unknown as BillingInvoice[]);
        setPayments(p.data || []);
        setMethods(m.data || []);
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  async function openClientInvoicePdf(inv: BillingInvoice) {
    setDownloadError("");
    const { data, error } = await supabase.functions.invoke(
      "invoice-pdf-download",
      { body: { invoice_id: inv.id } },
    );
    if (error || !data?.url) {
      setDownloadError(
        "Your invoice PDF could not be opened. Please try again.",
      );
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  async function openReceipt(p: any) {
    setDownloadError("");
    const { data, error } = await supabase.functions.invoke(
      "payment-receipt-download",
      { body: { payment_id: p.id } },
    );
    if (error || !data?.url) {
      setDownloadError("Your receipt could not be opened. Please try again.");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  if (loading || loadError)
    return (
      <section className="panel">
        <h1>Invoices & payments</h1>
        <LoadState
          loading={loading}
          error={
            loadError
              ? "Could not load your billing information. Please try again."
              : null
          }
          onRetry={() => setRefreshKey((key) => key + 1)}
          loadingText="Loading your billing information…"
        />
      </section>
    );
  const activeInvoices = invoices.filter((i) => i.status !== "void");
  const visibleInvoiceIds = new Set(invoices.map((i) => i.id));
  const visiblePayments = payments.filter((p) =>
    visibleInvoiceIds.has(p.invoice_id),
  );
  const successfulPayments = visiblePayments.filter(
    (p) => p.status === "succeeded",
  );
  const totalBilled = activeInvoices.reduce((n, i) => n + i.total_cents, 0);
  const totalPaid = activeInvoices.reduce(
    (n, i) => n + Math.min(i.total_cents, i.amount_paid_cents || 0),
    0,
  );
  const outstanding = Math.max(0, totalBilled - totalPaid);
  const paidPercent = totalBilled
    ? Math.min(100, Math.round((totalPaid / totalBilled) * 100))
    : 0;
  const projectGroups = Object.values(
    activeInvoices.reduce(
      (groups, inv) => {
        const key = inv.project_id || "general";
        const current = groups[key] || {
          key,
          name: inv.projects?.name || "General billing",
          billed: 0,
          paid: 0,
          invoices: 0,
        };
        current.billed += inv.total_cents;
        current.paid += Math.min(inv.total_cents, inv.amount_paid_cents || 0);
        current.invoices += 1;
        groups[key] = current;
        return groups;
      },
      {} as Record<
        string,
        {
          key: string;
          name: string;
          billed: number;
          paid: number;
          invoices: number;
        }
      >,
    ),
  );
  return (
    <div className="billing-page">
      {downloadError && <p role="alert">{downloadError}</p>}
      <header className="topbar billing-topbar">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>Invoices & payments</h1>
          <p className="billing-intro">
            A clear view of what has been billed, what you have paid, and every
            receipt in one place.
          </p>
        </div>
        <span className="live-dot">Secure billing</span>
      </header>

      <section
        className={
          "billing-hero " + (outstanding === 0 ? "settled" : "balance-due")
        }
      >
        <div className="billing-hero-copy">
          <p className="eyebrow">
            {outstanding === 0 ? "Account settled" : "Current balance"}
          </p>
          <h2>
            {outstanding === 0
              ? "You're all paid up."
              : money(outstanding) + " remaining"}
          </h2>
          <p>
            {totalBilled
              ? money(totalPaid) + " paid of " + money(totalBilled) + " billed"
              : "No billing activity yet."}
          </p>
        </div>
        <div className="billing-hero-status">
          <span>{paidPercent}%</span>
          <small>paid</small>
        </div>
        <div className="billing-progress">
          <div>
            <span>Payment progress</span>
            <strong>{paidPercent}%</strong>
          </div>
          <div className="progress">
            <i style={{ width: paidPercent + "%" }} />
          </div>
        </div>
      </section>

      <section
        className={
          "billing-overview-grid " +
          (projectGroups.length > 1 ? "has-project-breakdown" : "payment-only")
        }
      >
        {projectGroups.length > 1 && (
          <article className="panel billing-projects">
            <div className="billing-section-head">
              <div>
                <p className="eyebrow">Project balances</p>
                <h2>By project</h2>
              </div>
              <span>
                {projectGroups.length} project
                {projectGroups.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="project-balance-list">
              {projectGroups.map((g) => {
                const remaining = Math.max(0, g.billed - g.paid),
                  pct = g.billed
                    ? Math.min(100, Math.round((g.paid / g.billed) * 100))
                    : 0;
                return (
                  <div className="project-balance-card" key={g.key}>
                    <div className="project-balance-head">
                      <div>
                        <b>{g.name}</b>
                        <small>
                          {g.invoices} invoice{g.invoices === 1 ? "" : "s"} ·{" "}
                          {money(g.billed)} billed
                        </small>
                      </div>
                      <div>
                        <strong>{money(remaining)}</strong>
                        <small>
                          {remaining === 0 ? "paid in full" : "remaining"}
                        </small>
                      </div>
                    </div>
                    <div className="project-balance-progress">
                      <div className="progress">
                        <i style={{ width: pct + "%" }} />
                      </div>
                      <small>
                        {money(g.paid)} paid · {pct}%
                      </small>
                    </div>
                  </div>
                );
              })}
              {!projectGroups.length && <Empty>No project billing yet.</Empty>}
            </div>
          </article>
        )}
        <article className="panel billing-pay-options">
          <div className="billing-section-head">
            <div>
              <p className="eyebrow">Ways to pay</p>
              <h2>Payment options</h2>
            </div>
          </div>
          <div className="pay-option paypal-option">
            <div className="pay-option-icon">P</div>
            <div>
              <b>PayPal</b>
              <p>
                Secure online checkout is available directly on any eligible
                open invoice below.
              </p>
            </div>
          </div>
          {methods.map((m) => (
            <div className="pay-option" key={m.id}>
              <div className="pay-option-icon">↗</div>
              <div>
                <b>{m.label}</b>
                <strong>{m.payment_handle}</strong>
                {m.instructions && <p>{m.instructions}</p>}
              </div>
            </div>
          ))}
          <p className="pay-option-note">
            Payments are matched to your SRCcvde invoice and reflected here
            after they are recorded.
          </p>
        </article>
      </section>

      <section className="panel billing-history-panel">
        <div className="billing-section-head">
          <div>
            <p className="eyebrow">Invoices</p>
            <h2>Billing history</h2>
            <p>
              Open balances, due dates, PDFs, and payment options stay attached
              to the invoice they belong to.
            </p>
          </div>
          <span>{invoices.length} total</span>
        </div>
        <div className="invoice-list">
          {invoices.map((inv) => {
            const remaining = Math.max(
              0,
              inv.total_cents - (inv.amount_paid_cents || 0),
            );
            const displayStatus =
              inv.status === "void"
                ? "void"
                : remaining === 0
                  ? "paid"
                  : inv.amount_paid_cents > 0
                    ? "partial_paid"
                    : inv.status === "sent" &&
                        inv.due_at &&
                        new Date(inv.due_at) < new Date()
                      ? "overdue"
                      : inv.status;
            return (
              <article className="invoice-card" key={inv.id}>
                <div className="invoice-main">
                  <div className="invoice-title-line">
                    <div>
                      <small>Invoice</small>
                      <b>{inv.invoice_number}</b>
                    </div>
                    <StatusPill value={displayStatus} />
                  </div>
                  <p>
                    {inv.projects?.name || "SRCcvde project"} <span>·</span>{" "}
                    Issued{" "}
                    {inv.issued_at ? date(inv.issued_at) : date(inv.created_at)}
                  </p>
                </div>
                <div className="invoice-amount">
                  <small>Total</small>
                  <strong>{money(inv.total_cents, inv.currency)}</strong>
                </div>
                <div className="invoice-balance">
                  <span>
                    <small>Paid</small>
                    <b>{money(inv.amount_paid_cents || 0, inv.currency)}</b>
                  </span>
                  <span>
                    <small>Remaining</small>
                    <b>{money(remaining, inv.currency)}</b>
                  </span>
                  <small className="invoice-due">
                    {inv.due_at ? "Due " + date(inv.due_at) : "No due date"}
                  </small>
                </div>
                <div className="invoice-card-actions">
                  {inv.artifact_path && (
                    <button
                      className="ghost"
                      onClick={() => openClientInvoicePdf(inv)}
                    >
                      Invoice PDF
                    </button>
                  )}
                  {remaining > 0 &&
                    ["sent", "overdue"].includes(inv.status) && (
                      <PayPalInvoiceButton
                        invoice={inv}
                        onPaid={() => setRefreshKey((x) => x + 1)}
                      />
                    )}
                </div>
              </article>
            );
          })}
          {!invoices.length && <Empty>No invoices have been shared yet.</Empty>}
        </div>
      </section>

      <section className="panel billing-payments-panel">
        <div className="billing-section-head">
          <div>
            <p className="eyebrow">Payments</p>
            <h2>Payment history</h2>
            <p>Your confirmed payments and downloadable receipts.</p>
          </div>
          <span>{successfulPayments.length} received</span>
        </div>
        <div className="payment-list">
          {visiblePayments.map((p) => (
            <article className="payment-card" key={p.id}>
              <div className="payment-mark">✓</div>
              <div className="payment-copy">
                <b>{p.method_label || "Payment"}</b>
                <small>
                  {p.paid_at ? date(p.paid_at) : date(p.created_at)}
                  {p.reference ? " · Ref " + p.reference : ""}
                </small>
              </div>
              <strong>{money(p.amount_cents, p.currency)}</strong>
              <div className="payment-actions">
                <StatusPill value={p.status} />
                {p.artifact_path && (
                  <button className="ghost" onClick={() => openReceipt(p)}>
                    Receipt PDF
                  </button>
                )}
              </div>
            </article>
          ))}
          {!visiblePayments.length && <Empty>No payments recorded yet.</Empty>}
        </div>
      </section>
    </div>
  );
}

let paypalSdkPromise: Promise<any> | null = null;
