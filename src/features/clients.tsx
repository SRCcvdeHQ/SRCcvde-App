import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { validateProjectFile, date, label } from "../shared/workspace";
import type {
  Client,
  Project,
  Milestone,
  DocumentRow,
  Communication,
  Activity,
  SignatureRequest,
  ClientAction,
  DocumentTemplate,
  TemplateContext,
} from "../shared/workspace";
import {
  PageTitle,
  LoadState,
  Avatar,
  StatusPill,
  Empty,
  RecordCard,
} from "../components/WorkspaceLayout";
import { documentTemplates } from "../content/document-templates";
import { ActivityFeed } from "./activity";

export function ClientsPage({ navigate }: { navigate: (p: string) => void }) {
  const [clients, setClients] = useState<Client[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [milestones, setMilestones] = useState<Milestone[]>([]),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [c, p, m] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("*"),
        supabase.from("project_milestones").select("*"),
      ]);
      if (c.error || p.error || m.error) throw new Error();
      setClients((c.data || []) as Client[]);
      setProjects((p.data || []) as Project[]);
      setMilestones((m.data || []) as Milestone[]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const filtered = clients.filter(
    (c) =>
      (status === "all" || c.status === status) &&
      (!query.trim() ||
        [c.name, c.primary_contact_name, c.primary_email].some((v) =>
          (v || "").toLowerCase().includes(query.trim().toLowerCase()),
        )),
  );
  return (
    <>
      <PageTitle
        eyebrow="Relationships"
        title="Clients"
        copy="Accepted clients and the workspaces attached to them."
      />
      <section className="panel client-directory">
        <div className="directory-tools">
          <label className="client-search">
            Search clients
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, contact, or email…"
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All clients</option>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <span className="directory-count">
            {loading ? "Loading…" : `${filtered.length} of ${clients.length}`}
          </span>
        </div>
        <div className="client-list">
          <LoadState
            loading={loading}
            error={loadError ? "Could not load clients. Try again." : null}
            onRetry={load}
            loadingText="Loading clients…"
          />
          {!loading &&
            !loadError &&
            filtered.map((c) => {
              const cp = projects.filter((p) => p.client_id === c.id);
              const ids = new Set(cp.map((p) => p.id));
              const cm = milestones.filter((m) => ids.has(m.project_id));
              const blocked = cm.filter((m) => m.status === "blocked").length;
              const overdue = cm.filter(
                (m) =>
                  m.due_at &&
                  new Date(m.due_at).getTime() < Date.now() &&
                  m.status !== "completed",
              ).length;
              return (
                <button
                  className="client-row"
                  key={c.id}
                  onClick={() => navigate("/clients/" + c.id)}
                >
                  <Avatar name={c.name} />
                  <div>
                    <b>{c.name}</b>
                    <small>
                      {c.primary_contact_name} · {c.primary_email}
                      {blocked ? " · " + blocked + " blocked" : ""}
                      {overdue ? " · " + overdue + " overdue" : ""}
                    </small>
                  </div>
                  <StatusPill value={c.status} />
                  <span>Open →</span>
                </button>
              );
            })}
          {!loading &&
            !loadError &&
            (clients.length === 0 ? (
              <Empty>No clients yet. Convert a lead when you're ready.</Empty>
            ) : (
              filtered.length === 0 && (
                <Empty>No clients match this search.</Empty>
              )
            ))}
        </div>
      </section>
    </>
  );
}

