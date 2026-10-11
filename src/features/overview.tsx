import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Profile, Inquiry } from "../shared/workspace";
import { Empty, Avatar, StatusPill } from "../components/WorkspaceLayout";

export function AdminOverview({
  profile,
  navigate,
}: {
  profile: Profile | null;
  navigate: (p: string) => void;
}) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]),
    [clients, setClients] = useState(0),
    [projects, setProjects] = useState(0),
    [pendingDocs, setPendingDocs] = useState(0),
    [blockedMilestones, setBlockedMilestones] = useState(0),
    [archiveIssues, setArchiveIssues] = useState(0),
    [overdueMilestones, setOverdueMilestones] = useState(0),
    [overdueInvoices, setOverdueInvoices] = useState(0),
    [failedNotifications, setFailedNotifications] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      supabase
        .from("project_inquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .in("status", ["onboarding", "active"]),
      supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .in("status", ["planning", "active", "launching"]),
      supabase
        .from("signature_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("project_milestones")
        .select("*", { count: "exact", head: true })
        .eq("status", "blocked"),
      supabase
        .from("executed_document_artifacts")
        .select("*", { count: "exact", head: true })
        .eq("drive_sync_status", "failed"),
      supabase
        .from("project_milestones")
        .select("*", { count: "exact", head: true })
        .lt("due_at", new Date().toISOString())
        .neq("status", "completed"),
      supabase
        .from("billing_invoices")
        .select("*", { count: "exact", head: true })
        .in("status", ["sent", "overdue"])
        .lt("due_at", new Date().toISOString()),
      supabase
        .from("notification_outbox")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed"),
    ]).then(([i, c, p, d, m, a, o, b, n]) => {
      setInquiries((i.data || []) as Inquiry[]);
      setClients(c.count || 0);
      setProjects(p.count || 0);
      setPendingDocs(d.count || 0);
      setBlockedMilestones(m.count || 0);
      setArchiveIssues(a.count || 0);
      setOverdueMilestones(o.count || 0);
      setOverdueInvoices(b.count || 0);
      setFailedNotifications(n.count || 0);
      setLoading(false);
    });
  }, []);
  const first = profile?.full_name ? " " + profile.full_name.split(" ")[0] : "",
    newLeads = inquiries.filter((x) => x.status === "new").length;
  const attentionTotal =
    pendingDocs +
    blockedMilestones +
    archiveIssues +
    overdueMilestones +
    overdueInvoices +
    failedNotifications;
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Command center</p>
          <h1>Good to see you{first}.</h1>
        </div>
        <span className="live-dot">Live workspace</span>
      </header>
      <section className="metric-grid">
        <article>
          <small>New inquiries</small>
          <strong>{loading ? "—" : newLeads}</strong>
          <span>recent queue</span>
        </article>
        <article>
          <small>Active clients</small>
          <strong>{loading ? "—" : clients}</strong>
          <span>onboarding + active</span>
        </article>
        <article>
          <small>Active projects</small>
          <strong>{loading ? "—" : projects}</strong>
          <span>current workspaces</span>
        </article>
        <article className={attentionTotal ? "metric-attention" : ""}>
          <small>Needs attention</small>
          <strong>{loading ? "—" : attentionTotal}</strong>
          <span>
            {attentionTotal ? "operational items" : "all systems clear"}
          </span>
        </article>
      </section>
      <section className="command-attention">
        <div className="section-head">
          <div>
            <p className="eyebrow">Attention center</p>
            <h2>
              {loading
                ? "Checking the workspace…"
                : attentionTotal
                  ? attentionTotal +
                    " item" +
                    (attentionTotal === 1 ? "" : "s") +
                    " worth a look"
                  : "Workspace is clear."}
            </h2>
          </div>
          <span
            className={
              "attention-health " + (attentionTotal ? "needs-work" : "clear")
            }
          >
            {attentionTotal ? "Review queue" : "All clear"}
          </span>
        </div>
        <div className="attention-grid expanded">
          <button onClick={() => navigate("/documents?view=pending")}>
            <small>Pending signatures</small>
            <strong>{loading ? "—" : pendingDocs}</strong>
            <span>
              {pendingDocs ? "Open signing room →" : "Nothing waiting"}
            </span>
          </button>
          <button onClick={() => navigate("/projects?view=blocked")}>
            <small>Blocked milestones</small>
            <strong>{loading ? "—" : blockedMilestones}</strong>
            <span>
              {blockedMilestones ? "Review delivery →" : "Roadmaps clear"}
            </span>
          </button>
          <button onClick={() => navigate("/projects?view=overdue")}>
            <small>Overdue milestones</small>
            <strong>{loading ? "—" : overdueMilestones}</strong>
            <span>
              {overdueMilestones ? "Review schedule →" : "Schedule clear"}
            </span>
          </button>
          <button onClick={() => navigate("/billing")}>
            <small>Overdue invoices</small>
            <strong>{loading ? "—" : overdueInvoices}</strong>
            <span>
              {overdueInvoices ? "Open billing →" : "Accounts current"}
            </span>
          </button>
          <button onClick={() => navigate("/documents?view=attention")}>
            <small>Archive attention</small>
            <strong>{loading ? "—" : archiveIssues}</strong>
            <span>
              {archiveIssues ? "Review failed sync →" : "Archive healthy"}
            </span>
          </button>
          <button onClick={() => navigate("/notifications")}>
            <small>Notification failures</small>
            <strong>{loading ? "—" : failedNotifications}</strong>
            <span>
              {failedNotifications ? "Review delivery →" : "Delivery healthy"}
            </span>
          </button>
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">CRM</p>
            <h2>Latest inquiries</h2>
          </div>
          <button className="ghost" onClick={() => navigate("/leads")}>
            View pipeline →
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading inquiries…</p>
        ) : inquiries.length === 0 ? (
          <Empty>No inquiries yet.</Empty>
        ) : (
          <div className="lead-list">
            {inquiries.map((x) => (
              <button
                className="lead-row"
                key={x.id}
                onClick={() => navigate("/leads/" + x.id)}
              >
                <Avatar name={x.name} />
                <div>
                  <b>{x.name}</b>
                  <small>{x.company || x.email}</small>
                </div>
                <span>{x.project_type}</span>
                <StatusPill value={x.status} />
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
