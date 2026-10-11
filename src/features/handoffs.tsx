import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  label,
  date,
  localDateTimeInput,
  addDaysIso,
  daysUntil,
} from "../shared/workspace";
import type {
  Client,
  Handoff,
  HandoffTask,
  Project,
  DocumentRow,
  SignatureRequest,
  TemplateContext,
} from "../shared/workspace";
import { PageTitle, Avatar, StatusPill } from "../components/WorkspaceLayout";
import { documentTemplates } from "../content/document-templates";

export function AdminHandoffsPage({
  navigate,
}: {
  navigate: (p: string) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]),
    [handoffs, setHandoffs] = useState<Handoff[]>([]),
    [tasks, setTasks] = useState<HandoffTask[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase
        .from("client_handoffs")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase.from("handoff_tasks").select("*"),
    ]).then(([c, h, t]) => {
      setClients((c.data || []) as Client[]);
      setHandoffs((h.data || []) as Handoff[]);
      setTasks((t.data || []) as HandoffTask[]);
      setLoading(false);
    });
  }, []);
  const handoffFor = (clientId: string) =>
    handoffs.find((h) => h.client_id === clientId);
  return (
    <>
      <PageTitle
        eyebrow="Closeout"
        title="Handoffs"
        copy="Run every client through the same documented transfer, aftercare, retention, and access-removal process."
      />
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Client lifecycle</p>
            <h2>Handoff queue</h2>
          </div>
          <span className="status">
            {handoffs.filter((h) => h.status !== "completed").length} open
          </span>
        </div>
        {loading ? (
          <p className="muted">Loading handoffs…</p>
        ) : (
          clients.map((client) => {
            const h = handoffFor(client.id),
              ht = h ? tasks.filter((t) => t.handoff_id === h.id) : [],
              done = ht.filter(
                (t) => t.status === "complete" || t.status === "not_applicable",
              ).length,
              total = ht.length;
            return (
              <button
                className="handoff-row"
                key={client.id}
                onClick={() => navigate("/handoffs/" + client.id)}
              >
                <Avatar name={client.name} />
                <div>
                  <b>{client.name}</b>
                  <small>
                    {h
                      ? label(h.status) +
                        " · " +
                        done +
                        "/" +
                        total +
                        " checklist items"
                      : "Not started"}
                  </small>
                </div>
                <div className="handoff-row-dates">
                  <small>
                    {h?.aftercare_ends_at
                      ? "Aftercare " + date(h.aftercare_ends_at)
                      : "No aftercare date"}
                  </small>
                  <small>
                    {h?.retention_ends_at
                      ? "Deletion " + date(h.retention_ends_at)
                      : "No deletion date"}
                  </small>
                </div>
                <span className={"pill " + (h?.status || "planning")}>
                  {h ? label(h.status) : "Start"}
                </span>
              </button>
            );
          })
        )}
      </section>
    </>
  );
}

