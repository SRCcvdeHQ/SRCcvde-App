import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { projectStages, label } from "../shared/workspace";
import type { Project, Milestone } from "../shared/workspace";
import {
  PageTitle,
  StatusPill,
  Empty,
  LoadState,
} from "../components/WorkspaceLayout";

export function ProjectsPage() {
  const [rows, setRows] = useState<Project[]>([]),
    [selected, setSelected] = useState<Project | null>(null),
    [milestones, setMilestones] = useState<Milestone[]>([]),
    [projectMilestones, setProjectMilestones] = useState<Milestone[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [newTitle, setNewTitle] = useState(""),
    [newDescription, setNewDescription] = useState(""),
    [query, setQuery] = useState(""),
    [projectFilter, setProjectFilter] = useState(
      () => new URLSearchParams(location.search).get("view") || "active",
    ),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [p, m] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("project_milestones").select("*"),
      ]);
      if (p.error || m.error) throw new Error();
      setRows((p.data || []) as Project[]);
      setProjectMilestones((m.data || []) as Milestone[]);
      if (selected) {
        const fresh = (p.data || []).find((v: any) => v.id === selected.id);
        if (fresh) setSelected(fresh as Project);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  async function openProject(p: Project) {
    setSelected(p);
    setMessage("");
    const { data } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", p.id)
      .order("position");
    setMilestones((data || []) as Milestone[]);
  }
  async function updateProject(patch: Partial<Project>) {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", selected.id);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage("Project workspace updated.");
      await load();
    }
  }
  async function updateMilestone(id: string, patch: Partial<Milestone>) {
    setBusy(true);
    setMessage("");
    const target = milestones.find((m) => m.id === id);
    let error: any = null;
    if (patch.status && target) {
      const updates = milestones
        .map((m) => {
          if (m.id === id)
            return supabase
              .from("project_milestones")
              .update({
                ...patch,
                completed_at:
                  patch.status === "completed"
                    ? m.completed_at || new Date().toISOString()
                    : null,
              })
              .eq("id", m.id);
          if (patch.status === "current" && m.status === "current")
            return supabase
              .from("project_milestones")
              .update({ status: "upcoming" })
              .eq("id", m.id);
          return null;
        })
        .filter(Boolean) as any[];
      if (patch.status === "completed") {
        const next = milestones.find(
          (m) => m.position > target.position && m.status === "upcoming",
        );
        if (next)
          updates.push(
            supabase
              .from("project_milestones")
              .update({ status: "current" })
              .eq("id", next.id),
          );
      }
      const results = await Promise.all(updates);
      error = results.find((x: any) => x.error)?.error || null;
    } else {
      const result = await supabase
        .from("project_milestones")
        .update(patch)
        .eq("id", id);
      error = result.error;
    }
    setBusy(false);
    if (error) setMessage(error.message);
    else if (selected) {
      setMessage(
        patch.status === "completed"
          ? "Milestone completed. The roadmap advanced automatically."
          : "Milestone updated.",
      );
      await openProject(selected);
    }
  }
  async function addMilestone(e: FormEvent) {
    e.preventDefault();
    if (!selected || !newTitle.trim()) return;
    setBusy(true);
    setMessage("");
    const next = milestones.length
      ? Math.max(...milestones.map((m) => m.position)) + 1
      : 1;
    const { error } = await supabase.from("project_milestones").insert({
      project_id: selected.id,
      milestone_key: "custom_" + Date.now(),
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      position: next,
      status: "upcoming",
      client_visible: true,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setNewTitle("");
      setNewDescription("");
      setMessage("Milestone added to the roadmap.");
      await openProject(selected);
    }
  }
  async function removeMilestone(m: Milestone) {
    if (
      !selected ||
      !confirm('Remove "' + m.title + '" from this project roadmap?')
    )
      return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("project_milestones")
      .delete()
      .eq("id", m.id);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage("Milestone removed.");
      await openProject(selected);
    }
  }
  const filteredProjects = rows.filter((p) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      [p.name, p.project_type, p.phase, p.status].some((v) =>
        (v || "").toLowerCase().includes(q),
      );
    const pm = projectMilestones.filter((m) => m.project_id === p.id);
    const hasOverdue = pm.some(
      (m) =>
        m.due_at &&
        new Date(m.due_at).getTime() < Date.now() &&
        m.status !== "completed",
    );
    const hasBlocked = pm.some((m) => m.status === "blocked");
    const matchesFilter =
      projectFilter === "all" ||
      (projectFilter === "active" &&
        ["planning", "active", "launching"].includes(p.status)) ||
      (projectFilter === "overdue" && hasOverdue) ||
      (projectFilter === "blocked" && hasBlocked) ||
      p.status === projectFilter;
    return matchesQuery && matchesFilter;
  });
  const selectedMilestoneProgress = milestones.length
    ? Math.round(
        (milestones.filter((m) => m.status === "completed").length /
          milestones.length) *
          100,
      )
    : selected?.progress || 0;
  if (selected)
    return (
      <>
        <button
          className="back"
          onClick={() => {
            setSelected(null);
            setMilestones([]);
          }}
        >
          ← Projects
        </button>
        <PageTitle
          eyebrow="Delivery control"
          title={selected.name}
          copy="Manage what the client sees in their live project workspace."
        />
        {message && <p className="success-message">{message}</p>}
        <section className="panel project-control">
          <div className="section-head">
            <div>
              <p className="eyebrow">Project status</p>
              <h2>Workspace controls</h2>
            </div>
            <StatusPill value={selected.status} />
          </div>
          <div className="project-control-grid">
            <label>
              Phase
              <select
                value={selected.phase}
                disabled={busy}
                onChange={(e) => {
                  setSelected({ ...selected, phase: e.target.value });
                  updateProject({ phase: e.target.value });
                }}
              >
                {projectStages.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={selected.status}
                disabled={busy}
                onChange={(e) => {
                  setSelected({ ...selected, status: e.target.value });
                  updateProject({ status: e.target.value });
                }}
              >
                {[
                  "planning",
                  "active",
                  "on_hold",
                  "launching",
                  "completed",
                  "archived",
                ].map((x) => (
                  <option key={x} value={x}>
                    {label(x)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Progress <strong>{selectedMilestoneProgress}%</strong>
              <div className="progress">
                <i style={{ width: selectedMilestoneProgress + "%" }} />
              </div>
              <small>Calculated automatically from completed milestones.</small>
            </label>
          </div>
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Client roadmap</p>
              <h2>Milestones</h2>
            </div>
            <span className="status">
              {milestones.filter((m) => m.status === "completed").length}/
              {milestones.length} complete
            </span>
          </div>
          <div className="admin-milestones">
            {milestones.map((m, i) => (
              <div className="admin-milestone" key={m.id}>
                <div>
                  <b>
                    {String(i + 1).padStart(2, "0")} · {m.title}
                  </b>
                  <small>
                    {m.description || "No description"}
                    {m.status === "blocked"
                      ? " · Blocked"
                      : m.due_at &&
                          new Date(m.due_at).getTime() < Date.now() &&
                          m.status !== "completed"
                        ? " · Overdue"
                        : ""}
                  </small>
                </div>
                <label>
                  Status
                  <select
                    value={m.status}
                    disabled={busy}
                    onChange={(e) =>
                      updateMilestone(m.id, {
                        status: e.target.value,
                        completed_at:
                          e.target.value === "completed"
                            ? new Date().toISOString()
                            : null,
                      })
                    }
                  >
                    {["upcoming", "current", "completed", "blocked"].map(
                      (x) => (
                        <option key={x} value={x}>
                          {label(x)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Due
                  <input
                    type="date"
                    value={m.due_at ? m.due_at.slice(0, 10) : ""}
                    disabled={busy}
                    onChange={(e) =>
                      updateMilestone(m.id, {
                        due_at: e.target.value
                          ? new Date(e.target.value + "T12:00:00").toISOString()
                          : null,
                      })
                    }
                  />
                </label>
                <label className="visibility-check">
                  <input
                    type="checkbox"
                    checked={m.client_visible}
                    disabled={busy}
                    onChange={(e) =>
                      updateMilestone(m.id, {
                        client_visible: e.target.checked,
                      })
                    }
                  />{" "}
                  Client visible
                </label>
                <div className="milestone-actions">
                  {m.milestone_key.startsWith("custom_") && (
                    <button
                      className="ghost danger-action"
                      disabled={busy}
                      onClick={() => removeMilestone(m)}
                    >
                      Remove custom milestone
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!milestones.length && (
            <Empty>No milestones have been created for this project yet.</Empty>
          )}
          <form className="milestone-create" onSubmit={addMilestone}>
            <div>
              <p className="eyebrow">Add milestone</p>
              <h3>Extend the roadmap</h3>
            </div>
            <label>
              Title
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Client review"
                required
                maxLength={120}
              />
            </label>
            <label>
              Description
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What happens at this stage"
                maxLength={300}
              />
            </label>
            <button
              className="primary inline"
              disabled={busy || !newTitle.trim()}
            >
              Add milestone
            </button>
          </form>
        </section>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="Delivery"
        title="Projects"
        copy="Every active build, its phase and current progress."
      />
      <section className="panel project-directory">
        <div className="directory-tools">
          <label>
            Search projects
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, type, phase, or status…"
            />
          </label>
          <label>
            View
            <select
              value={projectFilter}
              onChange={(e) => {
                const v = e.target.value;
                setProjectFilter(v);
                const u = new URL(location.href);
                if (v === "active") u.searchParams.delete("view");
                else u.searchParams.set("view", v);
                history.replaceState({}, "", u.pathname + u.search);
              }}
            >
              <option value="active">Active work</option>
              <option value="all">All projects</option>
              <option value="overdue">Overdue milestones</option>
              <option value="blocked">Blocked milestones</option>
              <option value="planning">Planning</option>
              <option value="on_hold">On hold</option>
              <option value="launching">Launching</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <span className="directory-count">
            {loading
              ? "Loading…"
              : `${filteredProjects.length} of ${rows.length}`}
          </span>
        </div>
        <LoadState
          loading={loading}
          error={loadError ? "Could not load projects. Try again." : null}
          onRetry={load}
          loadingText="Loading projects…"
        />
        {!loading &&
          !loadError &&
          filteredProjects.map((p) => {
            const pm = projectMilestones.filter((m) => m.project_id === p.id);
            const complete = pm.filter((m) => m.status === "completed").length;
            const progress = pm.length
              ? Math.round((complete / pm.length) * 100)
              : p.progress;
            const blocked = pm.filter((m) => m.status === "blocked").length;
            const overdue = pm.filter(
              (m) =>
                m.due_at &&
                new Date(m.due_at).getTime() < Date.now() &&
                m.status !== "completed",
            ).length;
            return (
              <button
                className="project-row project-row-button"
                key={p.id}
                onClick={() => openProject(p)}
              >
                <div>
                  <b>{p.name}</b>
                  <small>
                    {p.project_type || "Custom project"} · {label(p.phase)}
                    {pm.length
                      ? " · " + complete + "/" + pm.length + " milestones"
                      : ""}
                    {blocked ? " · " + blocked + " blocked" : ""}
                    {overdue ? " · " + overdue + " overdue" : ""}
                  </small>
                </div>
                <div className="progress">
                  <i style={{ width: progress + "%" }} />
                </div>
                <strong>{progress}%</strong>
                <StatusPill value={p.status} />
              </button>
            );
          })}
        {!loading &&
          !loadError &&
          (!rows.length ? (
            <Empty>No projects yet.</Empty>
          ) : (
            !filteredProjects.length && (
              <Empty>No projects match this view.</Empty>
            )
          ))}
      </section>
    </>
  );
}
