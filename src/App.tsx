import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { StaffMfa } from "./components/StaffMfa";
import { path, label } from "./shared/workspace";
import type { Profile, Membership } from "./shared/workspace";

import { Brand, Sidebar } from "./components/WorkspaceLayout";

import { Login, SetPassword, PendingAccess } from "./features/auth";
const SignDocumentPage = lazy(() =>
  import("./features/signatures").then((module) => ({
    default: module.SignDocumentPage,
  })),
);
const ClientProjectPage = lazy(() =>
  import("./features/client-workspace").then((module) => ({
    default: module.ClientProjectPage,
  })),
);
const ClientActionsPage = lazy(() =>
  import("./features/client-workspace").then((module) => ({
    default: module.ClientActionsPage,
  })),
);
const ClientMessagesPage = lazy(() =>
  import("./features/client-workspace").then((module) => ({
    default: module.ClientMessagesPage,
  })),
);
const ClientDeliverablesPage = lazy(() =>
  import("./features/client-workspace").then((module) => ({
    default: module.ClientDeliverablesPage,
  })),
);
const ClientDocumentsPage = lazy(() =>
  import("./features/client-workspace").then((module) => ({
    default: module.ClientDocumentsPage,
  })),
);
const ClientActivityPage = lazy(() =>
  import("./features/client-workspace").then((module) => ({
    default: module.ClientActivityPage,
  })),
);
const ClientDashboard = lazy(() =>
  import("./features/client-workspace").then((module) => ({
    default: module.ClientDashboard,
  })),
);
const ClientHandoffPage = lazy(() =>
  import("./features/handoffs").then((module) => ({
    default: module.ClientHandoffPage,
  })),
);
const AdminHandoffPage = lazy(() =>
  import("./features/handoffs").then((module) => ({
    default: module.AdminHandoffPage,
  })),
);
const AdminHandoffsPage = lazy(() =>
  import("./features/handoffs").then((module) => ({
    default: module.AdminHandoffsPage,
  })),
);
const ClientBillingPage = lazy(() =>
  import("./features/billing").then((module) => ({
    default: module.ClientBillingPage,
  })),
);
const AdminBillingPage = lazy(() =>
  import("./features/billing").then((module) => ({
    default: module.AdminBillingPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("./features/notifications").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const LeadDetail = lazy(() =>
  import("./features/leads").then((module) => ({ default: module.LeadDetail })),
);
const LeadsPage = lazy(() =>
  import("./features/leads").then((module) => ({ default: module.LeadsPage })),
);
const ClientDetail = lazy(() =>
  import("./features/clients").then((module) => ({
    default: module.ClientDetail,
  })),
);
const ClientsPage = lazy(() =>
  import("./features/clients").then((module) => ({
    default: module.ClientsPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("./features/projects").then((module) => ({
    default: module.ProjectsPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("./features/documents").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const ActivityPage = lazy(() =>
  import("./features/activity").then((module) => ({
    default: module.ActivityPage,
  })),
);
const AdminOverview = lazy(() =>
  import("./features/overview").then((module) => ({
    default: module.AdminOverview,
  })),
);

export function ClientRouter({
  route,
  profile,
  navigate,
}: {
  route: string;
  profile: Profile | null;
  navigate: (p: string) => void;
}) {
  const sign = route.match(/^\/documents\/([0-9a-f-]+)$/i);
  if (sign) return <SignDocumentPage requestId={sign[1]} navigate={navigate} />;
  if (route === "/project") return <ClientProjectPage />;
  if (route === "/actions") return <ClientActionsPage navigate={navigate} />;
  if (route === "/messages") return <ClientMessagesPage />;
  if (route === "/deliverables") return <ClientDeliverablesPage />;
  if (route === "/handoff") return <ClientHandoffPage />;
  if (route === "/billing") return <ClientBillingPage />;
  if (route === "/documents")
    return <ClientDocumentsPage navigate={navigate} />;
  if (route === "/activity") return <ClientActivityPage />;
  if (route === "/notifications") return <NotificationsPage />;
  return <ClientDashboard profile={profile} navigate={navigate} />;
}

export function AdminRouter({
  route,
  profile,
  navigate,
}: {
  route: string;
  profile: Profile | null;
  navigate: (p: string) => void;
}) {
  const lead = route.match(/^\/leads\/([0-9a-f-]+)$/i),
    client = route.match(/^\/clients\/([0-9a-f-]+)$/i),
    handoff = route.match(/^\/handoffs\/([0-9a-f-]+)$/i),
    sign = route.match(/^\/documents\/([0-9a-f-]+)$/i);
  if (sign)
    return (
      <SignDocumentPage requestId={sign[1]} navigate={navigate} staffPreview />
    );
  if (lead) return <LeadDetail id={lead[1]} navigate={navigate} />;
  if (client) return <ClientDetail id={client[1]} navigate={navigate} />;
  if (handoff)
    return <AdminHandoffPage clientId={handoff[1]} navigate={navigate} />;
  if (route === "/leads") return <LeadsPage navigate={navigate} />;
  if (route === "/clients") return <ClientsPage navigate={navigate} />;
  if (route === "/projects") return <ProjectsPage />;
  if (route === "/handoffs") return <AdminHandoffsPage navigate={navigate} />;
  if (route === "/documents") return <DocumentsPage />;
  if (route === "/billing") return <AdminBillingPage />;
  if (route === "/activity") return <ActivityPage />;
  if (route === "/notifications") return <NotificationsPage />;
  return <AdminOverview profile={profile} navigate={navigate} />;
}

export default function App() {
  const initialHash = useMemo(
    () => new URLSearchParams(location.hash.replace(/^#/, "")),
    [],
  );
  const initialAuthType = initialHash.get("type");
  const initialCode = useMemo(
    () => new URLSearchParams(location.search).get("code"),
    [],
  );
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [membership, setMembership] = useState<Membership | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [route, setRoute] = useState(path()),
    [passwordFlow, setPasswordFlow] = useState(false),
    [authLinkError, setAuthLinkError] = useState(""),
    [mobileNav, setMobileNav] = useState(false),
    [accessLoading, setAccessLoading] = useState(false),
    [accessError, setAccessError] = useState(""),
    [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const pop = () => {
      setRoute(path());
      setMobileNav(false);
    };
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    let alive = true;
    const boot = async () => {
      if (route === "/set-password") {
        const accessToken = initialHash.get("access_token"),
          refreshToken = initialHash.get("refresh_token");
        if (
          (initialAuthType === "recovery" || initialAuthType === "invite") &&
          accessToken &&
          refreshToken
        ) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!alive) return;
          if (error) {
            setAuthLinkError(error.message);
            setLoading(false);
            return;
          }
          setPasswordFlow(true);
          setSession(data.session);
          setLoading(false);
          return;
        }
        if (initialCode) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(initialCode);
          if (!alive) return;
          if (error) {
            setAuthLinkError(error.message);
            setLoading(false);
            return;
          }
          setPasswordFlow(true);
          setSession(data.session);
          setLoading(false);
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (alive) {
        setSession(data.session);
        setLoading(false);
      }
    };
    boot();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setPasswordFlow(true);
      setSession(s);
      if (!s) {
        setMobileNav(false);
        setMembership(null);
        setProfile(null);
      }
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const up = () => setOnline(true),
      down = () => setOnline(false);
    addEventListener("online", up);
    addEventListener("offline", down);
    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
    };
  }, []);
  useEffect(() => {
    if (!session) {
      setAccessLoading(false);
      setAccessError("");
      return;
    }
    setAccessLoading(true);
    setAccessError("");
    Promise.all([
      supabase
        .from("app_memberships")
        .select("role,status")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name,email")
        .eq("id", session.user.id)
        .maybeSingle(),
    ])
      .then(([m, p]) => {
        if (m.error) {
          setAccessError(
            "We could not verify your workspace access. Check your connection and try again.",
          );
          setAccessLoading(false);
          return;
        }
        setMembership(m.data as Membership | null);
        setProfile(p.data as Profile | null);
        setAccessLoading(false);
      })
      .catch(() => {
        setAccessError(
          "We could not verify your workspace access. Check your connection and try again.",
        );
        setAccessLoading(false);
      });
  }, [session]);
  useEffect(() => {
    if (!mobileNav) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNav(false);
    };
    const workspace = document.getElementById("main-workspace");
    document.body.classList.add("nav-open");
    workspace?.setAttribute("inert", "");
    addEventListener("keydown", close);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>("#workspace-navigation nav button")
        ?.focus(),
    );
    return () => {
      document.body.classList.remove("nav-open");
      workspace?.removeAttribute("inert");
      removeEventListener("keydown", close);
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".mobile-menu-button")?.focus(),
      );
    };
  }, [mobileNav]);
  const active = useMemo(
    () => (membership?.status === "active" ? membership : null),
    [membership],
  );
  const workspaceRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const section =
      route === "/"
        ? "Overview"
        : label(route.split("/").filter(Boolean)[0] || "Overview");
    document.title = section + " — SRCcvde Workspace";
  }, [route]);
  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() =>
      workspaceRef.current?.focus({ preventScroll: true }),
    );
  }, [route, active]);
  const resumeChecked = useRef(false);
  const routeKey =
    active && session?.user?.id
      ? "srccvde:last-route:" + session.user.id
      : null;
  useEffect(() => {
    if (!active || !routeKey || resumeChecked.current) return;
    resumeChecked.current = true;
    if (route === "/") {
      try {
        const saved = localStorage.getItem(routeKey);
        if (
          saved &&
          saved.startsWith("/") &&
          !saved.startsWith("//") &&
          saved !== "/" &&
          saved !== "/set-password"
        ) {
          history.replaceState({}, "", saved);
          setRoute(path());
          return;
        }
      } catch {}
    }
  }, [active, routeKey, route]);
  useEffect(() => {
    if (
      !active ||
      !routeKey ||
      !resumeChecked.current ||
      route === "/set-password"
    )
      return;
    try {
      localStorage.setItem(routeKey, route);
    } catch {}
  }, [route, active, routeKey]);
  useEffect(() => {
    if (!active || !routeKey) return;
    const scrollKey = routeKey + ":scroll";
    const save = () => {
      try {
        sessionStorage.setItem(
          scrollKey,
          JSON.stringify({ route: path(), y: window.scrollY }),
        );
      } catch {}
    };
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
    };
  }, [active, routeKey]);
  useEffect(() => {
    if (!active || !routeKey || !resumeChecked.current) return;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(routeKey + ":scroll") || "null",
      );
      if (saved?.route === route && Number.isFinite(saved.y) && saved.y > 0) {
        requestAnimationFrame(() => window.scrollTo(0, saved.y));
        sessionStorage.removeItem(routeKey + ":scroll");
      }
    } catch {}
  }, [active, routeKey, route]);
  const navigate = (p: string) => {
    history.pushState({}, "", p);
    if (routeKey) {
      try {
        localStorage.setItem(routeKey, p);
        sessionStorage.removeItem(routeKey + ":scroll");
      } catch {}
    }
    setRoute(path());
    setMobileNav(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };
  if (loading)
    return (
      <main className="loading">
        <Brand />
        <span>Opening workspace…</span>
      </main>
    );
  if (route === "/set-password" && (!passwordFlow || !session))
    return (
      <main className="pending">
        <Brand />
        <p className="eyebrow">Secure password setup</p>
        <h1>
          {authLinkError
            ? "This password link could not be opened."
            : "This password link isn't active."}
        </h1>
        <p>
          {authLinkError
            ? "The link may have expired or already been used. Request a fresh password email and try again."
            : "For your protection, a password can only be changed from the recovery or invitation link sent to that account."}
        </p>
        <button
          className="primary"
          onClick={async () => {
            await supabase.auth.signOut();
            history.replaceState({}, "", "/");
            location.reload();
          }}
        >
          Return to sign in
        </button>
      </main>
    );
  if (!session) return <Login />;
  if (route === "/set-password") return <SetPassword />;
  if (accessLoading)
    return (
      <main className="loading">
        <Brand />
        <span>Preparing your workspace…</span>
      </main>
    );
  if (accessError)
    return (
      <main className="pending">
        <Brand />
        <p className="eyebrow">Connection check</p>
        <h1>We couldn’t open your workspace.</h1>
        <p>{accessError}</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    );
  if (!active) return <PendingAccess email={session.user.email} />;
  const workspace = (
    <div className="app-shell">
      <a className="skip-link" href="#main-workspace">
        Skip to main content
      </a>
      {!online && (
        <div className="offline-banner" role="status">
          You’re offline. Changes may not save until your connection returns.
        </div>
      )}
      <header className="mobile-bar">
        <Brand />
        <button
          className="mobile-menu-button"
          aria-label={mobileNav ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNav}
          aria-controls="workspace-navigation"
          onClick={() => setMobileNav((v) => !v)}
        >
          Menu
        </button>
      </header>
      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <Sidebar
        role={active.role}
        current={route}
        navigate={navigate}
        mobileOpen={mobileNav}
        onNavigate={() => setMobileNav(false)}
        onSignOut={() => supabase.auth.signOut()}
      />
      <main
        id="main-workspace"
        ref={workspaceRef}
        tabIndex={-1}
        className="workspace"
      >
        {active.role === "client" ? (
          <Suspense fallback={<p role="status">Loading workspace…</p>}>
            <ClientRouter route={route} profile={profile} navigate={navigate} />
          </Suspense>
        ) : (
          <Suspense fallback={<p role="status">Loading workspace…</p>}>
            <AdminRouter route={route} profile={profile} navigate={navigate} />
          </Suspense>
        )}
      </main>
    </div>
  );
  return active.role === "client" ? (
    workspace
  ) : (
    <StaffMfa>{workspace}</StaffMfa>
  );
}
