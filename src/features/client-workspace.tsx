import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { label, date, money, validateProjectFile } from "../shared/workspace";
import type {
  Inquiry,
  Profile,
  Client,
  Project,
  Milestone,
  SignatureRequest,
  DocumentRow,
  ClientAction,
  BillingInvoice,
  Communication,
} from "../shared/workspace";
import { SignatureCard } from "./signatures";
import {
  StatusPill,
  Empty,
  PageTitle,
  LoadState,
} from "../components/WorkspaceLayout";

export function ApplicantTimeline({ inquiry }: { inquiry: Inquiry }) {
  const flow = ["application", "discovery", "proposal", "contract", "kickoff"];
  const current =
    inquiry.status === "discovery"
      ? 1
      : inquiry.status === "proposal"
        ? 2
        : inquiry.status === "contract"
          ? 3
          : inquiry.status === "won"
            ? 4
            : 0;
  return (
    <section className="timeline-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Your journey</p>
          <h2>
            {current === 0
              ? "Application received"
              : current === 1
                ? "Discovery"
                : current === 2
                  ? "Proposal"
                  : current === 3
                    ? "Contract"
                    : "Project kickoff"}
          </h2>
        </div>
        <span className="status">{label(inquiry.status)}</span>
      </div>
      <div className="timeline">
        {flow.map((s, i) => (
          <div
            className={i < current ? "done" : i === current ? "current" : ""}
            key={s}
          >
            <i />
            <b>{label(s)}</b>
            <small>
              {i < current
                ? "Complete"
                : i === current
                  ? "Current step"
                  : "Upcoming"}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ClientDashboard({
  profile,
  navigate,
}: {
  profile: Profile | null;
  navigate: (p: string) => void;
}) {
  const [inquiry, setInquiry] = useState<Inquiry | null>(null),
    [client, setClient] = useState<
      (Client & { portal_unlocked?: boolean }) | null
    >(null),
    [projects, setProjects] = useState<Project[]>([]),
    [milestones, setMilestones] = useState<Milestone[]>([]),
    [requests, setRequests] = useState<SignatureRequest[]>([]),
    [docs, setDocs] = useState<DocumentRow[]>([]),
    [actions, setActions] = useState<ClientAction[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: ims }, { data: cms }] = await Promise.all([
        supabase.from("inquiry_memberships").select("inquiry_id").limit(1),
        supabase.from("client_memberships").select("client_id").limit(1),
      ]);
      const inquiryId = ims?.[0]?.inquiry_id,
        clientId = cms?.[0]?.client_id;
      if (inquiryId) {
        const { data } = await supabase
          .from("project_inquiries")
          .select("*")
          .eq("id", inquiryId)
          .single();
        setInquiry(data as Inquiry);
      }
      if (!clientId) return;
      const [c, p, d, r, x] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase
          .from("projects")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_documents")
          .select("*")
          .eq("client_id", clientId)
          .eq("client_visible", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("signature_requests")
          .select("*")
          .eq("client_id", clientId)
          .eq("signer_side", "client")
          .order("requested_at", { ascending: false }),
        supabase
          .from("client_action_requests")
          .select("*")
          .eq("client_id", clientId)
          .eq("client_visible", true)
          .order("created_at", { ascending: false }),
      ]);
      setClient(c.data as Client & { portal_unlocked?: boolean });
      const ps = (p.data || []) as Project[];
      setProjects(ps);
      setDocs((d.data || []) as DocumentRow[]);
      setRequests((r.data || []) as SignatureRequest[]);
      setActions((x.data || []) as ClientAction[]);
      if (ps.length) {
        const { data: ms } = await supabase
          .from("project_milestones")
          .select("*")
          .in(
            "project_id",
            ps.map((v) => v.id),
          )
          .eq("client_visible", true)
          .order("position");
        setMilestones((ms || []) as Milestone[]);
      } else setMilestones([]);
    })();
  }, []);
  const first = profile?.full_name ? " " + profile.full_name.split(" ")[0] : "",
    pending = requests.filter((r) => r.status === "pending"),
    openActions = actions.filter((a) => a.status !== "completed"),
    needsYou = pending.length + openActions.length;
  const activeProject =
    projects.find((p) => !["completed", "archived"].includes(p.status)) ||
    projects[0] ||
    null;
  const activeMilestones = activeProject
      ? milestones.filter((m) => m.project_id === activeProject.id)
      : [],
    completed = activeMilestones.filter((m) => m.status === "completed").length;
  const progress = activeMilestones.length
    ? Math.round((completed / activeMilestones.length) * 100)
    : activeProject?.progress || 0;
  const current =
      activeMilestones.find((m) => m.status === "blocked") ||
      activeMilestones.find((m) => m.status === "current") ||
      activeMilestones.find((m) => m.status === "upcoming") ||
      null,
    next = current
      ? activeMilestones.find(
          (m) => m.position > current.position && m.status === "upcoming",
        ) || null
      : null;
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            {client?.portal_unlocked ? "Client workspace" : "Project journey"}
          </p>
          <h1>Welcome{first}.</h1>
        </div>
        <span className="live-dot">Secure workspace</span>
      </header>
      {needsYou > 0 && (
        <section className="attention">
          <div>
            <p className="eyebrow">Needs you</p>
            <h2>
              {needsYou === 1
                ? "One item needs your attention."
                : needsYou + " items need your attention."}
            </h2>
          </div>
          <div className="attention-list">
            {pending.map((r) => (
              <SignatureCard key={r.id} request={r} navigate={navigate} />
            ))}
            {openActions.slice(0, 3).map((a) => (
              <article className="attention-item" key={a.id}>
                <div className="attention-mark">→</div>
                <div>
                  <b>{a.title}</b>
                  <small>
                    {a.due_at
                      ? "Due " + date(a.due_at)
                      : "Client action request"}
                  </small>
                  {a.description && <p className="muted">{a.description}</p>}
                </div>
                <button className="ghost" onClick={() => navigate("/actions")}>
                  Review →
                </button>
              </article>
            ))}
          </div>
          {openActions.length > 3 && (
            <button
              className="ghost inline"
              onClick={() => navigate("/actions")}
            >
              View all {openActions.length} requests →
            </button>
          )}
        </section>
      )}
      {!client && inquiry && <ApplicantTimeline inquiry={inquiry} />}
      {client && !client.portal_unlocked && (
        <>
          <section className="timeline-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Pre-project workspace</p>
                <h2>
                  {activeProject?.phase
                    ? label(activeProject.phase)
                    : "Contract"}
                </h2>
              </div>
              <span className="status">Workspace unlocks after execution</span>
            </div>
          </section>
          <section className="two-col">
            <article
              className="panel client-doc-summary"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/documents")}
            >
              <p className="eyebrow">Documents</p>
              <h2>{docs.length} shared</h2>
              <p className="muted">
                Proposals, scope and agreements stay attached to your project
                journey.
              </p>
              <span className="summary-link">Open document vault →</span>
            </article>
            <article className="panel">
              <p className="eyebrow">What happens next</p>
              <h2>One account. No restart.</h2>
              <p className="muted">
                Once the agreement is fully executed, this workspace opens into
                your project dashboard.
              </p>
            </article>
          </section>
        </>
      )}
      {client?.portal_unlocked && activeProject && (
        <>
          <section className="timeline-card project-hero">
            <div className="section-head">
              <div>
                <p className="eyebrow">
                  {projects.length > 1
                    ? "Active projects · " + projects.length
                    : "Current project"}
                </p>
                <h2>{activeProject.name}</h2>
                <p className="muted">
                  {activeProject.project_type
                    ? label(activeProject.project_type)
                    : "Custom project"}
                  {projects.length > 1
                    ? " · Your most active build is shown here"
                    : ""}
                </p>
              </div>
              <StatusPill value={activeProject.status} />
            </div>
            <div className="client-progress">
              <div>
                <span>{label(activeProject.phase)}</span>
                <strong>{progress}%</strong>
              </div>
              <div className="progress">
                <i style={{ width: progress + "%" }} />
              </div>
            </div>
            {projects.length > 1 && (
              <button
                className="ghost inline"
                onClick={() => navigate("/project")}
              >
                View all projects →
              </button>
            )}
          </section>
          <section className="two-col">
            <article className="panel">
              <p className="eyebrow">Right now</p>
              <h2>
                {current?.title ||
                  (progress >= 100
                    ? "Project complete."
                    : "Work is getting underway.")}
              </h2>
              <p className="muted">
                {current?.description ||
                  (progress >= 100
                    ? "Your visible project milestones are complete."
                    : "Your project focus will appear here as the roadmap advances.")}
              </p>
            </article>
            <article className="panel">
              <p className="eyebrow">Up next</p>
              <h2>
                {next?.title ||
                  (progress >= 100 ? "Project complete" : "To be scheduled")}
              </h2>
              <p className="muted">
                {next?.description ||
                  (progress >= 100
                    ? "Your completed materials remain available."
                    : "SRCcvde will update this as the roadmap advances.")}
              </p>
            </article>
          </section>
          <section
            className="panel client-doc-summary"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/documents")}
          >
            <p className="eyebrow">Document vault</p>
            <h2>{docs.length} available</h2>
            <p className="muted">
              Files across all of your SRCcvde projects stay together.
            </p>
            <span className="summary-link">Open document vault →</span>
          </section>
        </>
      )}
      {!inquiry && !client && <Empty>Your workspace is being prepared.</Empty>}
    </>
  );
}