export function AdminHandoffPage({
  clientId,
  navigate,
}: {
  clientId: string;
  navigate: (p: string) => void;
}) {
  const [client, setClient] = useState<Client | null>(null),
    [projects, setProjects] = useState<Project[]>([]),
    [handoff, setHandoff] = useState<Handoff | null>(null),
    [tasks, setTasks] = useState<HandoffTask[]>([]),
    [docs, setDocs] = useState<DocumentRow[]>([]),
    [requests, setRequests] = useState<SignatureRequest[]>([]),
    [meetingAt, setMeetingAt] = useState(""),
    [meetingUrl, setMeetingUrl] = useState(""),
    [verificationEmail, setVerificationEmail] = useState(""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const load = async () => {
    const [c, p, h, d, r] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase
        .from("projects")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at"),
      supabase
        .from("client_handoffs")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("signature_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("requested_at", { ascending: false }),
    ]);
    setClient(c.data as Client);
    setProjects((p.data || []) as Project[]);
    setDocs((d.data || []) as DocumentRow[]);
    setRequests((r.data || []) as SignatureRequest[]);
    const row = h.data as Handoff | null;
    setHandoff(row);
    if (row) {
      const { data } = await supabase
        .from("handoff_tasks")
        .select("*")
        .eq("handoff_id", row.id)
        .order("position");
      setTasks((data || []) as HandoffTask[]);
      setMeetingAt(localDateTimeInput(row.meeting_at));
      setMeetingUrl(row.meeting_url || "");
      setVerificationEmail(
        row.verification_email || c.data?.primary_email || "",
      );
      setNotes(row.notes || "");
    } else {
      setTasks([]);
      setMeetingAt("");
      setMeetingUrl("");
      setVerificationEmail(c.data?.primary_email || "");
      setNotes("");
    }
  };
  useEffect(() => {
    void load();
  }, [clientId]);
  const project =
    projects.find((p) => p.id === handoff?.project_id) ||
    projects.find((p) => !["completed", "archived"].includes(p.status)) ||
    projects[0];
  const docFor = (prefix: string) =>
    docs.find((d) => d.name.startsWith(prefix));
  const requestFor = (documentId?: string) =>
    documentId
      ? requests.find(
          (r) => r.document_id === documentId && r.signer_side === "client",
        )
      : undefined;
  const handoffDoc = docFor("Handoff & Aftercare Agreement"),
    retentionDoc = docFor("Data Retention Agreement");
  const handoffFinal = handoffDoc?.state === "final",
    retentionFinal = retentionDoc?.state === "final";
  const taskComplete = (key: string) =>
    tasks.find((t) => t.task_key === key)?.status === "complete";
  async function startHandoff() {
    if (!client) return;
    setBusy("start");
    const preferred =
      projects.find((p) => !["completed", "archived"].includes(p.status)) ||
      projects[0];
    const { error } = await supabase.from("client_handoffs").insert({
      client_id: clientId,
      project_id: preferred?.id || null,
      verification_email: client.primary_email,
      status: "planning",
    });
    setBusy("");
    setMessage(error ? error.message : "Handoff workspace started.");
    if (!error) await load();
  }
  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    if (!handoff) return;
    setBusy("save");
    const payload = {
      meeting_at: meetingAt ? new Date(meetingAt).toISOString() : null,
      meeting_url: meetingUrl.trim() || null,
      verification_email: verificationEmail.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("client_handoffs")
      .update(payload)
      .eq("id", handoff.id);
    if (!error && meetingAt) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase
        .from("handoff_tasks")
        .update({
          status: "complete",
          completed_at: new Date().toISOString(),
          completed_by: user?.id || null,
        })
        .eq("handoff_id", handoff.id)
        .eq("task_key", "meeting_scheduled");
    }
    setBusy("");
    setMessage(error ? error.message : "Handoff details saved.");
    if (!error) await load();
  }
  async function verifyEmail() {
    if (!handoff || !verificationEmail.trim()) return;
    setBusy("verify");
    const now = new Date().toISOString(),
      {
        data: { user },
      } = await supabase.auth.getUser();
    const [{ error }] = await Promise.all([
      supabase
        .from("client_handoffs")
        .update({
          verification_email: verificationEmail.trim(),
          verified_at: now,
          updated_at: now,
        })
        .eq("id", handoff.id),
      supabase
        .from("handoff_tasks")
        .update({
          status: "complete",
          completed_at: now,
          completed_by: user?.id || null,
        })
        .eq("handoff_id", handoff.id)
        .eq("task_key", "verification_email_confirmed"),
    ]);
    setBusy("");
    setMessage(error ? error.message : "Client transfer email verified.");
    if (!error) await load();
  }
  async function setTaskStatus(
    task: HandoffTask,
    status: HandoffTask["status"],
  ) {
    if (!handoff) return;
    if (
      task.task_key === "client_access_disabled" &&
      status === "complete" &&
      !confirm("Disable this client's SRCcvde workspace access now?")
    )
      return;
    setBusy(task.id);
    const now = new Date().toISOString(),
      {
        data: { user },
      } = await supabase.auth.getUser();
    if (task.task_key === "client_access_disabled" && status === "complete") {
      const { error } = await supabase.rpc("set_client_portal_access", {
        p_client_id: clientId,
        p_enabled: false,
      });
      if (error) {
        setBusy("");
        setMessage(error.message);
        return;
      }
    }
    const { error } = await supabase
      .from("handoff_tasks")
      .update({
        status,
        completed_at: status === "complete" ? now : null,
        completed_by: status === "complete" ? user?.id || null : null,
      })
      .eq("id", task.id);
    if (!error && status === "complete") {
      const patch: any = { updated_at: now };
      if (task.task_key === "contract_archive_delivered")
        patch.archive_downloaded_at = now;
      if (task.task_key === "final_notice_sent")
        patch.admin_removal_notice_at = now;
      if (task.task_key === "admin_access_removed") {
        patch.admin_removed_at = now;
        patch.status = "retention";
      }
      if (task.task_key === "data_erased") patch.data_deleted_at = now;
      if (task.task_key === "handoff_complete") patch.status = "completed";
      if (Object.keys(patch).length > 1)
        await supabase
          .from("client_handoffs")
          .update(patch)
          .eq("id", handoff.id);
    }
    setBusy("");
    setMessage(error ? error.message : "Checklist updated.");
    if (!error) await load();
  }
  function prepareDocument(templateId: string) {
    if (!client || !project)
      return setMessage("Add a project before preparing handoff documents.");
    const template = documentTemplates.find((t) => t.id === templateId);
    if (!template) return;
    const ctx: TemplateContext = {
      clientName: client.name,
      clientContact: client.primary_contact_name,
      clientEmail: client.primary_email,
      projectName: project.name,
      projectType: project.project_type || "Custom technology project",
      projectPhase: label(project.phase),
      today: new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    };
    const draft = {
      selectedWorkProject: project.id,
      docName: template.documentName + " — " + project.name,
      docCategory: template.category,
      docKind: template.signatureKind,
      docContent: template.buildContent(ctx),
      docTemplate: template.id,
    };
    try {
      localStorage.setItem(
        "srccvde:admin-client-draft:" + clientId,
        JSON.stringify(draft),
      );
    } catch {}
    navigate("/clients/" + clientId);
  }
  async function generateArchive() {
    if (!handoff) return;
    setBusy("archive");
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "handoff-contract-archive",
      { body: { client_id: clientId } },
    );
    setBusy("");
    if (error || !data?.url) {
      setMessage(
        data?.error ||
          error?.message ||
          "Could not generate the contract archive.",
      );
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
    setMessage(
      data.document_count +
        " executed document" +
        (data.document_count === 1 ? "" : "s") +
        " packaged into " +
        data.file_name +
        ". The link expires in one hour.",
    );
    await load();
  }
  async function startAftercare() {
    if (!handoff) return;
    const required = [
      "meeting_completed",
      "verification_email_confirmed",
      "github_transferred",
      "supabase_transferred",
      "contract_archive_delivered",
    ];
    const missing = required.filter((k) => !taskComplete(k));
    if (!handoffFinal || !retentionFinal || missing.length) {
      setMessage(
        "Before aftercare starts: fully execute both agreements and complete the meeting, email verification, GitHub transfer, Supabase transfer, and contract archive delivery.",
      );
      return;
    }
    if (
      !confirm(
        "Start the 30-calendar-day aftercare clock now? This will also set the data-retention deadline 60 calendar days from today.",
      )
    )
      return;
    setBusy("aftercare");
    const now = new Date().toISOString(),
      aftercare = addDaysIso(now, 30),
      retention = addDaysIso(now, 60),
      {
        data: { user },
      } = await supabase.auth.getUser();
    const [a, b] = await Promise.all([
      supabase
        .from("client_handoffs")
        .update({
          status: "aftercare",
          effective_at: now,
          aftercare_ends_at: aftercare,
          retention_ends_at: retention,
          updated_at: now,
        })
        .eq("id", handoff.id),
      supabase
        .from("handoff_tasks")
        .update({
          status: "complete",
          completed_at: now,
          completed_by: user?.id || null,
        })
        .eq("handoff_id", handoff.id)
        .eq("task_key", "aftercare_started"),
    ]);
    setBusy("");
    setMessage(
      a.error?.message ||
        b.error?.message ||
        "Aftercare started. The 30-day aftercare and 30-day retention deadlines are now locked in.",
    );
    if (!a.error && !b.error) await load();
  }
  if (!client) return <p className="muted">Loading handoff…</p>;
  if (!handoff)
    return (
      <>
        <button className="back" onClick={() => navigate("/handoffs")}>
          ← Handoffs
        </button>
        <PageTitle
          eyebrow="Client handoff"
          title={client.name}
          copy="Start a controlled closeout with signed agreements, ownership transfer, aftercare, and documented data retention."
        />
        <section className="panel attention-clear">
          <span>→</span>
          <div>
            <p className="eyebrow">Not started</p>
            <h2>Create the handoff workspace</h2>
            <p className="muted">
              This creates the standard SRCcvde handoff checklist and does not
              transfer or delete anything yet.
            </p>
            <button
              className="primary inline"
              disabled={busy === "start"}
              onClick={startHandoff}
            >
              {busy === "start" ? "Starting…" : "Start handoff"}
            </button>
          </div>
        </section>
      </>
    );
  const aftercareDays = daysUntil(handoff.aftercare_ends_at),
    retentionDays = daysUntil(handoff.retention_ends_at);
  return (
    <>
      <button className="back" onClick={() => navigate("/handoffs")}>
        ← Handoffs
      </button>
      <header className="detail-head">
        <div className="identity">
          <Avatar name={client.name} />
          <div>
            <p className="eyebrow">Client handoff</p>
            <h1>{client.name}</h1>
            <p>
              {client.primary_contact_name} · {client.primary_email}
            </p>
          </div>
        </div>
        <div className="detail-actions">
          <StatusPill value={handoff.status} />
          <button
            className="ghost"
            onClick={() => navigate("/clients/" + clientId)}
          >
            Client record →
          </button>
        </div>
      </header>
      {message && <p className="success-message">{message}</p>}
      <section className="handoff-summary-grid">
        <article>
          <small>Aftercare</small>
          <strong>
            {handoff.aftercare_ends_at
              ? date(handoff.aftercare_ends_at)
              : "Not started"}
          </strong>
          <span>
            {aftercareDays === null
              ? "Starts after required handoff steps"
              : aftercareDays >= 0
                ? aftercareDays + " days remaining"
                : "Ended"}
          </span>
        </article>
        <article>
          <small>Retention / deletion</small>
          <strong>
            {handoff.retention_ends_at
              ? date(handoff.retention_ends_at)
              : "Not set"}
          </strong>
          <span>
            {retentionDays === null
              ? "Set when aftercare begins"
              : retentionDays >= 0
                ? retentionDays + " days remaining"
                : "Retention ended"}
          </span>
        </article>
        <article>
          <small>Admin removal</small>
          <strong>
            {handoff.admin_removed_at
              ? date(handoff.admin_removed_at)
              : "Pending"}
          </strong>
          <span>
            {handoff.admin_removal_notice_at
              ? "Client notice logged"
              : "Notify client on the final aftercare day"}
          </span>
        </article>
      </section>
      <div className="detail-grid">
        <section>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">01 · Meeting & verification</p>
                <h2>Set the closeout meeting</h2>
              </div>
              <span className="status">
                {handoff.meeting_at ? date(handoff.meeting_at) : "Unscheduled"}
              </span>
            </div>
            <form className="document-form" onSubmit={saveDetails}>
              <div className="form-split">
                <label>
                  Zoom meeting
                  <input
                    type="datetime-local"
                    value={meetingAt}
                    onChange={(e) => setMeetingAt(e.target.value)}
                  />
                </label>
                <label>
                  Zoom link
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                  />
                </label>
              </div>
              <div className="form-split">
                <label>
                  Verified transfer email
                  <input
                    type="email"
                    value={verificationEmail}
                    onChange={(e) => setVerificationEmail(e.target.value)}
                    placeholder={client.primary_email}
                  />
                </label>
                <div className="handoff-verify">
                  <small>
                    {handoff.verified_at
                      ? "Verified " + date(handoff.verified_at)
                      : "Verification still required"}
                  </small>
                  <button
                    className="ghost inline"
                    type="button"
                    disabled={busy === "verify" || !verificationEmail.trim()}
                    onClick={verifyEmail}
                  >
                    {busy === "verify" ? "Saving…" : "Verify email"}
                  </button>
                </div>
              </div>
              <label>
                Internal handoff notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Accounts, caveats, transfer notes, or anything to cover in the meeting."
                />
              </label>
              <button className="primary inline" disabled={busy === "save"}>
                {busy === "save" ? "Saving…" : "Save handoff details"}
              </button>
            </form>
            {handoff.meeting_url && (
              <p className="muted">
                <a href={handoff.meeting_url} target="_blank" rel="noreferrer">
                  Open Zoom meeting →
                </a>
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">02 · Agreements</p>
                <h2>Get both documents fully executed</h2>
              </div>
            </div>
            <div className="handoff-agreements">
              <article>
                <div>
                  <b>Handoff & Aftercare Agreement</b>
                  <small>
                    {handoffDoc
                      ? handoffFinal
                        ? "Fully executed"
                        : requestFor(handoffDoc.id)?.status === "signed"
                          ? "Client signed · countersign required"
                          : label(
                              requestFor(handoffDoc.id)?.status ||
                                handoffDoc.state,
                            )
                      : "Not created"}
                  </small>
                </div>
                {handoffDoc ? (
                  <button
                    className="ghost"
                    onClick={() => navigate("/clients/" + clientId)}
                  >
                    Open signing room
                  </button>
                ) : (
                  <button
                    className="primary inline"
                    onClick={() => prepareDocument("handoff-aftercare")}
                  >
                    Prepare agreement
                  </button>
                )}
              </article>
              <article>
                <div>
                  <b>Data Retention Agreement</b>
                  <small>
                    {retentionDoc
                      ? retentionFinal
                        ? "Fully executed"
                        : requestFor(retentionDoc.id)?.status === "signed"
                          ? "Client signed · countersign required"
                          : label(
                              requestFor(retentionDoc.id)?.status ||
                                retentionDoc.state,
                            )
                      : "Not created"}
                  </small>
                </div>
                {retentionDoc ? (
                  <button
                    className="ghost"
                    onClick={() => navigate("/clients/" + clientId)}
                  >
                    Open signing room
                  </button>
                ) : (
                  <button
                    className="primary inline"
                    onClick={() => prepareDocument("data-retention")}
                  >
                    Prepare agreement
                  </button>
                )}
              </article>
            </div>
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">03 · Contract archive</p>
                <h2>Package the client record</h2>
                <p className="section-copy">
                  Creates a ZIP of every fully executed PDF currently in this
                  client's SRCcvde document vault plus a hash manifest.
                </p>
              </div>
            </div>
            <div className="detail-actions">
              <button
                className="primary inline"
                disabled={busy === "archive"}
                onClick={generateArchive}
              >
                {busy === "archive" ? "Building ZIP…" : "Generate contract ZIP"}
              </button>
              {handoff.archive_generated_at && (
                <span className="muted">
                  Last generated {date(handoff.archive_generated_at)}
                </span>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">04 · Checklist</p>
                <h2>Transfer & closeout</h2>
              </div>
              <span className="status">
                {
                  tasks.filter(
                    (t) =>
                      t.status === "complete" || t.status === "not_applicable",
                  ).length
                }
                /{tasks.length}
              </span>
            </div>
            <div className="handoff-task-list">
              {tasks.map((task) => (
                <article
                  className={"handoff-task " + task.status}
                  key={task.id}
                >
                  <div>
                    <b>{task.title}</b>
                    <small>
                      {label(task.category)}
                      {task.required ? " · Required" : " · Optional"}
                      {task.completed_at ? " · " + date(task.completed_at) : ""}
                    </small>
                  </div>
                  <select
                    value={task.status}
                    disabled={
                      busy === task.id || task.task_key === "aftercare_started"
                    }
                    onChange={(e) =>
                      setTaskStatus(
                        task,
                        e.target.value as HandoffTask["status"],
                      )
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="complete">Complete</option>
                    {!task.required && (
                      <option value="not_applicable">N/A</option>
                    )}
                  </select>
                </article>
              ))}
            </div>
          </section>
          <section className="panel handoff-start">
            <div>
              <p className="eyebrow">05 · Start the clock</p>
              <h2>Begin included aftercare</h2>
              <p className="muted">
                This sets aftercare to 30 calendar days and the data-retention
                deadline to 30 additional calendar days.
              </p>
            </div>
            <button
              className="primary"
              disabled={busy === "aftercare" || Boolean(handoff.effective_at)}
              onClick={startAftercare}
            >
              {handoff.effective_at
                ? "Aftercare started " + date(handoff.effective_at)
                : busy === "aftercare"
                  ? "Starting…"
                  : "Start 30-day aftercare"}
            </button>
          </section>
        </section>
        <aside>
          <section className="panel">
            <p className="eyebrow">Lifecycle rules</p>
            <h2>What happens next</h2>
            <div className="handoff-stage-grid">
              <div>
                <b>Day 0</b>
                <span>Required transfers complete; aftercare begins.</span>
              </div>
              <div>
                <b>Day 30</b>
                <span>
                  Text the client, remove SRCcvde admin access, begin
                  retention-only period.
                </span>
              </div>
              <div>
                <b>Day 60</b>
                <span>
                  Disable client workspace access and erase Client Project Data
                  except permitted business records.
                </span>
              </div>
            </div>
          </section>
          <section className="panel">
            <p className="eyebrow">Deletion boundary</p>
            <p className="muted">
              Executed contracts and other business records that must be
              retained for legal, accounting, insurance, or dispute purposes are
              outside the Client Project Data deletion promise. The signed Data
              Retention Agreement states this explicitly.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

export function ClientHandoffPage() {
  const [handoff, setHandoff] = useState<Handoff | null>(null),
    [tasks, setTasks] = useState<HandoffTask[]>([]),
    [client, setClient] = useState<Client | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = async () => {
    const { data: cms } = await supabase
      .from("client_memberships")
      .select("client_id")
      .limit(1);
    const clientId = cms?.[0]?.client_id;
    if (!clientId) return;
    const [c, h] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase
        .from("client_handoffs")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle(),
    ]);
    setClient(c.data as Client);
    const row = h.data as Handoff | null;
    setHandoff(row);
    if (row) {
      const { data } = await supabase
        .from("handoff_tasks")
        .select("*")
        .eq("handoff_id", row.id)
        .order("position");
      setTasks((data || []) as HandoffTask[]);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function archive() {
    if (!handoff) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "handoff-contract-archive",
      { body: { client_id: handoff.client_id } },
    );
    setBusy(false);
    if (error || !data?.url) {
      setMessage(
        data?.error || error?.message || "Could not create your archive.",
      );
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
    setMessage(
      data.document_count +
        " executed document" +
        (data.document_count === 1 ? "" : "s") +
        " packaged. Save the ZIP somewhere you control before your retention deadline.",
    );
    await load();
  }
  if (!handoff)
    return (
      <>
        <PageTitle
          eyebrow="Handoff"
          title="Project closeout"
          copy="Your formal handoff timeline will appear here when SRCcvde starts the closeout process."
        />
        <section className="panel attention-clear">
          <span>✓</span>
          <div>
            <h2>No handoff is active yet.</h2>
            <p className="muted">
              Your current project workspace remains unchanged.
            </p>
          </div>
        </section>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="Handoff"
        title={(client?.name || "Your project") + " closeout"}
        copy="Track ownership transfer, included aftercare, your archive window, and SRCcvde access removal."
      />
      {message && <p className="success-message">{message}</p>}
      <section className="handoff-summary-grid">
        <article>
          <small>Status</small>
          <strong>{label(handoff.status)}</strong>
          <span>
            {handoff.effective_at
              ? "Effective " + date(handoff.effective_at)
              : "Handoff preparations in progress"}
          </span>
        </article>
        <article>
          <small>Aftercare ends</small>
          <strong>
            {handoff.aftercare_ends_at
              ? date(handoff.aftercare_ends_at)
              : "Not started"}
          </strong>
          <span>30 calendar days included</span>
        </article>
        <article>
          <small>Data deletion date</small>
          <strong>
            {handoff.retention_ends_at
              ? date(handoff.retention_ends_at)
              : "Not set"}
          </strong>
          <span>Download everything you want to keep before this date.</span>
        </article>
      </section>
      {handoff.meeting_at && (
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Handoff meeting</p>
              <h2>{date(handoff.meeting_at)}</h2>
            </div>
            {handoff.meeting_url && (
              <a
                className="button-link"
                href={handoff.meeting_url}
                target="_blank"
                rel="noreferrer"
              >
                Open Zoom →
              </a>
            )}
          </div>
          <p className="muted">
            Verified transfer email:{" "}
            {handoff.verification_email || "Still being confirmed"}
          </p>
        </section>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Your archive</p>
            <h2>Keep your own contract copy</h2>
            <p className="section-copy">
              This ZIP contains the fully executed PDFs available in your
              document vault plus a SHA-256 manifest.
            </p>
          </div>
        </div>
        <button className="primary inline" disabled={busy} onClick={archive}>
          {busy ? "Building ZIP…" : "Download contract archive"}
        </button>
        {handoff.archive_generated_at && (
          <p className="muted">
            Archive last generated {date(handoff.archive_generated_at)}. Each
            download link expires after one hour.
          </p>
        )}
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Handoff checklist</p>
            <h2>Progress</h2>
          </div>
          <span className="status">
            {
              tasks.filter(
                (t) => t.status === "complete" || t.status === "not_applicable",
              ).length
            }
            /{tasks.length}
          </span>
        </div>
        <div className="handoff-task-list">
          {tasks.map((task) => (
            <article className={"handoff-task " + task.status} key={task.id}>
              <div>
                <b>{task.title}</b>
                <small>
                  {label(task.category)}
                  {task.status === "not_applicable"
                    ? " · Not applicable"
                    : task.completed_at
                      ? " · Completed " + date(task.completed_at)
                      : " · Pending"}
                </small>
              </div>
              <StatusPill
                value={
                  task.status === "not_applicable" ? "archived" : task.status
                }
              />
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Retention reminder</p>
        <h2>Your copy matters.</h2>
        <p className="muted">
          After the post-aftercare retention window ends, SRCcvde will remove
          Client Project Data from active systems and disable your SRCcvde
          workspace access. Executed contracts and other limited business
          records may be retained when needed for legal, accounting, insurance,
          or dispute purposes.
        </p>
      </section>
    </>
  );
}