export function ClientDetail({
  id,
  navigate,
}: {
  id: string;
  navigate: (p: string) => void;
}) {
  const DRAFT_KEY = "srccvde:admin-client-draft:" + id;
  const readDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as Record<
        string,
        any
      >;
    } catch {
      return {};
    }
  };
  const initialDraft = useMemo(() => readDraft(), [id]);
  const [client, setClient] = useState<
      (Client & { portal_unlocked?: boolean }) | null
    >(null),
    [clientAccess, setClientAccess] = useState<
      "unlinked" | "active" | "suspended"
    >("unlinked"),
    [projects, setProjects] = useState<Project[]>([]),
    [clientMilestones, setClientMilestones] = useState<Milestone[]>([]),
    [docs, setDocs] = useState<DocumentRow[]>([]),
    [comms, setComms] = useState<Communication[]>([]),
    [activity, setActivity] = useState<Activity[]>([]),
    [requests, setRequests] = useState<SignatureRequest[]>([]),
    [actions, setActions] = useState<ClientAction[]>([]),
    [deliverables, setDeliverables] = useState<any[]>([]),
    [fileView, setFileView] = useState(initialDraft.fileView || "all"),
    [selectedDeliveryProject, setSelectedDeliveryProject] = useState(
      initialDraft.selectedDeliveryProject || "",
    ),
    [selectedWorkProject, setSelectedWorkProject] = useState(
      initialDraft.selectedWorkProject || "",
    ),
    [fileQuery, setFileQuery] = useState(initialDraft.fileQuery || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [downloadUrl, setDownloadUrl] = useState("");
  const [docName, setDocName] = useState(initialDraft.docName || ""),
    [docCategory, setDocCategory] = useState(
      initialDraft.docCategory || "agreement",
    ),
    [docKind, setDocKind] = useState(initialDraft.docKind || "signature"),
    [docContent, setDocContent] = useState(initialDraft.docContent || ""),
    [docTemplate, setDocTemplate] = useState(
      initialDraft.docTemplate || "service-agreement",
    ),
    [wizardOpen, setWizardOpen] = useState(Boolean(initialDraft.wizardOpen)),
    [wizardBase, setWizardBase] = useState(initialDraft.wizardBase || ""),
    [wizardAnswers, setWizardAnswers] = useState<Record<string, string>>(
      initialDraft.wizardAnswers || {},
    ),
    [templateView, setTemplateView] = useState(
      initialDraft.templateView || "all",
    ),
    [favoriteTemplates, setFavoriteTemplates] = useState<string[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("srccvde-template-favorites") || "[]",
        );
      } catch {
        return [];
      }
    }),
    [recentTemplates, setRecentTemplates] = useState<string[]>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("srccvde-template-recent") || "[]",
        );
      } catch {
        return [];
      }
    }),
    [commSubject, setCommSubject] = useState(initialDraft.commSubject || ""),
    [commBody, setCommBody] = useState(initialDraft.commBody || ""),
    [commChannel, setCommChannel] = useState(
      initialDraft.commChannel || "portal",
    ),
    [actionTitle, setActionTitle] = useState(initialDraft.actionTitle || ""),
    [actionDescription, setActionDescription] = useState(
      initialDraft.actionDescription || "",
    ),
    [actionType, setActionType] = useState(initialDraft.actionType || "review"),
    [actionDue, setActionDue] = useState(initialDraft.actionDue || ""),
    [deliveryName, setDeliveryName] = useState(initialDraft.deliveryName || ""),
    [deliveryDescription, setDeliveryDescription] = useState(
      initialDraft.deliveryDescription || "",
    ),
    [deliveryCategory, setDeliveryCategory] = useState(
      initialDraft.deliveryCategory || "deliverable",
    ),
    [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const load = async () => {
    const [c, p, d, m, a, s, x, y] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("projects")
        .select("*")
        .eq("client_id", id)
        .order("created_at"),
      supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_communications")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_activity")
        .select("*")
        .eq("entity_type", "client")
        .eq("entity_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("signature_requests")
        .select("*")
        .eq("client_id", id)
        .order("requested_at", { ascending: false }),
      supabase
        .from("client_action_requests")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_deliverables")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setClient(c.data as Client & { portal_unlocked?: boolean });
    const projectRows = (p.data || []) as Project[];
    setProjects(projectRows);
    if (projectRows.length) {
      const { data: ms } = await supabase
        .from("project_milestones")
        .select("*")
        .in(
          "project_id",
          projectRows.map((x) => x.id),
        );
      setClientMilestones((ms || []) as Milestone[]);
    } else setClientMilestones([]);
    setDocs((d.data || []) as DocumentRow[]);
    setComms((m.data || []) as Communication[]);
    setActivity((a.data || []) as Activity[]);
    setRequests((s.data || []) as SignatureRequest[]);
    setActions((x.data || []) as ClientAction[]);
    setDeliverables(y.data || []);
    const { data: cm } = await supabase
      .from("client_memberships")
      .select("user_id")
      .eq("client_id", id)
      .limit(1)
      .maybeSingle();
    if (cm?.user_id) {
      const { data: am } = await supabase
        .from("app_memberships")
        .select("status")
        .eq("user_id", cm.user_id)
        .maybeSingle();
      setClientAccess(am?.status === "active" ? "active" : "suspended");
    } else setClientAccess("unlinked");
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      supabase
        .from("client_communications")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (data) setComms(data as Communication[]);
        });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [id]);
  useEffect(() => {
    const draft = {
      fileView,
      selectedDeliveryProject,
      selectedWorkProject,
      fileQuery,
      docName,
      docCategory,
      docKind,
      docContent,
      docTemplate,
      wizardOpen,
      wizardBase,
      wizardAnswers,
      templateView,
      commSubject,
      commBody,
      commChannel,
      actionTitle,
      actionDescription,
      actionType,
      actionDue,
      deliveryName,
      deliveryDescription,
      deliveryCategory,
    };
    const hasDraft = Boolean(
      docName ||
      docContent ||
      wizardOpen ||
      commSubject ||
      commBody ||
      actionTitle ||
      actionDescription ||
      actionDue ||
      deliveryName ||
      deliveryDescription ||
      fileQuery,
    );
    try {
      if (hasDraft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [
    DRAFT_KEY,
    fileView,
    selectedDeliveryProject,
    selectedWorkProject,
    fileQuery,
    docName,
    docCategory,
    docKind,
    docContent,
    docTemplate,
    wizardOpen,
    wizardBase,
    wizardAnswers,
    templateView,
    commSubject,
    commBody,
    commChannel,
    actionTitle,
    actionDescription,
    actionType,
    actionDue,
    deliveryName,
    deliveryDescription,
    deliveryCategory,
  ]);
  useEffect(() => {
    const preferred =
      projects.find((p) => !["completed", "archived"].includes(p.status))?.id ||
      projects[0]?.id ||
      "";
    if (!selectedDeliveryProject && preferred)
      setSelectedDeliveryProject(preferred);
    if (!selectedWorkProject && preferred) setSelectedWorkProject(preferred);
  }, [projects, selectedDeliveryProject, selectedWorkProject]);
  async function invite() {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.functions.invoke("invite-client", {
      body: { client_id: id },
    });
    setBusy(false);
    setMessage(
      error
        ? error.message
        : data?.invitation_sent
          ? "Portal invitation sent."
          : "Client account linked.",
    );
    if (!error) load();
  }
  async function changeClientStatus(status: string) {
    if (!client) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("clients")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage(
        status === "inactive"
          ? "Client marked inactive and removed from the active dashboard count."
          : "Client status updated to " + label(status) + ".",
      );
      load();
    }
  }
  async function setPortalAccess(enabled: boolean) {
    if (clientAccess === "unlinked") return;
    if (
      !confirm(
        enabled
          ? "Restore this client’s workspace access?"
          : "Lock this client out of SRCcvde? They will no longer be able to access their client workspace or client data.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("set_client_portal_access", {
      p_client_id: id,
      p_enabled: enabled,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage(
        enabled
          ? "Client workspace access restored."
          : "Client locked out of SRCcvde.",
      );
      load();
    }
  }
  function selectDocumentTemplate(templateId: string) {
    setDocTemplate(templateId);
    setWizardOpen(false);
    setWizardBase("");
    setWizardAnswers({});
  }
  function toggleFavoriteTemplate(templateId: string) {
    setFavoriteTemplates((current) => {
      const next = current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [templateId, ...current];
      try {
        localStorage.setItem(
          "srccvde-template-favorites",
          JSON.stringify(next),
        );
      } catch {}
      return next;
    });
  }
  function rememberTemplate(templateId: string) {
    setRecentTemplates((current) => {
      const next = [
        templateId,
        ...current.filter((id) => id !== templateId),
      ].slice(0, 5);
      try {
        localStorage.setItem("srccvde-template-recent", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  const quickTemplates =
    templateView === "favorites"
      ? (favoriteTemplates
          .map((id) => documentTemplates.find((t) => t.id === id))
          .filter(Boolean) as DocumentTemplate[])
      : templateView === "recent"
        ? (recentTemplates
            .map((id) => documentTemplates.find((t) => t.id === id))
            .filter(Boolean) as DocumentTemplate[])
        : templateView === "all"
          ? documentTemplates
          : documentTemplates.filter((t) => t.category === templateView);
  function startTemplateWizard() {
    const template = documentTemplates.find((t) => t.id === docTemplate),
      project = projects.find((p) => p.id === selectedWorkProject);
    if (!template) return;
    if (!project) {
      setMessage("Choose a project before starting a guided document.");
      return;
    }
    rememberTemplate(template.id);
    const ctx: TemplateContext = {
      clientName: client?.name || "Client",
      clientContact: client?.primary_contact_name || "Client contact",
      clientEmail: client?.primary_email || "Email unavailable",
      projectName: project.name,
      projectType: project.project_type || "Custom technology project",
      projectPhase: label(project.phase),
      today: new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    };
    const content = template.buildContent(ctx),
      questions = [...content.matchAll(/\[REQUIRED:\s*([^\]]+)\]/g)].map(
        (match) => match[1].trim(),
      );
    setDocName(template.documentName + " — " + project.name);
    setDocCategory(template.category);
    setDocKind(template.signatureKind);
    setWizardBase(content);
    setWizardAnswers({});
    if (!questions.length) {
      setDocContent(content);
      setWizardOpen(false);
      setMessage(
        "Template generated. Review and edit the document before sending.",
      );
      return;
    }
    setWizardOpen(true);
    setMessage(
      "Guided draft ready. Answer " +
        questions.length +
        " required question" +
        (questions.length === 1 ? "" : "s") +
        " to generate the editable document.",
    );
  }
  function generateWizardDraft() {
    const questions = [...wizardBase.matchAll(/\[REQUIRED:\s*([^\]]+)\]/g)].map(
        (match) => match[1].trim(),
      ),
      missing = questions.filter((q) => !wizardAnswers[q]?.trim());
    if (missing.length) {
      setMessage(
        "Answer all " +
          missing.length +
          " remaining required question" +
          (missing.length === 1 ? "" : "s") +
          " before generating the draft.",
      );
      return;
    }
    let content = wizardBase;
    questions.forEach((q) => {
      content = content.replace(
        "[REQUIRED: " + q + "]",
        wizardAnswers[q].trim(),
      );
    });
    setDocContent(content);
    setWizardOpen(false);
    setMessage(
      "Editable document generated. Review or change any wording before sending.",
    );
  }
  function cancelTemplateWizard() {
    setWizardOpen(false);
    setWizardBase("");
    setWizardAnswers({});
    setMessage("Guided draft closed. No document was sent.");
  }
  async function createDocument(e: FormEvent) {
    e.preventDefault();
    const project = projects.find((p) => p.id === selectedWorkProject);
    if (!project) return setMessage("Choose a project first.");
    const unresolved = docContent.match(/\[REQUIRED:[^\]]*\]/g) || [];
    if (unresolved.length)
      return setMessage(
        "Complete all " +
          unresolved.length +
          " required template field" +
          (unresolved.length === 1 ? "" : "s") +
          " before sending. Search the document for [REQUIRED:.",
      );
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("create_signable_document", {
      p_client_id: id,
      p_project_id: project.id,
      p_name: docName,
      p_category: docCategory,
      p_content: docContent,
      p_signature_kind: docKind,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setDocName("");
      setDocContent("");
      setMessage("Document sent to the client workspace.");
      await supabase.functions.invoke("dispatch-notifications");
      load();
    }
  }
  async function countersign(documentId: string) {
    const legalName = prompt(
      "Type your legal name to countersign this exact document version.",
    );
    if (!legalName) return;
    setBusy(true);
    setMessage("");
    setDownloadUrl("");
    const { error } = await supabase.rpc("countersign_document", {
      p_document_id: documentId,
      p_legal_name: legalName,
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    const { data, error: finalError } = await supabase.functions.invoke(
      "finalize-executed-document",
      { body: { document_id: documentId } },
    );
    setBusy(false);
    if (finalError) {
      let detail = finalError.message;
      try {
        const response = (finalError as any).context as Response | undefined;
        if (response) {
          const body = await response.clone().json();
          detail = body?.detail || body?.error || detail;
        }
      } catch {}
      setMessage(
        "Fully executed and saved in SRCcvde. The external archive needs attention: " +
          detail,
      );
    } else {
      const driveStatus =
        data?.drive?.status || data?.artifact?.drive_sync_status;
      setMessage(
        driveStatus === "synced"
          ? "Fully executed and archived to Google Drive."
          : driveStatus === "failed"
            ? "Fully executed and saved in SRCcvde. Google Drive needs to be reconnected before the Drive copy can sync."
            : "Fully executed. Secure PDF generated; Google Drive is not connected yet.",
      );
      setDownloadUrl(data?.download_url || "");
    }
    await supabase.functions.invoke("dispatch-notifications");
    load();
  }
  async function retryArchive(documentId: string) {
    setBusy(true);
    setMessage("");
    setDownloadUrl("");
    const { data, error } = await supabase.functions.invoke(
      "finalize-executed-document",
      { body: { document_id: documentId } },
    );
    setBusy(false);
    if (error) {
      let detail = error.message;
      try {
        const response = (error as any).context as Response | undefined;
        if (response) {
          const body = await response.clone().json();
          detail = body?.detail || body?.error || detail;
        }
      } catch {}
      setMessage("Secure PDF archive needs attention: " + detail);
    } else {
      const driveStatus =
        data?.drive?.status || data?.artifact?.drive_sync_status;
      setMessage(
        driveStatus === "synced"
          ? "Executed PDF generated and archived to Google Drive."
          : driveStatus === "failed"
            ? "Executed PDF is safely stored in SRCcvde. Reconnect Google Drive to restore the Drive copy."
            : "Executed PDF is safely stored in SRCcvde. Google Drive is not connected yet.",
      );
      setDownloadUrl(data?.download_url || "");
    }
    load();
  }
  async function createClientAction(e: FormEvent) {
    e.preventDefault();
    if (!actionTitle.trim()) return;
    setBusy(true);
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_action_requests").insert({
      client_id: id,
      project_id: selectedWorkProject || null,
      title: actionTitle.trim(),
      description: actionDescription.trim() || null,
      action_type: actionType,
      status: "open",
      due_at: actionDue
        ? new Date(actionDue + "T12:00:00").toISOString()
        : null,
      client_visible: true,
      created_by: user?.id || null,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setActionTitle("");
      setActionDescription("");
      setActionDue("");
      setMessage("Client action created.");
      await supabase.functions.invoke("dispatch-notifications");
      load();
    }
  }
  async function closeClientAction(a: ClientAction) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("client_action_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", a.id);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage("Client action completed.");
      load();
    }
  }
  async function uploadDeliverable(e: FormEvent) {
    e.preventDefault();
    const project =
      projects.find((p) => p.id === selectedDeliveryProject) || projects[0];
    if (!project || !deliveryFile)
      return setMessage("Choose a project file first.");
    const validation = validateProjectFile(deliveryFile);
    if (validation) return setMessage(validation);
    setBusy(true);
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const safe = deliveryFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = id + "/" + project.id + "/srccvde/" + Date.now() + "-" + safe;
    const { error: uploadError } = await supabase.storage
      .from("project-deliverables")
      .upload(path, deliveryFile, {
        contentType: deliveryFile.type || undefined,
        upsert: false,
      });
    if (uploadError) {
      setBusy(false);
      setMessage(uploadError.message);
      return;
    }
    const { error } = await supabase.from("project_deliverables").insert({
      client_id: id,
      project_id: project.id,
      name: deliveryName.trim() || deliveryFile.name,
      description: deliveryDescription.trim() || null,
      storage_bucket: "project-deliverables",
      storage_path: path,
      file_name: deliveryFile.name,
      mime_type: deliveryFile.type || null,
      byte_size: deliveryFile.size,
      version: 1,
      client_visible: true,
      created_by: user?.id || null,
      source: "srccvde",
      category: deliveryCategory,
    });
    setBusy(false);
    if (error) {
      await supabase.storage.from("project-deliverables").remove([path]);
      setMessage(error.message);
      return;
    }
    setDeliveryName("");
    setDeliveryDescription("");
    setDeliveryFile(null);
    setMessage("Deliverable shared with client.");
    const { data: members } = await supabase
      .from("client_memberships")
      .select("user_id")
      .eq("client_id", id);
    await Promise.all(
      (members || []).map((member) =>
        supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: member.user_id,
            category: "project_updates",
            title: "New project file from SRCcvde",
            body:
              (deliveryName.trim() || deliveryFile.name) +
              " is ready in " +
              project.name +
              ".",
            url: "/deliverables",
            tag: "project-delivery-" + project.id,
          },
        }),
      ),
    );
    load();
  }
  async function openDeliverable(item: any) {
    const { data, error } = await supabase.functions.invoke(
      "project-file-download",
      { body: { deliverable_id: item.id } },
    );
    if (error || !data?.url) {
      setMessage(error?.message || "Could not open file.");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  async function replaceDeliverable(item: any) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      ".pdf,.png,.jpg,.jpeg,.webp,.svg,.zip,.doc,.docx,.xls,.xlsx,.csv,.txt,.md";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const validation = validateProjectFile(file);
      if (validation) {
        setMessage(validation);
        return;
      }
      setBusy(true);
      setMessage("");
      const { data: latest } = await supabase
        .from("project_deliverables")
        .select("version")
        .eq("client_id", item.client_id)
        .eq("project_id", item.project_id)
        .eq("source", "srccvde")
        .eq("name", item.name)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersion = (latest?.version || item.version || 1) + 1;
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path =
        item.client_id +
        "/" +
        item.project_id +
        "/srccvde/" +
        Date.now() +
        "-" +
        safe;
      const { error: uploadError } = await supabase.storage
        .from("project-deliverables")
        .upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadError) {
        setBusy(false);
        setMessage(uploadError.message);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("project_deliverables").insert({
        client_id: item.client_id,
        project_id: item.project_id,
        name: item.name,
        description: item.description,
        storage_bucket: "project-deliverables",
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        byte_size: file.size,
        version: nextVersion,
        replaces_deliverable_id: item.id,
        client_visible: item.client_visible,
        created_by: user?.id || null,
        source: "srccvde",
        category: item.category || "deliverable",
      });
      if (error) {
        await supabase.storage.from("project-deliverables").remove([path]);
        setBusy(false);
        setMessage(error.message);
        return;
      }
      const project = projects.find((p) => p.id === item.project_id);
      const { data: members } = await supabase
        .from("client_memberships")
        .select("user_id")
        .eq("client_id", item.client_id);
      await Promise.all(
        (members || []).map((member) =>
          supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: member.user_id,
              category: "project_updates",
              title: "Updated project file from SRCcvde",
              body:
                item.name +
                " v" +
                nextVersion +
                " is ready" +
                (project ? " in " + project.name : "") +
                ".",
              url: "/deliverables",
              tag: "project-file-version-" + item.project_id,
            },
          }),
        ),
      );
      setBusy(false);
      setMessage(
        "Version " + nextVersion + " uploaded. Previous version retained.",
      );
      load();
    };
    input.click();
  }
  async function toggleDeliverableVisibility(item: any) {
    setBusy(true);
    setMessage("");
    const next = !item.client_visible;
    const { error } = await supabase
      .from("project_deliverables")
      .update({ client_visible: next })
      .eq("id", item.id);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage(
        next
          ? "File is visible to the client."
          : "File hidden from the client.",
      );
      load();
    }
  }
  async function deleteDeliverable(item: any) {
    if (
      !confirm(
        'Delete "' +
          item.name +
          '" permanently? This removes the stored file too.',
      )
    )
      return;
    setBusy(true);
    setMessage("");
    const { error: storageError } = await supabase.storage
      .from(item.storage_bucket)
      .remove([item.storage_path]);
    if (storageError) {
      setBusy(false);
      setMessage(storageError.message);
      return;
    }
    const { error } = await supabase
      .from("project_deliverables")
      .delete()
      .eq("id", item.id);
    setBusy(false);
    if (error)
      setMessage(
        "Stored file was removed, but its record needs cleanup: " +
          error.message,
      );
    else {
      setMessage("File deleted.");
      load();
    }
  }
  async function logCommunication(e: FormEvent) {
    e.preventDefault();
    if (!commBody.trim()) return;
    if (commChannel === "email" && !commSubject.trim()) {
      setMessage("Add a subject before sending an email.");
      return;
    }
    setBusy(true);
    setMessage("");
    if (commChannel === "email") {
      const { data, error } = await supabase.functions.invoke(
        "send-client-email",
        {
          body: {
            client_id: id,
            project_id: selectedWorkProject || null,
            subject: commSubject.trim(),
            body: commBody.trim(),
          },
        },
      );
      setBusy(false);
      if (error) {
        let detail = error.message;
        try {
          const response = (error as any).context as Response | undefined;
          if (response) {
            const body = await response.clone().json();
            detail = body?.error || detail;
          }
        } catch {}
        setMessage(detail);
        return;
      }
      setCommSubject("");
      setCommBody("");
      setMessage(
        "Email sent to " +
          (data?.to || client?.primary_email || "client") +
          ".",
      );
      load();
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_communications").insert({
      client_id: id,
      project_id: selectedWorkProject || null,
      channel: commChannel,
      direction: "outbound",
      subject: commSubject.trim() || null,
      body: commBody.trim(),
      created_by: user?.id || null,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setCommSubject("");
      setCommBody("");
      setMessage("Client communication logged.");
      load();
    }
  }
  if (!client) return <p className="muted">Loading client…</p>;
  const requestFor = (documentId: string) =>
    requests.find(
      (r) => r.document_id === documentId && r.signer_side === "client",
    );
  const visibleDeliverables = deliverables.filter((item) => {
    const q = fileQuery.trim().toLowerCase();
    return (
      (fileView === "all" || item.source === fileView) &&
      (!selectedDeliveryProject ||
        item.project_id === selectedDeliveryProject) &&
      (!q ||
        [item.name, item.file_name, item.description, item.category].some((v) =>
          (v || "").toLowerCase().includes(q),
        ))
    );
  });
  return (
    <>
      <button className="back" onClick={() => navigate("/clients")}>
        ← Clients
      </button>
      <header className="detail-head">
        <div className="identity">
          <Avatar name={client.name} />
          <div>
            <p className="eyebrow">Client record</p>
            <h1>{client.name}</h1>
            <p>
              {client.primary_contact_name} · {client.primary_email}
            </p>
          </div>
        </div>
        <div className="detail-actions">
          <button className="ghost" onClick={() => navigate("/handoffs/" + id)}>
            Handoff →
          </button>
          <label>
            Client status
            <select
              value={client.status}
              disabled={busy}
              onChange={(e) => changeClientStatus(e.target.value)}
            >
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="complete">Complete</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <StatusPill value={client.status} />
          {clientAccess === "active" && (
            <button
              className="ghost"
              disabled={busy}
              onClick={() => setPortalAccess(false)}
            >
              Lock client out
            </button>
          )}
          {clientAccess === "suspended" && (
            <button
              className="primary inline"
              disabled={busy}
              onClick={() => setPortalAccess(true)}
            >
              Restore access
            </button>
          )}
          {clientAccess === "unlinked" && (
            <button className="primary inline" disabled={busy} onClick={invite}>
              {busy ? "Working…" : "Invite / link portal"}
            </button>
          )}
        </div>
      </header>
      {message && (
        <p className="success-message">
          {message}
          {downloadUrl && (
            <>
              {" "}
              ·{" "}
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                Download executed PDF
              </a>
            </>
          )}
        </p>
      )}
      <section className="record-grid">
        <RecordCard
          title="Projects"
          count={projects.length}
          detail={
            projects.length === 1
              ? projects[0].name
              : projects.length > 1
                ? "Multiple active workspaces"
                : "No projects"
          }
        />
        <RecordCard
          title="Documents"
          count={docs.length}
          detail={
            client.drive_folder_id ? "Drive connected" : "Drive archive pending"
          }
        />
        <RecordCard
          title="Communications"
          count={comms.length}
          detail="Client history"
        />
        <RecordCard
          title="Portal"
          count={client.portal_unlocked ? 1 : 0}
          detail={
            client.portal_unlocked
              ? "Full workspace unlocked"
              : "Pre-project experience"
          }
        />
      </section>
      {projects.length > 1 && (
        <section className="panel admin-project-context">
          <div>
            <p className="eyebrow">Working project</p>
            <h2>Target the right workspace</h2>
            <p className="muted">
              Documents, action requests and communications created below will
              attach to this project.
            </p>
          </div>
          <label>
            Project
            <select
              value={selectedWorkProject}
              onChange={(e) => setSelectedWorkProject(e.target.value)}
            >
              {projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name} · {label(p.status)}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <div className="detail-grid">
        <section>
          <section className="panel flush">
            <div className="section-head">
              <div>
                <p className="eyebrow">Projects</p>
                <h2>Workspace</h2>
              </div>
              <button className="ghost" onClick={() => navigate("/projects")}>
                Manage delivery →
              </button>
            </div>
            {projects.map((p) => {
              const pm = clientMilestones.filter((m) => m.project_id === p.id);
              const complete = pm.filter(
                (m) => m.status === "completed",
              ).length;
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
                <div className="project-row" key={p.id}>
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {label(p.phase)} · {p.project_type}
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
                </div>
              );
            })}
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Documents</p>
                <h2>Signing room</h2>
              </div>
              <span className="status">{docs.length}</span>
            </div>
            {docs.length ? (
              docs.map((d) => {
                const req = requestFor(d.id);
                return (
                  <div className="doc-row signable-row" key={d.id}>
                    <div>
                      <b>{d.name}</b>
                      <small>
                        {label(d.category)} ·{" "}
                        {req ? label(req.status) : label(d.state)}
                      </small>
                    </div>
                    {req?.status === "signed" &&
                    d.state !== "final" &&
                    d.signature_kind !== "acknowledgment" ? (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => countersign(d.id)}
                      >
                        Countersign & finalize
                      </button>
                    ) : d.state === "final" && !d.executed_artifact_id ? (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => retryArchive(d.id)}
                      >
                        {busy ? "Working…" : "Generate & archive PDF"}
                      </button>
                    ) : (
                      <StatusPill value={d.state} />
                    )}
                  </div>
                );
              })
            ) : (
              <Empty>No documents yet.</Empty>
            )}
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Client actions</p>
                <h2>Action center</h2>
                <p className="section-copy">
                  Create clear reviews, decisions and requests that appear in
                  the client workspace.
                </p>
              </div>
              <span className="status">
                {actions.filter((a) => a.status !== "completed").length} open
              </span>
            </div>
            <form className="document-form" onSubmit={createClientAction}>
              <label>
                Action title
                <input
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="Review homepage direction"
                  required
                  maxLength={160}
                />
              </label>
              <div className="form-split">
                <label>
                  Type
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                  >
                    <option value="review">Review</option>
                    <option value="approval">Approval</option>
                    <option value="decision">Decision</option>
                    <option value="information">Information request</option>
                  </select>
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    value={actionDue}
                    onChange={(e) => setActionDue(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Details
                <textarea
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  placeholder="What does the client need to review, decide, or provide?"
                  maxLength={2000}
                />
              </label>
              <button
                className="primary"
                disabled={busy || !actionTitle.trim()}
              >
                Add to client action center
              </button>
            </form>
            <div className="communication-history">
              {actions.slice(0, 8).map((a) => (
                <article className="communication-row" key={a.id}>
                  <div className="communication-meta">
                    <span className="communication-channel">
                      {label(a.action_type)}
                    </span>
                    <small>
                      {a.due_at ? "Due " + date(a.due_at) : "No due date"}
                    </small>
                  </div>
                  <div>
                    <b>{a.title}</b>
                    {a.description && <p>{a.description}</p>}
                  </div>
                  {a.status !== "completed" ? (
                    <button
                      className="ghost"
                      disabled={busy}
                      onClick={() => closeClientAction(a)}
                    >
                      Complete
                    </button>
                  ) : (
                    <StatusPill value="completed" />
                  )}
                </article>
              ))}
              {!actions.length && (
                <div className="communication-empty">
                  <b>No client actions yet</b>
                  <p>
                    Requests you create here will appear in the client's Action
                    Center.
                  </p>
                </div>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Project files</p>
                <h2>Shared workspace</h2>
                <p className="section-copy">
                  Deliver finished work to the client and review files they have
                  shared with SRCcvde.
                </p>
              </div>
              <span className="status">{deliverables.length}</span>
            </div>
            <form className="document-form" onSubmit={uploadDeliverable}>
              <div className="form-split">
                <label>
                  Project
                  <select
                    value={selectedDeliveryProject}
                    onChange={(e) => setSelectedDeliveryProject(e.target.value)}
                    required
                  >
                    <option value="">Select project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Display name
                  <input
                    value={deliveryName}
                    onChange={(e) => setDeliveryName(e.target.value)}
                    placeholder="Homepage assets"
                  />
                </label>
              </div>
              <div className="form-split">
                <label>
                  Category
                  <select
                    value={deliveryCategory}
                    onChange={(e) => setDeliveryCategory(e.target.value)}
                  >
                    <option value="deliverable">Deliverable</option>
                    <option value="branding">Branding</option>
                    <option value="content">Content</option>
                    <option value="source">Source package</option>
                    <option value="document">Document</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label>
                Client notes
                <textarea
                  value={deliveryDescription}
                  onChange={(e) => setDeliveryDescription(e.target.value)}
                  placeholder="What is included or what should the client know?"
                />
              </label>
              <label>
                Choose file
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.heic,.heif,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.mp4,.mov"
                  onChange={(e) => setDeliveryFile(e.target.files?.[0] || null)}
                  required
                />
              </label>
              <button
                className="primary"
                disabled={busy || !deliveryFile || !projects.length}
              >
                {busy ? "Uploading…" : "Deliver to client"}
              </button>
            </form>
            <div className="directory-tools">
              <label>
                Search files
                <input
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.target.value)}
                  placeholder="Name, category, notes…"
                />
              </label>
              <label>
                Show
                <select
                  value={fileView}
                  onChange={(e) => setFileView(e.target.value)}
                >
                  <option value="all">All shared files</option>
                  <option value="client">Client uploads</option>
                  <option value="srccvde">SRCcvde deliveries</option>
                </select>
              </label>
              <span className="directory-count">
                {visibleDeliverables.length} files
              </span>
            </div>
            <div className="communication-history">
              {visibleDeliverables.slice(0, 24).map((item) => (
                <article className="communication-row" key={item.id}>
                  <div className="communication-meta">
                    <span className="communication-channel">
                      {item.source === "client"
                        ? "Client upload"
                        : "SRCcvde delivery"}
                    </span>
                    <small>
                      {label(item.category || "deliverable")} · v
                      {item.version || 1} · {date(item.created_at)}
                    </small>
                  </div>
                  <div>
                    <b>{item.name}</b>
                    <p>
                      {item.file_name}
                      {item.description ? " · " + item.description : ""}
                    </p>
                  </div>
                  <div className="detail-actions">
                    <button
                      className="ghost"
                      onClick={() => openDeliverable(item)}
                    >
                      Open
                    </button>
                    {item.source === "srccvde" && (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => replaceDeliverable(item)}
                      >
                        New version
                      </button>
                    )}
                    <button
                      className="ghost"
                      disabled={busy}
                      onClick={() => toggleDeliverableVisibility(item)}
                    >
                      {item.client_visible ? "Hide" : "Show"}
                    </button>
                    <button
                      className="ghost"
                      disabled={busy}
                      onClick={() => deleteDeliverable(item)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
              {!visibleDeliverables.length && (
                <div className="communication-empty">
                  <b>No files in this view</b>
                  <p>
                    Client uploads and SRCcvde deliverables will appear here
                    together.
                  </p>
                </div>
              )}
            </div>
          </section>
          <section className="panel communications-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Communications</p>
                <h2>Client history</h2>
                <p className="section-copy">
                  Keep a clean internal record of calls, emails, meetings and
                  client updates.
                </p>
              </div>
              <span className="status">{comms.length}</span>
            </div>
            <form className="communication-form" onSubmit={logCommunication}>
              <div className="communication-form-head">
                <div>
                  <b>
                    {commChannel === "email"
                      ? "Send client email"
                      : "Log an interaction"}
                  </b>
                  <small>
                    {commChannel === "email"
                      ? "Sends from hello@srccvde.com and records the message in client history."
                      : "Phone, meeting, text and portal entries are recorded in SRCcvde; they are not sent externally."}
                  </small>
                </div>
              </div>
              <div className="communication-fields">
                <label>
                  Channel
                  <select
                    value={commChannel}
                    onChange={(e) => setCommChannel(e.target.value)}
                  >
                    <option value="email">Email</option>
                    <option value="portal">Portal</option>
                    <option value="phone">Phone</option>
                    <option value="meeting">Meeting</option>
                    <option value="text">Text</option>
                  </select>
                </label>
                <label>
                  Subject
                  <input
                    value={commSubject}
                    onChange={(e) => setCommSubject(e.target.value)}
                    placeholder="e.g. Project kickoff"
                    maxLength={160}
                    required={commChannel === "email"}
                  />
                </label>
              </div>
              <label>
                {commChannel === "email" ? "Message" : "Notes"}
                <textarea
                  value={commBody}
                  onChange={(e) => setCommBody(e.target.value)}
                  placeholder={
                    commChannel === "email"
                      ? "Write the email to " +
                        client.primary_contact_name +
                        "…"
                      : "What was discussed, decided, or promised?"
                  }
                  required
                  maxLength={5000}
                />
              </label>
              <div className="communication-form-footer">
                <small>
                  {commBody.length}/5000
                  {commChannel === "email"
                    ? " · To " + client.primary_email
                    : ""}
                </small>
                <button
                  className="primary inline"
                  disabled={
                    busy ||
                    !commBody.trim() ||
                    (commChannel === "email" && !commSubject.trim())
                  }
                >
                  {busy
                    ? commChannel === "email"
                      ? "Sending…"
                      : "Saving…"
                    : commChannel === "email"
                      ? "Send email"
                      : "Log interaction"}
                </button>
              </div>
            </form>
            <div className="communication-history">
              {comms.length ? (
                comms.slice(0, 8).map((c) => (
                  <article className="communication-row" key={c.id}>
                    <div className="communication-meta">
                      <span className="communication-channel">
                        {label(c.channel)}
                      </span>
                      <small>
                        {date(c.created_at)} · {label(c.direction)}
                        {c.channel === "email" && c.delivery_status
                          ? " · " + label(c.delivery_status)
                          : ""}
                      </small>
                    </div>
                    <div>
                      <b>{c.subject || "Client interaction"}</b>
                      <p>{c.body}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="communication-empty">
                  <b>No communication history yet</b>
                  <p>
                    Your logged calls, emails, meetings and updates will appear
                    here.
                  </p>
                </div>
              )}
            </div>
          </section>
          <section className="panel">
            <p className="eyebrow">Create document</p>
            <h2>Send an exact version for review</h2>
            <div className="template-library">
              <div className="template-library-head">
                <div>
                  <p className="eyebrow">Template library</p>
                  <h3>Choose the right document faster</h3>
                </div>
                <button
                  className={
                    "template-favorite-toggle" +
                    (favoriteTemplates.includes(docTemplate) ? " active" : "")
                  }
                  type="button"
                  onClick={() => toggleFavoriteTemplate(docTemplate)}
                  aria-pressed={favoriteTemplates.includes(docTemplate)}
                >
                  {favoriteTemplates.includes(docTemplate)
                    ? "★ Favorited"
                    : "☆ Favorite selected"}
                </button>
              </div>
              <div className="template-filter-row">
                {[
                  ["all", "All"],
                  ["favorites", "Favorites"],
                  ["recent", "Recent"],
                  ["agreement", "Agreements"],
                  ["proposal", "Proposals"],
                  ["scope", "Scope"],
                  ["approval", "Approvals"],
                ].map(([value, name]) => (
                  <button
                    key={value}
                    type="button"
                    className={templateView === value ? "active" : ""}
                    onClick={() => setTemplateView(value)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {quickTemplates.length ? (
                <div className="template-library-grid">
                  {quickTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={
                        "template-library-card" +
                        (docTemplate === t.id ? " selected" : "")
                      }
                      onClick={() => selectDocumentTemplate(t.id)}
                    >
                      <span>
                        <b>{t.label}</b>
                        {favoriteTemplates.includes(t.id) && (
                          <i aria-label="Favorite">★</i>
                        )}
                      </span>
                      <small>{t.description}</small>
                      <em>{label(t.category)}</em>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="template-library-empty">
                  {templateView === "favorites"
                    ? "No favorites yet. Select a template and tap “Favorite selected.”"
                    : "No recent templates yet. Start a guided draft and it will appear here."}
                </div>
              )}
            </div>
            <form className="document-form" onSubmit={createDocument}>
              <div className="form-split">
                <label>
                  Starting template
                  <select
                    value={docTemplate}
                    onChange={(e) => selectDocumentTemplate(e.target.value)}
                  >
                    {documentTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="ghost inline"
                  type="button"
                  disabled={busy || !projects.length}
                  onClick={startTemplateWizard}
                >
                  Start guided draft
                </button>
              </div>
              <p className="muted">
                <b>
                  {
                    documentTemplates.find((t) => t.id === docTemplate)
                      ?.description
                  }
                </b>{" "}
                The guided draft prefills known client and project details, asks
                only for information SRCcvde cannot know, then produces a fully
                editable document.
              </p>
              {wizardOpen && (
                <div className="template-wizard">
                  <div className="template-wizard-head">
                    <div>
                      <p className="eyebrow">Guided draft</p>
                      <h3>
                        {
                          documentTemplates.find((t) => t.id === docTemplate)
                            ?.label
                        }
                      </h3>
                    </div>
                    <span className="status">
                      {
                        [...wizardBase.matchAll(/\[REQUIRED:\s*([^\]]+)\]/g)]
                          .length
                      }{" "}
                      questions
                    </span>
                  </div>
                  <div className="template-wizard-fields">
                    {[...wizardBase.matchAll(/\[REQUIRED:\s*([^\]]+)\]/g)].map(
                      (match, index) => {
                        const question = match[1].trim();
                        return (
                          <label key={question}>
                            <span>
                              <b>{String(index + 1).padStart(2, "0")}</b>
                              {question}
                            </span>
                            <textarea
                              value={wizardAnswers[question] || ""}
                              onChange={(e) =>
                                setWizardAnswers((prev) => ({
                                  ...prev,
                                  [question]: e.target.value,
                                }))
                              }
                              placeholder="Enter the project-specific answer…"
                              rows={question.length > 85 ? 4 : 3}
                            />
                          </label>
                        );
                      },
                    )}
                  </div>
                  <div className="template-wizard-actions">
                    <button
                      className="ghost inline"
                      type="button"
                      onClick={cancelTemplateWizard}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary inline"
                      type="button"
                      onClick={generateWizardDraft}
                    >
                      Generate editable document
                    </button>
                  </div>
                </div>
              )}
              <label>
                Document name
                <input
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="Project Agreement"
                  required
                />
              </label>
              <div className="form-split">
                <label>
                  Category
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                  >
                    <option value="agreement">Agreement</option>
                    <option value="proposal">Proposal</option>
                    <option value="scope">Scope</option>
                    <option value="approval">Approval</option>
                  </select>
                </label>
                <label>
                  Action
                  <select
                    value={docKind}
                    onChange={(e) => setDocKind(e.target.value)}
                  >
                    <option value="signature">Signature required</option>
                    <option value="acknowledgment">
                      Acknowledgment required
                    </option>
                  </select>
                </label>
              </div>
              <label>
                Exact document content
                <textarea
                  className="document-editor"
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Choose a template or compose the exact version the client will review…"
                  required
                  minLength={20}
                />
              </label>
              <button className="primary" disabled={busy}>
                Send to client workspace
              </button>
            </form>
          </section>
        </section>
        <aside>
          <ActivityFeed rows={activity} />
        </aside>
      </div>
    </>
  );
}
