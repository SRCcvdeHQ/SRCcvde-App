import { label } from "../shared/workspace";
import type { Role } from "../shared/workspace";

export function Brand() {
  return (
    <a
      className="brand"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        history.pushState({}, "", "/");
        dispatchEvent(new PopStateEvent("popstate"));
      }}
      aria-label="SRCcvde workspace"
    >
      <span>SRC</span>cvde
      <i />
    </a>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <div className="avatar">
      {name
        .split(/\s+/)
        .map((x) => x[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </div>
  );
}

export function Empty({ children }: { children: string }) {
  return <div className="empty">{children}</div>;
}

export function LoadState({
  loading,
  error,
  onRetry,
  loadingText,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void | Promise<void>;
  loadingText: string;
}) {
  if (loading)
    return (
      <p className="muted" role="status">
        {loadingText}
      </p>
    );
  if (error)
    return (
      <div className="load-error" role="alert">
        <span>{error}</span>
        <button
          className="ghost inline"
          onClick={() => {
            void onRetry();
          }}
        >
          Try again
        </button>
      </div>
    );
  return null;
}

export function StatusPill({ value }: { value: string }) {
  const copy = value === "partial_paid" ? "Partially paid" : label(value);
  return <span className={"pill " + value}>{copy}</span>;
}

export function Sidebar({
  role,
  current,
  navigate,
  onSignOut,
  mobileOpen = false,
  onNavigate,
}: {
  role: Role;
  current: string;
  navigate: (p: string) => void;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}) {
  const admin = role !== "client";
  const items = admin
    ? [
        ["Overview", "/"],
        ["Leads", "/leads"],
        ["Clients", "/clients"],
        ["Projects", "/projects"],
        ["Handoffs", "/handoffs"],
        ["Documents", "/documents"],
        ["Billing", "/billing"],
        ["Activity", "/activity"],
        ["Notifications", "/notifications"],
      ]
    : [
        ["Overview", "/"],
        ["Project", "/project"],
        ["Actions", "/actions"],
        ["Messages", "/messages"],
        ["Deliverables", "/deliverables"],
        ["Handoff", "/handoff"],
        ["Billing", "/billing"],
        ["Documents", "/documents"],
        ["Activity", "/activity"],
        ["Notifications", "/notifications"],
      ];
  return (
    <aside
      id="workspace-navigation"
      aria-label="Workspace navigation"
      className={"sidebar" + (mobileOpen ? " mobile-open" : "")}
    >
      <Brand />
      <nav>
        {items.map(([name, p]) => (
          <button
            aria-current={
              (p === "/" ? current === "/" : current.startsWith(p))
                ? "page"
                : undefined
            }
            className={
              (p === "/" ? current === "/" : current.startsWith(p))
                ? "active"
                : ""
            }
            onClick={() => {
              navigate(p);
              onNavigate?.();
            }}
            key={p}
          >
            <span aria-hidden="true">{name[0]}</span>
            {name}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <small>{admin ? "SRCcvde team" : "Client workspace"}</small>
        <button onClick={onSignOut}>Sign out</button>
      </div>
    </aside>
  );
}

export function PageTitle({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  );
}

export function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <small>{k}</small>
      <b>{v}</b>
    </div>
  );
}

export function RecordCard({
  title,
  count,
  detail,
}: {
  title: string;
  count: number;
  detail: string;
}) {
  return (
    <article>
      <small>{title}</small>
      <strong>{count}</strong>
      <span>{detail}</span>
    </article>
  );
}
