import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { label, date } from "../shared/workspace";
import type { Activity } from "../shared/workspace";
import { PageTitle, LoadState, Empty } from "../components/WorkspaceLayout";

export function ActivityPage() {
  const [rows, setRows] = useState<Activity[]>([]),
    [query, setQuery] = useState(""),
    [action, setAction] = useState("all"),
    [range, setRange] = useState("30"),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from("crm_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error();
      setRows((data || []) as Activity[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const actions = Array.from(
    new Set(rows.map((r) => r.action).filter(Boolean)),
  ).sort();
  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86400000;
    const matchesRange = !cutoff || new Date(r.created_at).getTime() >= cutoff;
    return (
      matchesRange &&
      (action === "all" || r.action === action) &&
      (!q ||
        [r.summary, r.action, r.entity_type].some((v) =>
          (v || "").toLowerCase().includes(q),
        ))
    );
  });
  return (
    <>
      <PageTitle
        eyebrow="Audit trail"
        title="Activity"
        copy="A timestamped history of meaningful CRM and client actions."
      />
      <section className="panel activity-tools">
        <div className="directory-tools">
          <label>
            Search activity
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Action, summary, or record type…"
            />
          </label>
          <label>
            Action
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">All activity</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {label(a)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time range
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All loaded</option>
            </select>
          </label>
          <span className="directory-count">
            {loading ? "Loading…" : `${filtered.length} of ${rows.length}`}
          </span>
        </div>
      </section>
      <LoadState
        loading={loading}
        error={loadError ? "Could not load activity. Try again." : null}
        onRetry={load}
        loadingText="Loading activity…"
      />
      {!loading && !loadError && <ActivityFeed rows={filtered} />}
    </>
  );
}

export function ActivityFeed({ rows }: { rows: Activity[] }) {
  return (
    <section className="panel activity-panel">
      <p className="eyebrow">Activity</p>
      {rows.length ? (
        rows.map((a) => (
          <div className="activity-item" key={a.id}>
            <i />
            <div>
              <b>{a.summary}</b>
              <small>
                {date(a.created_at)} · {label(a.action)}
              </small>
            </div>
          </div>
        ))
      ) : (
        <Empty>No activity yet.</Empty>
      )}
    </section>
  );
}
