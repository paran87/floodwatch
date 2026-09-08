-- Flood-prone area management schema
-- Run in the Supabase SQL editor if the seed script cannot apply DDL automatically.

create extension if not exists postgis;

create table if not exists public.flood_prone_areas (
  id uuid primary key default gen_random_uuid(),
  name text,
  address text,
  barangay text,
  city_municipality text not null,
  road_name text,
  road_length numeric,
  latitude double precision,
  longitude double precision,
  flood_status text not null default 'Flood-prone',
  description text,
  geometry jsonb,
  geom geography(Geometry, 4326),
  region text,
  deo text,
  location_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flood_prone_areas_lat_check check (latitude is null or latitude between -90 and 90),
  constraint flood_prone_areas_lng_check check (longitude is null or longitude between -180 and 180)
);

create unique index if not exists flood_prone_areas_dedup_idx
  on public.flood_prone_areas (
    coalesce(region, ''),
    coalesce(deo, ''),
    coalesce(city_municipality, ''),
    coalesce(barangay, ''),
    coalesce(road_name, '')
  );

create index if not exists flood_prone_areas_status_idx on public.flood_prone_areas (flood_status);
create index if not exists flood_prone_areas_city_idx on public.flood_prone_areas (city_municipality);
create index if not exists flood_prone_areas_updated_idx on public.flood_prone_areas (updated_at desc);
create index if not exists flood_prone_areas_geom_idx on public.flood_prone_areas using gist (geom);

create table if not exists public.equipment_fund_requests (
  id uuid primary key default gen_random_uuid(),
  region text,
  date_requested date,
  subject text,
  equipment text not null,
  quantity numeric,
  request_total numeric,
  status text,
  aging text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists flood_prone_areas_set_updated_at on public.flood_prone_areas;
create trigger flood_prone_areas_set_updated_at
before update on public.flood_prone_areas
for each row execute function public.set_updated_at();

drop trigger if exists equipment_fund_requests_set_updated_at on public.equipment_fund_requests;
create trigger equipment_fund_requests_set_updated_at
before update on public.equipment_fund_requests
for each row execute function public.set_updated_at();

create or replace function public.sync_flood_geom()
returns trigger
language plpgsql
as $$
begin
  if new.geometry is not null and new.geometry ? 'type' then
    new.geom = st_geogfromgeojson(new.geometry::text);
  elsif new.latitude is not null and new.longitude is not null then
    new.geom = st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.geom = null;
  end if;
  return new;
end;
$$;

drop trigger if exists flood_prone_areas_sync_geom on public.flood_prone_areas;
create trigger flood_prone_areas_sync_geom
before insert or update of latitude, longitude, geometry
on public.flood_prone_areas
for each row execute function public.sync_flood_geom();

alter table public.flood_prone_areas enable row level security;
alter table public.equipment_fund_requests enable row level security;

drop policy if exists flood_prone_areas_select on public.flood_prone_areas;
drop policy if exists flood_prone_areas_insert on public.flood_prone_areas;
drop policy if exists flood_prone_areas_update on public.flood_prone_areas;
drop policy if exists flood_prone_areas_delete on public.flood_prone_areas;
drop policy if exists equipment_fund_requests_select on public.equipment_fund_requests;
drop policy if exists equipment_fund_requests_insert on public.equipment_fund_requests;
drop policy if exists equipment_fund_requests_update on public.equipment_fund_requests;
drop policy if exists equipment_fund_requests_delete on public.equipment_fund_requests;

-- Internal operations dashboard: anon key can manage records.
-- Tighten these policies if you later add authenticated users.
create policy flood_prone_areas_select on public.flood_prone_areas for select using (true);
create policy flood_prone_areas_insert on public.flood_prone_areas for insert with check (true);
create policy flood_prone_areas_update on public.flood_prone_areas for update using (true) with check (true);
create policy flood_prone_areas_delete on public.flood_prone_areas for delete using (true);

create policy equipment_fund_requests_select on public.equipment_fund_requests for select using (true);
create policy equipment_fund_requests_insert on public.equipment_fund_requests for insert with check (true);
create policy equipment_fund_requests_update on public.equipment_fund_requests for update using (true) with check (true);
create policy equipment_fund_requests_delete on public.equipment_fund_requests for delete using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.flood_prone_areas;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

-- Google Sheets import staging (additive). Production flood_prone_areas stays the source of truth.
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

create index if not exists google_sheet_imports_batch_idx on public.google_sheet_imports (batch_id);
create index if not exists google_sheet_imports_status_idx on public.google_sheet_imports (status);
create index if not exists google_sheet_imports_target_idx on public.google_sheet_imports (target_table);
create index if not exists google_sheet_imports_source_idx
  on public.google_sheet_imports (source_spreadsheet_id, source_sheet_name);
create index if not exists google_sheet_imports_row_number_idx on public.google_sheet_imports (source_row_number);
create index if not exists google_sheet_imports_matched_idx on public.google_sheet_imports (matched_record_id);

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

create index if not exists google_sheet_import_actions_import_idx on public.google_sheet_import_actions (import_id);
create index if not exists google_sheet_import_actions_batch_idx on public.google_sheet_import_actions (batch_id);
create index if not exists google_sheet_import_actions_created_idx on public.google_sheet_import_actions (created_at desc);

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

create policy google_sheet_import_batches_select
  on public.google_sheet_import_batches for select using (true);
create policy google_sheet_imports_select
  on public.google_sheet_imports for select using (true);
create policy google_sheet_import_actions_select
  on public.google_sheet_import_actions for select using (true);
