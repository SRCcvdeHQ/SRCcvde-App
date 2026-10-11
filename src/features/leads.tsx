import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { leadStatuses, label, date } from "../shared/workspace";
import type { Inquiry, Note, Activity } from "../shared/workspace";
import {
  PageTitle,
  Avatar,
  StatusPill,
  Fact,
} from "../components/WorkspaceLayout";
import { ActivityFeed } from "./activity";

export function LeadsPage({ navigate }: { navigate: (p: string) => void }) {
  const [leads, setLeads] = useState<Inquiry[]>([]),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [stage, setStage] = useState("all");
  useEffect(() => {
    supabase
      .from("project_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setLeads((data || []) as Inquiry[]);
        setLoading(false);
      });
  }, []);
  const visibleLeads = leads.filter((x) => {
    const q = query.trim().toLowerCase();
    const matchesStage =
      stage === "all" ||
      x.status === stage ||
      (stage === "closed" && ["won", "lost", "archived"].includes(x.status));
    return (
      matchesStage &&
      (!q ||
        [x.name, x.company, x.email, x.project_type, x.details].some((v) =>
          (v || "").toLowerCase().includes(q),
        ))
    );
  });
  return (
    <>
      <PageTitle
        eyebrow="CRM"
        title="Leads"
        copy="Every project inquiry, from first hello to signed client."
      />
      <section className="panel lead-tools">
        <div className="directory-tools">
          <label>
            Search pipeline
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, company, email, or project…"
            />
          </label>
          <label>
            Stage
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="all">All stages</option>
              {leadStatuses.slice(0, 5).map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
              <option value="closed">Closed & archived</option>
            </select>
          </label>
          <span className="directory-count">
            {visibleLeads.length} of {leads.length}
          </span>
        </div>
      </section>
      <div className="pipeline">
        {leadStatuses.slice(0, 5).map((status) => (
          <section className="pipeline-col" key={status}>
            <div className="pipeline-head">
              <b>{label(status)}</b>
              <span>
                {visibleLeads.filter((x) => x.status === status).length}
              </span>
            </div>
            {visibleLeads
              .filter((x) => x.status === status)
              .map((x) => (
                <button
                  className="lead-card"
                  key={x.id}
                  onClick={() => navigate("/leads/" + x.id)}
                >
                  <div>
                    <Avatar name={x.name} />
                    <span>
                      <b>{x.name}</b>
                      <small>{x.company || x.project_type}</small>
                    </span>
                  </div>
                  <p>{x.details}</p>
                  <footer>
                    <small>{date(x.created_at)}</small>
                    <small>{x.budget_range}</small>
                  </footer>
                </button>
              ))}
            {!loading && !visibleLeads.some((x) => x.status === status) && (
              <div className="pipeline-empty">Nothing here</div>
            )}
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="section-head">
          <h2>Closed & archived</h2>
          <span className="status">
            {
              visibleLeads.filter((x) =>
                ["won", "lost", "archived"].includes(x.status),
              ).length
            }
          </span>
        </div>
        <div className="compact-list">
          {visibleLeads
            .filter((x) => ["won", "lost", "archived"].includes(x.status))
            .map((x) => (
              <button key={x.id} onClick={() => navigate("/leads/" + x.id)}>
                <span>{x.name}</span>
                <StatusPill value={x.status} />
              </button>
            ))}
        </div>
      </section>
    </>
  );
}

export function LeadDetail({
  id,
  navigate,
}: {
  id: string;
  navigate: (p: string) => void;
}) {
  const [lead, setLead] = useState<Inquiry | null>(null),
    [notes, setNotes] = useState<Note[]>([]),
    [activity, setActivity] = useState<Activity[]>([]),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = async () => {
    const [l, n, a] = await Promise.all([
      supabase.from("project_inquiries").select("*").eq("id", id).single(),
      supabase
        .from("lead_notes")
        .select("id,body,created_at")
        .eq("inquiry_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_activity")
        .select("*")
        .eq("entity_type", "lead")
        .eq("entity_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setLead(l.data as Inquiry);
    setNotes((n.data || []) as Note[]);
    setActivity((a.data || []) as Activity[]);
  };
  useEffect(() => {
    load();
  }, [id]);
  async function changeStatus(status: string) {
    if (!lead) return;
    setBusy(true);
    const { error } = await supabase
      .from("project_inquiries")
      .update({ status })
      .eq("id", id);
    setBusy(false);
    if (error) setMessage(error.message);
    else load();
  }
  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("lead_notes")
      .insert({ inquiry_id: id, body: note.trim() });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setNote("");
      load();
    }
  }
  async function inviteApplicant() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke(
      "invite-applicant",
      { body: { inquiry_id: id } },
    );
    setBusy(false);
    setMessage(
      error
        ? error.message
        : data?.invitation_sent
          ? "Applicant portal invitation sent."
          : "Applicant account linked.",
    );
    if (!error) load();
  }
  async function convert() {
    if (!lead) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("convert_lead_to_client", {
      p_inquiry_id: id,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else navigate("/clients/" + data);
  }
  if (!lead) return <p className="muted">Loading lead…</p>;
  return (
    <>
      <button className="back" onClick={() => navigate("/leads")}>
        ← Leads
      </button>
      <header className="detail-head">
        <div className="identity">
          <Avatar name={lead.name} />
          <div>
            <p className="eyebrow">Lead</p>
            <h1>{lead.name}</h1>
            <p>{lead.company || lead.email}</p>
          </div>
        </div>
        <div className="detail-actions">
          <select
            value={lead.status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {leadStatuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <button className="ghost" disabled={busy} onClick={inviteApplicant}>
            Invite to applicant portal
          </button>
          {lead.status !== "won" && (
            <button
              className="primary inline"
              disabled={busy}
              onClick={convert}
            >
              Convert to client
            </button>
          )}
        </div>
      </header>
      {message && <p className="success-message">{message}</p>}
      <div className="detail-grid">
        <section className="panel flush">
          <p className="eyebrow">Project brief</p>
          <div className="facts">
            <Fact k="Email" v={lead.email} />
            <Fact k="Project type" v={lead.project_type} />
            <Fact k="Budget" v={lead.budget_range} />
            <Fact k="Timeline" v={lead.timeline} />
            <Fact k="Involvement" v={lead.involvement} />
            <Fact k="Received" v={date(lead.created_at)} />
          </div>
          <div className="brief">
            <small>What they want to build</small>
            <p>{lead.details}</p>
          </div>
        </section>
        <aside>
          <section className="panel flush">
            <p className="eyebrow">Internal notes</p>
            <form className="note-form" onSubmit={addNote}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a private note…"
                maxLength={5000}
              />
              <button className="primary" disabled={busy || !note.trim()}>
                Add note
              </button>
            </form>
            {notes.map((n) => (
              <div className="note" key={n.id}>
                <p>{n.body}</p>
                <small>{date(n.created_at)}</small>
              </div>
            ))}
          </section>
          <ActivityFeed rows={activity} />
        </aside>
      </div>
    </>
  );
}
