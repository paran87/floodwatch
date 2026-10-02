# FloodWatch — Supabase (secondary datastore)

This Supabase project is **not** the flood-prone-area database. It exists
only to support features Google Sheets handles poorly:

| Table | Purpose |
|---|---|
| `location_cache` | Geocoded lat/lng per sheet row, so geocoding runs once and is reused. |
| `location_review_queue` | Low-confidence geocoding results waiting on manual verification. |
| `reports` | User-submitted flood incident reports. |
| `activity_logs` | Audit trail (`LOGIN`, `CREATE_REPORT`, `LOCATION_VERIFIED`, etc.). |
| `users` | Role assignment (`admin` / `editor` / `viewer`) per Google-authenticated email. |

The authoritative flood-prone-area records live only in the "Flood Prone
Areas" Google Sheet, read and written exclusively through the Apps Script
backend (`apps-script/`). No table above ever duplicates or replaces that
data — `location_cache` and `location_review_queue` reference a sheet row
by its 1-based data-row index, nothing more.

## Setup

1. Create a Supabase project (or reuse an existing one — do not create a
   second project once one exists for this app).
2. Apply the migration:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   or paste `migrations/0001_init.sql` into the SQL editor.
3. Copy the project URL and **service_role** key into `.env.local` as
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put the service
   role key in a `NEXT_PUBLIC_*` variable — it is used only by server-only
   modules (`src/lib/supabase.ts`, `src/lib/api.ts`, `src/lib/auth.ts`).
4. Seed at least one admin row so the app is usable:
   ```sql
   insert into users (email, name, role) values ('you@example.com', 'You', 'admin');
   ```

## Row Level Security

RLS is enabled on every table with zero policies attached, so the anon/
authenticated keys are denied by default. All reads/writes happen through
the service-role key, server-side, inside Next.js. If a future feature
needs direct browser access to Supabase, add explicit RLS policies first —
do not disable RLS as a shortcut.
