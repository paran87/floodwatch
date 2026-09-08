-- Google Sheets import staging, review, and audit tables.
-- Additive only. Does not alter flood_prone_areas or equipment_fund_requests.

create table if not exists public.google_sheet_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_spreadsheet_id text not null,
  source_sheet_name text not null,
  target_table text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_rows integer not null default 0,
  new_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  possible_duplicate_rows integer not null default 0,
  approved_rows integer not null default 0,
  merged_rows integer not null default 0,
  rejected_rows integer not null default 0,
  error_rows integer not null default 0,
  skipped_rows integer not null default 0,
  status text not null default 'running',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists google_sheet_import_batches_started_idx
  on public.google_sheet_import_batches (started_at desc);

create table if not exists public.google_sheet_imports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.google_sheet_import_batches(id) on delete cascade,
  source_spreadsheet_id text not null,
  source_sheet_name text not null,
  source_row_number integer not null,
  source_row_hash text not null,
  target_table text not null,
  raw_data jsonb not null,
  normalized_data jsonb,
  status text not null default 'pending',
  duplicate_type text,
  duplicate_confidence numeric,
  matched_record_id uuid,
  ai_reason text,
  validation_errors jsonb,
  warnings jsonb,
  processed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_sheet_imports_source_row_key unique (
    source_spreadsheet_id,
    source_sheet_name,
    source_row_number
  )
);

create index if not exists google_sheet_imports_batch_idx
  on public.google_sheet_imports (batch_id);

create index if not exists google_sheet_imports_status_idx
  on public.google_sheet_imports (status);

create index if not exists google_sheet_imports_target_idx
  on public.google_sheet_imports (target_table);

create index if not exists google_sheet_imports_source_idx
  on public.google_sheet_imports (source_spreadsheet_id, source_sheet_name);

create index if not exists google_sheet_imports_row_number_idx
  on public.google_sheet_imports (source_row_number);

create index if not exists google_sheet_imports_matched_idx
  on public.google_sheet_imports (matched_record_id);

create table if not exists public.google_sheet_import_actions (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.google_sheet_imports(id) on delete cascade,
  batch_id uuid references public.google_sheet_import_batches(id) on delete cascade,
  action text not null,
  existing_record_id uuid,
  final_record_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  performed_by text,
  created_at timestamptz not null default now()
);

create index if not exists google_sheet_import_actions_import_idx
  on public.google_sheet_import_actions (import_id);

create index if not exists google_sheet_import_actions_batch_idx
  on public.google_sheet_import_actions (batch_id);

create index if not exists google_sheet_import_actions_created_idx
  on public.google_sheet_import_actions (created_at desc);

drop trigger if exists google_sheet_imports_set_updated_at on public.google_sheet_imports;
create trigger google_sheet_imports_set_updated_at
before update on public.google_sheet_imports
for each row execute function public.set_updated_at();

alter table public.google_sheet_import_batches enable row level security;
alter table public.google_sheet_imports enable row level security;
alter table public.google_sheet_import_actions enable row level security;

drop policy if exists google_sheet_import_batches_select on public.google_sheet_import_batches;
drop policy if exists google_sheet_imports_select on public.google_sheet_imports;
drop policy if exists google_sheet_import_actions_select on public.google_sheet_import_actions;

-- Readable by the dashboard. Writes are intended for the server secret key (bypasses RLS).
create policy google_sheet_import_batches_select
  on public.google_sheet_import_batches for select using (true);
create policy google_sheet_imports_select
  on public.google_sheet_imports for select using (true);
create policy google_sheet_import_actions_select
  on public.google_sheet_import_actions for select using (true);