export function ClientProjectPage() {
  const [projects, setProjects] = useState<Project[]>([]),
    [projectId, setProjectId] = useState(""),
    [milestones, setMilestones] = useState<Milestone[]>([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: cms } = await supabase
        .from("client_memberships")
        .select("client_id")
        .limit(1);
      const clientId = cms?.[0]?.client_id;
      if (!clientId) {
        setLoading(false);
        return;
      }
      const { data: p } = await supabase
        .from("projects")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      const ps = (p || []) as Project[];
      setProjects(ps);
      setProjectId(
        ps.find((v) => !["completed", "archived"].includes(v.status))?.id ||
          ps[0]?.id ||
          "",
      );
      setLoading(false);
    })();
  }, []);
  useEffect(() => {
    if (!projectId) {
      setMilestones([]);
      return;
    }
    supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", projectId)
      .eq("client_visible", true)
      .order("position")
      .then(({ data }) => setMilestones((data || []) as Milestone[]));
  }, [projectId]);
  const project = projects.find((p) => p.id === projectId) || null;
  if (loading) return <p className="muted">Loading projects…</p>;
  if (!project)
    return (
      <>
        <PageTitle
          eyebrow="Projects"
          title="Your projects"
          copy="Your project workspaces will appear here when your builds begin."
        />
        <Empty>No active project yet.</Empty>
      </>
    );
  const completed = milestones.filter((m) => m.status === "completed").length,
    progress = milestones.length
      ? Math.round((completed / milestones.length) * 100)
      : project.progress,
    current =
      milestones.find((m) => m.status === "blocked") ||
      milestones.find((m) => m.status === "current") ||
      milestones.find((m) => m.status === "upcoming") ||
      null,
    next = current
      ? milestones.find(
          (m) => m.position > current.position && m.status !== "completed",
        ) || null
      : null;
  return (
    <>
      <PageTitle
        eyebrow="Projects"
        title={project.name}
        copy="Switch between your SRCcvde projects without leaving your workspace."
      />
      {projects.length > 1 && (
        <section className="panel project-switcher">
          <div className="section-head">
            <div>
              <p className="eyebrow">Your projects</p>
              <h2>Choose a workspace</h2>
            </div>
          </div>
          <div className="project-switcher-list">
            {projects.map((p) => (
              <button
                className={p.id === projectId ? "active" : ""}
                onClick={() => setProjectId(p.id)}
                key={p.id}
              >
                <span>
                  <b>{p.name}</b>
                  <small>
                    {p.project_type ? label(p.project_type) : "Custom project"}{" "}
                    · {label(p.phase)}
                  </small>
                </span>
                <StatusPill value={p.status} />
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="timeline-card project-hero">
        <div className="section-head">
          <div>
            <p className="eyebrow">Live progress</p>
            <h2>{label(project.phase)}</h2>
          </div>
          <StatusPill value={project.status} />
        </div>
        <div className="client-progress">
          <div>
            <span>
              {completed} of {milestones.length} milestones complete
            </span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress">
            <i style={{ width: progress + "%" }} />
          </div>
        </div>
      </section>
      <section className="project-now-grid">
        <article className="panel">
          <p className="eyebrow">Current focus</p>
          <h2>{current?.title || "Roadmap complete"}</h2>
          <p className="muted">
            {current?.description ||
              (progress >= 100
                ? "Your visible milestones are complete."
                : "Your next milestone is being prepared.")}
          </p>
        </article>
        <article className="panel">
          <p className="eyebrow">Up next</p>
          <h2>
            {next?.title ||
              (progress >= 100 ? "Project complete" : "To be scheduled")}
          </h2>
          <p className="muted">
            {next?.description ||
              (progress >= 100
                ? "Your completed materials remain available."
                : "SRCcvde will update this as the roadmap advances.")}
          </p>
        </article>
      </section>
      <section className="panel milestone-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Roadmap</p>
            <h2>Where this build stands.</h2>
          </div>
          <span className="status">{label(project.phase)}</span>
        </div>
        <div className="client-milestone-list">
          {milestones.length ? (
            milestones.map((m, n) => (
              <div
                className={
                  "client-milestone " +
                  (m.status === "completed"
                    ? "done"
                    : m.status === "blocked"
                      ? "blocked"
                      : m.status === "current"
                        ? "current"
                        : "")
                }
                key={m.id}
              >
                <div className="milestone-index">
                  {m.status === "completed"
                    ? "✓"
                    : String(n + 1).padStart(2, "0")}
                </div>
                <div className="milestone-copy">
                  <b>{m.title}</b>
                  <small>{m.description || label(m.status)}</small>
                </div>
                <div className="milestone-meta">
                  <StatusPill value={m.status} />
                  {m.due_at && <small>Due {date(m.due_at)}</small>}
                </div>
              </div>
            ))
          ) : (
            <Empty>Your roadmap is being prepared.</Empty>
          )}
        </div>
      </section>
    </>
  );
}

export function ClientActivityPage() {
  const [events, setEvents] = useState<
      {
        id: string;
        projectId: string | null;
        projectName: string;
        title: string;
        detail: string;
        at: string;
        kind: "project" | "milestone" | "document";
      }[]
    >([]),
    [projects, setProjects] = useState<Project[]>([]),
    [projectId, setProjectId] = useState("all"),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [view, setView] = useState("all"),
    [range, setRange] = useState("all");
  useEffect(() => {
    (async () => {
      const { data: cms } = await supabase
        .from("client_memberships")
        .select("client_id")
        .limit(1);
      const clientId = cms?.[0]?.client_id;
      if (!clientId) {
        setLoading(false);
        return;
      }
      const [{ data: ps }, { data: docs }, { data: reqs }] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_documents")
          .select("*")
          .eq("client_id", clientId)
          .eq("client_visible", true),
        supabase
          .from("signature_requests")
          .select("*")
          .eq("client_id", clientId)
          .eq("signer_side", "client"),
      ]);
      const projects = (ps || []) as Project[];
      setProjects(projects);
      let ms: Milestone[] = [];
      if (projects.length) {
        const { data } = await supabase
          .from("project_milestones")
          .select("*")
          .in(
            "project_id",
            projects.map((p) => p.id),
          )
          .eq("client_visible", true);
        ms = (data || []) as Milestone[];
      }
      const name = (id: any) =>
        projects.find((p) => p.id === id)?.name || "General";
      const out: any[] = [];
      (docs || []).forEach((d: any) =>
        out.push({
          id: "d" + d.id,
          projectId: d.project_id || null,
          projectName: name(d.project_id),
          title: d.name + " shared",
          detail: label(d.category) + " added to your document vault",
          at: d.created_at,
          kind: "document",
        }),
      );
      (reqs || []).forEach((q: any) =>
        out.push({
          id: "r" + q.id,
          projectId: q.project_id || null,
          projectName: name(q.project_id),
          title:
            q.status === "signed" ? "Document completed" : "Review requested",
          detail:
            q.status === "signed"
              ? "Your document action was recorded"
              : "A document is waiting for your review",
          at: q.signed_at || q.requested_at,
          kind: "document",
        }),
      );
      ms.filter((m) => m.completed_at).forEach((m) =>
        out.push({
          id: "m" + m.id,
          projectId: m.project_id,
          projectName: name(m.project_id),
          title: m.title + " completed",
          detail: "Project milestone completed",
          at: m.completed_at!,
          kind: "milestone",
        }),
      );
      projects.forEach((p) =>
        out.push({
          id: "p" + p.id,
          projectId: p.id,
          projectName: p.name,
          title: "Project workspace created",
          detail: p.name,
          at: p.created_at,
          kind: "project",
        }),
      );
      out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEvents(out);
      setLoading(false);
    })();
  }, []);
  const visibleEvents = events.filter((e) => {
    const q = query.trim().toLowerCase(),
      cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
    return (
      (!q ||
        [e.title, e.detail, e.projectName].some((v) =>
          v.toLowerCase().includes(q),
        )) &&
      (view === "all" || e.kind === view) &&
      (projectId === "all" || e.projectId === projectId) &&
      (!cutoff || new Date(e.at).getTime() >= cutoff)
    );
  });
  return (
    <>
      <PageTitle
        eyebrow="Activity"
        title="Project history"
        copy="One timeline across every SRCcvde project, with project-level filtering when you need it."
      />
      <section className="panel">
        <div className="directory-tools">
          <label>
            Search activity
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Milestone, document, project…"
            />
          </label>
          {projects.length > 1 && (
            <label>
              Project
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="all">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Type
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="all">All activity</option>
              <option value="project">Project</option>
              <option value="milestone">Milestones</option>
              <option value="document">Documents</option>
            </select>
          </label>
          <label>
            Time range
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          <span className="directory-count">
            {visibleEvents.length} of {events.length}
          </span>
        </div>
      </section>
      <section className="panel activity-panel">
        {loading ? (
          <p className="muted">Loading activity…</p>
        ) : visibleEvents.length ? (
          visibleEvents.map((e) => (
            <div className="activity-item" key={e.id}>
              <i />
              <div>
                <b>{e.title}</b>
                <small>
                  {date(e.at)} ·{" "}
                  {projects.length > 1 ? e.projectName + " · " : ""}
                  {e.detail}
                </small>
              </div>
            </div>
          ))
        ) : (
          <Empty>
            {events.length
              ? "No activity matches this view."
              : "No project activity yet."}
          </Empty>
        )}
      </section>
    </>
  );
}

export function ClientActionsPage({
  navigate,
}: {
  navigate: (p: string) => void;
}) {
  const [actions, setActions] = useState<ClientAction[]>([]),
    [signatures, setSignatures] = useState<SignatureRequest[]>([]),
    [invoices, setInvoices] = useState<BillingInvoice[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [docs, setDocs] = useState<DocumentRow[]>([]),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const [a, r, i, p, d] = await Promise.all([
      supabase
        .from("client_action_requests")
        .select("*")
        .eq("client_visible", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("signature_requests")
        .select("*")
        .eq("signer_side", "client")
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
      supabase
        .from("billing_invoices")
        .select("*,projects(name)")
        .eq("client_visible", true)
        .in("status", ["sent", "overdue"])
        .order("due_at", { ascending: true }),
      supabase.from("projects").select("*"),
      supabase.from("client_documents").select("*").eq("client_visible", true),
    ]);
    if (a.error) setMessage(a.error.message);
    setActions((a.data || []) as ClientAction[]);
    setSignatures((r.data || []) as SignatureRequest[]);
    setInvoices((i.data || []) as BillingInvoice[]);
    setProjects((p.data || []) as Project[]);
    setDocs((d.data || []) as DocumentRow[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  async function complete(a: ClientAction) {
    setBusy(a.id);
    setMessage("");
    const { error } = await supabase.rpc("complete_client_action_request", {
      p_action_id: a.id,
    });
    setBusy("");
    if (error) setMessage(error.message);
    else {
      setMessage("Action completed.");
      await supabase.functions.invoke("dispatch-notifications");
      load();
    }
  }
  const open = actions.filter((a) => a.status !== "completed"),
    done = actions.filter((a) => a.status === "completed"),
    now = Date.now();
  const projectName = (id: string | null) =>
    projects.find((p) => p.id === id)?.name || "";
  const documentName = (id: string) =>
    docs.find((d) => d.id === id)?.name || "Document";
  const remaining = (inv: BillingInvoice) =>
    Math.max(0, inv.total_cents - inv.amount_paid_cents);
  const overdueInvoices = invoices.filter((inv) =>
    Boolean(
      inv.due_at && new Date(inv.due_at).getTime() < now && remaining(inv) > 0,
    ),
  );
  const dueActions = open.filter((a) =>
    Boolean(a.due_at && new Date(a.due_at).getTime() < now),
  );
  const attentionCount =
    signatures.length +
    open.length +
    invoices.filter((inv) => remaining(inv) > 0).length;
  return (
    <>
      <PageTitle
        eyebrow="Attention center"
        title="What needs you"
        copy="Signatures, requests and open balances are prioritized here so nothing gets buried."
      />
      {message && <p className="success-message">{message}</p>}
      <section className="attention-summary">
        <article>
          <small>Needs you</small>
          <strong>{loading ? "—" : attentionCount}</strong>
          <span>
            {attentionCount
              ? "Open items across your workspace"
              : "You’re all caught up"}
          </span>
        </article>
        <article>
          <small>Signatures</small>
          <strong>{loading ? "—" : signatures.length}</strong>
          <span>
            {signatures.length ? "Ready for review" : "Nothing waiting"}
          </span>
        </article>
        <article>
          <small>Past due</small>
          <strong>
            {loading ? "—" : dueActions.length + overdueInvoices.length}
          </strong>
          <span>
            {dueActions.length + overdueInvoices.length
              ? "Worth handling first"
              : "Nothing overdue"}
          </span>
        </article>
      </section>
      {signatures.length > 0 && (
        <section className="panel attention-section priority">
          <div className="section-head">
            <div>
              <p className="eyebrow">Documents</p>
              <h2>Ready for your review</h2>
            </div>
            <span className="attention-count">{signatures.length}</span>
          </div>
          <div className="attention-list">
            {signatures.map((r) => (
              <article className="attention-item" key={r.id}>
                <div className="attention-mark">✦</div>
                <div>
                  <b>{documentName(r.document_id)}</b>
                  <small>
                    {r.signature_kind === "signature"
                      ? "Signature required"
                      : "Acknowledgment required"}
                    {projectName(r.project_id)
                      ? " · " + projectName(r.project_id)
                      : ""}{" "}
                    · Requested {date(r.requested_at)}
                  </small>
                </div>
                <button
                  className="primary inline"
                  onClick={() => navigate("/documents/" + r.id)}
                >
                  Review →
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {open.length > 0 && (
        <section className="panel attention-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Requests</p>
              <h2>Things SRCcvde needs from you</h2>
            </div>
            <span className="attention-count">{open.length}</span>
          </div>
          <div className="attention-list">
            {open.map((a) => {
              const overdue = Boolean(
                a.due_at && new Date(a.due_at).getTime() < now,
              );
              return (
                <article
                  className={"attention-item " + (overdue ? "urgent" : "")}
                  key={a.id}
                >
                  <div className="attention-mark">{overdue ? "!" : "→"}</div>
                  <div>
                    <b>{a.title}</b>
                    <small>
                      {label(a.action_type)}
                      {projectName(a.project_id)
                        ? " · " + projectName(a.project_id)
                        : ""}
                      {a.due_at
                        ? " · " +
                          (overdue ? "Past due " : "Due ") +
                          date(a.due_at)
                        : ""}
                    </small>
                    {a.description && <p className="muted">{a.description}</p>}
                  </div>
                  <button
                    className="ghost"
                    disabled={busy === a.id}
                    onClick={() => complete(a)}
                  >
                    {busy === a.id ? "Saving…" : "Mark complete"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {invoices.some((inv) => remaining(inv) > 0) && (
        <section className="panel attention-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Billing</p>
              <h2>Open balances</h2>
            </div>
            <button className="ghost" onClick={() => navigate("/billing")}>
              Open billing →
            </button>
          </div>
          <div className="attention-list">
            {invoices
              .filter((inv) => remaining(inv) > 0)
              .map((inv) => {
                const overdue = Boolean(
                  inv.due_at && new Date(inv.due_at).getTime() < now,
                );
                return (
                  <article
                    className={"attention-item " + (overdue ? "urgent" : "")}
                    key={inv.id}
                  >
                    <div className="attention-mark">$</div>
                    <div>
                      <b>{money(remaining(inv), inv.currency)} remaining</b>
                      <small>
                        {inv.invoice_number}
                        {inv.projects?.name ? " · " + inv.projects.name : ""}
                        {inv.due_at
                          ? " · " +
                            (overdue ? "Past due " : "Due ") +
                            date(inv.due_at)
                          : ""}
                      </small>
                    </div>
                    <button
                      className="ghost"
                      onClick={() => navigate("/billing")}
                    >
                      View invoice →
                    </button>
                  </article>
                );
              })}
          </div>
        </section>
      )}
      {!loading && !attentionCount && (
        <section className="panel attention-clear">
          <span>✓</span>
          <div>
            <p className="eyebrow">All clear</p>
            <h2>You’re caught up.</h2>
            <p className="muted">
              There are no signatures, requests, or open balances waiting for
              you.
            </p>
          </div>
        </section>
      )}
      {done.length > 0 && (
        <section className="panel completed-actions">
          <div className="section-head">
            <div>
              <p className="eyebrow">Completed</p>
              <h2>Recent requests</h2>
            </div>
          </div>
          {done.slice(0, 8).map((a) => (
            <div className="doc-row" key={a.id}>
              <div>
                <b>{a.title}</b>
                <small>
                  {projectName(a.project_id)
                    ? projectName(a.project_id) + " · "
                    : ""}
                  Completed{a.completed_at ? " · " + date(a.completed_at) : ""}
                </small>
              </div>
              <StatusPill value="completed" />
            </div>
          ))}
        </section>
      )}
    </>
  );
}

export function ClientMessagesPage() {
  const DRAFT_KEY = "srccvde:client-message-draft";
  const readDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const [items, setItems] = useState<Communication[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [clientId, setClientId] = useState(""),
    [projectId, setProjectId] = useState(() => readDraft().projectId || ""),
    [body, setBody] = useState(() => readDraft().body || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (body.trim())
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ body, projectId }));
    else localStorage.removeItem(DRAFT_KEY);
  }, [body, projectId]);
  const load = async () => {
    const { data: cms, error: membershipError } = await supabase
      .from("client_memberships")
      .select("client_id")
      .limit(1);
    if (membershipError) {
      setMessage(membershipError.message);
      return;
    }
    const cid = cms?.[0]?.client_id || "";
    setClientId(cid);
    if (!cid) return;
    const [{ data: rows, error }, { data: ps }] = await Promise.all([
      supabase
        .from("client_communications")
        .select("*")
        .eq("client_id", cid)
        .eq("client_visible", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("projects")
        .select("*")
        .eq("client_id", cid)
        .order("created_at", { ascending: false }),
    ]);
    if (error) setMessage(error.message);
    else setItems((rows || []) as Communication[]);
    const projects = (ps || []) as Project[];
    setProjects(projects);
    setProjectId(
      (current: string) =>
        current ||
        projects.find((p) => !["completed", "archived"].includes(p.status))
          ?.id ||
        projects[0]?.id ||
        "",
    );
  };
  useEffect(() => {
    load();
  }, []);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !clientId || (!projectId && projects.length)) return;
    setBusy(true);
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_communications").insert({
      client_id: clientId,
      project_id: projectId || null,
      channel: "portal",
      direction: "inbound",
      subject: null,
      body: body.trim(),
      created_by: user?.id || null,
      client_visible: true,
      delivery_status: "logged",
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      localStorage.removeItem(DRAFT_KEY);
      setBody("");
      await supabase.functions.invoke("dispatch-notifications");
      await load();
    }
  }
  const visible =
    projects.length > 1
      ? items.filter((c) => c.project_id === projectId || !c.project_id)
      : items;
  const projectName = (id: any) => projects.find((p) => p.id === id)?.name;
  return (
    <>
      <PageTitle
        eyebrow="Messages"
        title="Conversation"
        copy="Keep each project conversation attached to the work it belongs to."
      />
      {message && <p className="success-message">{message}</p>}
      {projects.length > 1 && (
        <section className="panel message-project-picker">
          <label>
            Project conversation
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <section className="panel communications-panel">
        <div className="communication-history">
          {visible.length ? (
            visible.map((c) => (
              <article
                className={
                  "communication-row " +
                  (c.direction === "inbound"
                    ? "client-message"
                    : "staff-message")
                }
                key={c.id}
              >
                <div className="communication-meta">
                  <span className="communication-channel">
                    {c.direction === "inbound" ? "You" : label(c.channel)}
                  </span>
                  <small>
                    {date(c.created_at)}
                    {projects.length > 1 && c.project_id
                      ? " · " + projectName(c.project_id)
                      : ""}
                  </small>
                </div>
                <div>
                  {c.subject && <b>{c.subject}</b>}
                  <p>{c.body}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="communication-empty">
              <b>No messages yet</b>
              <p>This project conversation will appear here.</p>
            </div>
          )}
        </div>
        <form className="communication-form" onSubmit={send}>
          <label>
            Reply
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message to SRCcvde…"
              required
              maxLength={5000}
            />
          </label>
          <div className="communication-form-footer">
            <small>{body.length}/5000</small>
            <button className="primary inline" disabled={busy || !body.trim()}>
              {busy ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

export function ClientDeliverablesPage() {
  const [items, setItems] = useState<any[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [clientId, setClientId] = useState(""),
    [projectId, setProjectId] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState("branding"),
    [file, setFile] = useState<File | null>(null),
    [view, setView] = useState("all"),
    [query, setQuery] = useState("");
  const load = async () => {
    const { data: cms } = await supabase
      .from("client_memberships")
      .select("client_id")
      .limit(1);
    const cid = cms?.[0]?.client_id || "";
    setClientId(cid);
    if (!cid) return;
    const [{ data: projectRows }, { data, error }] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("client_id", cid)
        .order("created_at"),
      supabase
        .from("project_deliverables")
        .select("*")
        .eq("client_id", cid)
        .eq("client_visible", true)
        .order("created_at", { ascending: false }),
    ]);
    setProjects((projectRows || []) as Project[]);
    setProjectId((current) => current || projectRows?.[0]?.id || "");
    if (error) setMessage(error.message);
    else setItems(data || []);
  };
  useEffect(() => {
    load();
  }, []);
  async function download(item: any) {
    setBusy(item.id);
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "project-file-download",
      { body: { deliverable_id: item.id } },
    );
    setBusy("");
    if (error || !data?.url) {
      setMessage(data?.error || error?.message || "Could not open this file.");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file || !clientId || !projectId) return;
    const validation = validateProjectFile(file);
    if (validation) return setMessage(validation);
    setBusy("upload");
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path =
      clientId + "/" + projectId + "/client/" + Date.now() + "-" + safe;
    const { error: uploadError } = await supabase.storage
      .from("project-deliverables")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
    if (uploadError) {
      setBusy("");
      setMessage(uploadError.message);
      return;
    }
    const { error } = await supabase.from("project_deliverables").insert({
      client_id: clientId,
      project_id: projectId,
      name: name.trim() || file.name,
      description: description.trim() || null,
      storage_bucket: "project-deliverables",
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      byte_size: file.size,
      version: 1,
      client_visible: true,
      created_by: user?.id || null,
      source: "client",
      category,
    });
    setBusy("");
    if (error) {
      await supabase.storage.from("project-deliverables").remove([path]);
      setMessage(error.message);
      return;
    }
    setName("");
    setDescription("");
    setFile(null);
    setMessage("File shared with SRCcvde.");
    load();
  }
  const visibleItems = items.filter((item) => {
    const q = query.trim().toLowerCase();
    return (
      (view === "all" || item.source === view) &&
      (!projectId || item.project_id === projectId) &&
      (!q ||
        [item.name, item.file_name, item.description, item.category].some((v) =>
          (v || "").toLowerCase().includes(q),
        ))
    );
  });
  return (
    <>
      <PageTitle
        eyebrow="Project files"
        title="Shared workspace"
        copy="Download SRCcvde deliverables or share branding, content, references and other project files with your team."
      />
      {message && <p className="success-message">{message}</p>}
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Project</p>
            <h2>Choose workspace</h2>
            <p className="section-copy">
              Files stay organized inside the project they belong to.
            </p>
          </div>
        </div>
        <label>
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Share with SRCcvde</p>
            <h2>Add a project file</h2>
            <p className="section-copy">
              Upload logos, brand guides, copy, references, documents or
              anything else we need for your project.
            </p>
          </div>
        </div>
        <form className="document-form" onSubmit={upload}>
          <div className="form-split">
            <label>
              File name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Brand logo package"
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="branding">Branding</option>
                <option value="content">Content</option>
                <option value="reference">Reference</option>
                <option value="document">Document</option>
                <option value="asset">Asset</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything SRCcvde should know about this file?"
            />
          </label>
          <label>
            Choose file
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.heic,.heif,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.mp4,.mov"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
          </label>
          <button
            className="primary"
            disabled={busy === "upload" || !file || !projectId}
          >
            {busy === "upload" ? "Uploading…" : "Share file"}
          </button>
        </form>
      </section>
      <section className="panel client-vault">
        <div className="section-head">
          <div>
            <p className="eyebrow">Project library</p>
            <h2>Shared files</h2>
          </div>
          <span className="status">{visibleItems.length}</span>
        </div>
        <div className="directory-tools">
          <label>
            Search files
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, category, notes…"
            />
          </label>
          <label>
            Show
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="all">All shared files</option>
              <option value="srccvde">Delivered by SRCcvde</option>
              <option value="client">Shared by me</option>
            </select>
          </label>
        </div>
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div className="doc-row vault-row" key={item.id}>
              <div>
                <b>{item.name}</b>
                <small>
                  {label(item.category || "deliverable")} ·{" "}
                  {item.source === "client"
                    ? "Shared by you"
                    : "Delivered by SRCcvde"}{" "}
                  · Version {item.version} · {date(item.created_at)}
                </small>
                {item.description && <p>{item.description}</p>}
              </div>
              <div className="vault-actions">
                <button
                  className="ghost"
                  disabled={busy === item.id}
                  onClick={() => download(item)}
                >
                  {busy === item.id ? "Opening…" : "Download"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <Empty>No project files match this view.</Empty>
        )}
      </section>
    </>
  );
}

export function ClientDocumentsPage({
  navigate,
}: {
  navigate: (p: string) => void;
}) {
  const [items, setItems] = useState<any[]>([]),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [view, setView] = useState("all"),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase.rpc("get_client_document_library");
      if (error) throw new Error();
      setItems((data || []) as any[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function openPdf(documentId: string, variant: "original" | "executed") {
    setBusy(documentId + variant);
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "client-document-download",
      { body: { document_id: documentId, variant } },
    );
    setBusy("");
    if (error || !data?.url) {
      setMessage(data?.error || error?.message || "Could not open this PDF.");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  const filteredItems = items.filter(
    ({ document: d, request: r, artifact: a }) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        [d.name, d.category, d.state, r?.status].some((v) =>
          (v || "").toLowerCase().includes(q),
        );
      const matchesView =
        view === "all" ||
        (view === "action" && r?.status === "pending") ||
        (view === "completed" &&
          (r?.status === "signed" || d.state === "final")) ||
        (view === "pdf" && !!a);
      return matchesQuery && matchesView;
    },
  );
  return (
    <>
      <PageTitle
        eyebrow="Documents"
        title="Your document vault"
        copy="Review active requests and access every document SRCcvde has shared with you."
      />
      {message && <p className="success-message">{message}</p>}
      <section className="panel client-vault">
        <div className="directory-tools">
          <label>
            Search documents
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, category, or status…"
            />
          </label>
          <label>
            View
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="all">All documents</option>
              <option value="action">Needs my action</option>
              <option value="completed">Completed</option>
              <option value="pdf">PDF available</option>
            </select>
          </label>
          <span className="directory-count">
            {loading
              ? "Loading…"
              : `${filteredItems.length} of ${items.length}`}
          </span>
        </div>
        <LoadState
          loading={loading}
          error={loadError ? "Could not load your documents. Try again." : null}
          onRetry={load}
          loadingText="Loading your documents…"
        />
        {!loading && !loadError && items.length
          ? filteredItems.map(({ document: d, request: r, artifact: a }) => (
              <div className="doc-row vault-row" key={d.id}>
                <div>
                  <b>{d.name}</b>
                  <small>
                    {label(d.category)} · {r ? label(r.status) : label(d.state)}
                  </small>
                </div>
                <div className="vault-actions">
                  {r?.status === "pending" && (
                    <button
                      className="ghost"
                      onClick={() => navigate("/documents/" + r.id)}
                    >
                      Review
                    </button>
                  )}
                  {r && (
                    <button
                      className="ghost"
                      onClick={() => navigate("/documents/" + r.id)}
                    >
                      View
                    </button>
                  )}
                  {a?.original_storage_path && (
                    <button
                      className="ghost"
                      disabled={busy === d.id + "original"}
                      onClick={() => openPdf(d.id, "original")}
                    >
                      {busy === d.id + "original" ? "Opening…" : "Original PDF"}
                    </button>
                  )}
                  {a?.storage_path && (
                    <button
                      className="ghost"
                      disabled={busy === d.id + "executed"}
                      onClick={() => openPdf(d.id, "executed")}
                    >
                      {busy === d.id + "executed" ? "Opening…" : "Executed PDF"}
                    </button>
                  )}
                </div>
              </div>
            ))
          : null}
        {!loading && !loadError && !items.length && (
          <Empty>No documents have been shared with you yet.</Empty>
        )}
        {!loading &&
          !loadError &&
          items.length > 0 &&
          !filteredItems.length && <Empty>No documents match this view.</Empty>}
      </section>
    </>
  );
}
