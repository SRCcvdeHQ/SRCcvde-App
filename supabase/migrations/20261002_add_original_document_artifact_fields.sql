-- Track the immutable ORIGINAL artifact alongside the fully EXECUTED PDF.
alter table public.executed_document_artifacts
  add column if not exists original_storage_path text,
  add column if not exists original_sha256 text,
  add column if not exists drive_original_file_id text;

comment on column public.executed_document_artifacts.original_storage_path is 'Private Storage path for the immutable pre-signature source PDF.';
comment on column public.executed_document_artifacts.original_sha256 is 'SHA-256 of the generated immutable pre-signature source PDF.';
comment on column public.executed_document_artifacts.drive_original_file_id is 'Google Drive file id for the archived ORIGINAL PDF.';
