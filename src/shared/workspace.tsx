export type Role = "owner" | "admin" | "staff" | "client";

export type Membership = {
  role: Role;
  status: "invited" | "active" | "suspended";
};

export type Profile = { full_name: string | null; email: string | null };

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  project_type: string;
  budget_range: string;
  timeline: string;
  involvement: string;
  details: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  primary_contact_name: string;
  primary_email: string;
  status: string;
  drive_folder_id: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  project_type: string | null;
  status: string;
  phase: string;
  progress: number;
  created_at: string;
};

export type Note = { id: string; body: string; created_at: string };

export type Activity = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  client_id: string;
  name: string;
  category: string;
  state: string;
  client_visible: boolean;
  created_at: string;
  signature_kind?: "signature" | "acknowledgment" | null;
  executed_artifact_id?: string | null;
  drive_file_id?: string | null;
};

export type ExecutedArtifact = {
  id: string;
  document_id: string;
  storage_path: string;
  final_sha256: string;
  byte_size: number;
  generated_at: string;
  drive_sync_status: "pending" | "synced" | "failed" | "not_configured";
  drive_file_id: string | null;
  drive_error: string | null;
  original_storage_path: string | null;
  original_sha256: string | null;
  drive_original_file_id: string | null;
  metadata?: { source_sha256?: string } | null;
};

export type Communication = {
  id: string;
  client_id?: string;
  project_id?: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  created_at: string;
  delivery_status?: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
};

export type SignatureRequest = {
  id: string;
  document_id: string;
  document_version_id: string;
  client_id: string;
  project_id: string | null;
  signer_name: string;
  signer_email: string;
  signer_side: "client" | "srccvde";
  signature_kind: "signature" | "acknowledgment";
  status: string;
  consent_text: string;
  requested_at: string;
  signed_at: string | null;
  legal_name: string | null;
};

export type DocumentVersion = {
  id: string;
  document_id: string;
  version_number: number;
  content_snapshot: string;
  content_sha256: string;
  state: string;
  created_at: string;
};

export type Milestone = {
  id: string;
  project_id: string;
  milestone_key: string;
  title: string;
  description: string | null;
  position: number;
  status: string;
  client_visible: boolean;
  due_at?: string | null;
  completed_at?: string | null;
};

export type ClientAction = {
  id: string;
  client_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  action_type: string;
  status: string;
  due_at: string | null;
  response: string | null;
  created_at: string;
  completed_at: string | null;
};

export type BillingInvoice = {
  id: string;
  client_id: string;
  project_id: string | null;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
  client_visible: boolean;
  created_at: string;
  artifact_path?: string | null;
  finalized_at?: string | null;
  clients?: { name: string } | null;
  projects?: { name: string } | null;
};

export type Handoff = {
  id: string;
  client_id: string;
  project_id: string | null;
  status: string;
  meeting_at: string | null;
  meeting_url: string | null;
  verification_email: string | null;
  verified_at: string | null;
  effective_at: string | null;
  aftercare_ends_at: string | null;
  admin_removal_notice_at: string | null;
  admin_removed_at: string | null;
  retention_ends_at: string | null;
  archive_generated_at: string | null;
  archive_downloaded_at: string | null;
  data_deleted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type HandoffTask = {
  id: string;
  handoff_id: string;
  task_key: string;
  title: string;
  category: string;
  position: number;
  required: boolean;
  status: "pending" | "complete" | "not_applicable";
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
};

export type TemplateContext = {
  clientName: string;
  clientContact: string;
  clientEmail: string;
  projectName: string;
  projectType: string;
  projectPhase: string;
  today: string;
};

export type DocumentTemplate = {
  id: string;
  label: string;
  description: string;
  documentName: string;
  category: string;
  signatureKind: "signature" | "acknowledgment";
  buildContent: (ctx: TemplateContext) => string;
};

export const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;

export const PROJECT_FILE_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "svg",
  "heic",
  "heif",
  "zip",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "txt",
  "md",
  "mp4",
  "mov",
];

export function validateProjectFile(file: File) {
  if (file.size > MAX_PROJECT_FILE_BYTES)
    return "Files must be 25 MB or smaller.";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!PROJECT_FILE_EXTENSIONS.includes(ext))
    return "Unsupported file type. Use PDF, images including HEIC, ZIP, Office files, CSV, TXT, Markdown, MP4 or MOV.";
  return "";
}

export const leadStatuses = [
  "new",
  "contacted",
  "discovery",
  "proposal",
  "contract",
  "won",
  "lost",
  "archived",
];

export const projectStages = [
  { value: "introduction", label: "Introduction" },
  { value: "discovery", label: "Discovery" },
  { value: "planning", label: "Planning" },
  { value: "contract", label: "Contract" },
  { value: "building", label: "Building" },
  { value: "developing", label: "Developing" },
  { value: "qa_qc", label: "QA/QC" },
  { value: "launch", label: "Launch" },
  { value: "aftercare", label: "Aftercare" },
  { value: "end_of_service", label: "End Of Service" },
];

export const stages = projectStages.map((stage) => stage.label);

export const label = (s: string) =>
  s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const date = (s: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(s));

export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    (cents || 0) / 100,
  );

export const addDaysIso = (value: string, days: number) =>
  new Date(new Date(value).getTime() + days * 86400000).toISOString();

export const localDateTimeInput = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export const daysUntil = (value: string | null) =>
  value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;

export const path = () => window.location.pathname.replace(/\/+$/, "") || "/";
