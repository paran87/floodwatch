-- FloodWatch — Supabase secondary datastore
--
-- Scope: this schema NEVER stores flood-prone-area source records. Those
-- remain exclusively in the "Flood Prone Areas" Google Sheet, accessed only
-- through Google Apps Script. Supabase holds:
--   - location_cache         geocoded coordinates, keyed to a sheet row, reused across loads
--   - location_review_queue  low-confidence geocoding results awaiting manual verification
--   - reports                user-submitted flood reports
--   - activity_logs          audit trail (never contains secrets/passwords/tokens)
--   - users                  role assignments (admin / editor / viewer) for Google-authenticated emails

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users: role assignments for Google Sign-In authenticated emails.
-- A missing row means "viewer" (see src/lib/auth.ts) — never "admin" by default.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- location_cache: resolved coordinates for a Sheet row, so geocoding is not
-- repeated on every map load. `sheet_row_index` ties back to the data row
-- number in the "FLOOD PRONE" tab (1-based data index, not spreadsheet row).
-- ---------------------------------------------------------------------------
create table if not exists location_cache (
  sheet_row_index integer primary key,
  latitude double precision,
  longitude double precision,
  accuracy text not null check (
    accuracy in ('exact', 'address', 'road', 'barangay', 'municipality', 'province', 'region', 'unresolved')
  ),
  source text not null check (
    source in ('existing_coordinates', 'geocoded', 'manually_verified', 'approximate', 'unresolved')
  ),
  geocoding_query text,
  geocoding_status text not null default 'not_attempted' check (
    geocoding_status in ('not_attempted', 'pending', 'resolved', 'needs_review', 'failed')
  ),
  geocoded_at timestamptz,
  verified boolean not null default false,
  verified_by text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- location_review_queue: records whose automatic resolution confidence was
-- too low to trust, awaiting an authorized user's manual verification.
-- ---------------------------------------------------------------------------
create table if not exists location_review_queue (
  id uuid primary key default gen_random_uuid(),
  sheet_row_index integer not null references location_cache(sheet_row_index) on delete cascade,
  proposed_latitude double precision,
  proposed_longitude double precision,
  proposed_accuracy text,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'adjusted', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists location_review_queue_status_idx on location_review_queue (status);

-- ---------------------------------------------------------------------------
-- reports: user-submitted flood incident reports (separate from the static
-- flood-prone-area dataset).
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'dismissed')),
  severity text not null default 'moderate' check (severity in ('low', 'moderate', 'severe', 'critical')),
  region text,
  province text,
  municipality_city text,
  barangay text,
  latitude double precision,
  longitude double precision,
  linked_flood_prone_area_row_index integer,
  reported_by text not null,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists reports_status_idx on reports (status);
create index if not exists reports_region_idx on reports (region);

-- ---------------------------------------------------------------------------
-- activity_logs: audit trail. Never insert passwords, API keys, or tokens
-- into `message` — see src/lib/api.ts logActivity().
-- ---------------------------------------------------------------------------
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'LOGIN', 'CREATE_REPORT', 'UPDATE_REPORT', 'DELETE_REPORT', 'UPDATE_FLOOD_AREA',
      'LOCATION_GEOCODED', 'LOCATION_VERIFIED', 'AUTHORIZATION_FAILURE', 'VALIDATION_FAILURE'
    )
  ),
  actor_email text,
  target_type text not null check (target_type in ('flood_prone_area', 'report', 'location', 'user', 'system')),
  target_id text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx on activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: all access from the Next.js server goes through the
-- service-role key (src/lib/supabase.ts), which bypasses RLS by design.
-- RLS is enabled regardless so that no anon/public key — if ever issued —
-- can read or write these tables directly.
-- ---------------------------------------------------------------------------
alter table users enable row level security;
alter table location_cache enable row level security;
alter table location_review_queue enable row level security;
alter table reports enable row level security;
alter table activity_logs enable row level security;

-- No policies are defined: with RLS enabled and zero policies, all access
-- via the anon/authenticated keys is denied by default. Only the
-- service-role key (used exclusively server-side) can read/write.
