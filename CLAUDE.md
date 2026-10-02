# CLAUDE.md — FloodWatch

This file is the first thing to read before making any change to this
repository. It documents what exists, why it's shaped this way, and the
safety rules that must not be bypassed — especially around the production
Google Sheet, which is **existing, real operational data**, not a fixture.

## 1. Project purpose

FloodWatch monitors, maps, manages, and analyzes flood-prone areas (mostly
road/waterway segments maintained by DPWH District Engineering Offices)
across the Philippines, plus user-submitted flood incident reports. It is
built around an **existing** Google Sheet — the application adapts to that
data, not the other way around.

## 2. Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Flood-prone-area backend | Google Apps Script (the only thing allowed to read/write the Sheet) |
| Flood-prone-area datastore | Google Sheets — "Flood Prone Areas" spreadsheet, tab "FLOOD PRONE" |
| Secondary datastore | Supabase (Postgres) — project **"floodwatch"** (`afoikqgiqcxiaavoaytg`, org "bragz's Org", region ap-southeast-1) — geocode cache, location review queue, reports, activity logs, user roles. A dedicated project: two pre-existing, unrelated Supabase projects on this account were found and deliberately not reused — see §17. |
| Auth | NextAuth v5 + Google Sign-In |
| Hosting | Vercel (Next.js), continuous deployment from `main` |
| Source control | GitHub — `paran87/floodwatch` |

## 3. Architecture

```
                         USER
                           │
                           ▼
                   ┌────────────────┐
                   │     VERCEL     │
                   │    Next.js     │
                   │  (server-side) │
                   └───┬────────┬───┘
                       │        │
          shared-secret│        │service-role key
           (server-only)       (server-only)
                       │        │
                       ▼        ▼
            ┌────────────────┐  ┌────────────────┐
            │ GOOGLE APPS    │  │    SUPABASE    │
            │    SCRIPT      │  │   (Postgres)   │
            │ Sheets gateway │  │ secondary store│
            └───────┬────────┘  └────────────────┘
                    │
                    ▼
            ┌────────────────┐
            │ GOOGLE SHEETS  │
            │ Flood Prone    │
            │ Areas          │
            └────────────────┘
```

This deviates from a single-backend diagram deliberately: **Google Sheets
remains the sole source of truth for flood-prone-area records**, reached
only through Apps Script. **Supabase is a secondary datastore** that never
duplicates or replaces that data — it holds things Sheets handles badly:

- `location_cache` — geocoded coordinates per sheet row, cached so geocoding
  isn't repeated on every page load.
- `location_review_queue` — low-confidence geocoding results awaiting
  manual verification.
- `reports` — user-submitted flood incident reports (distinct from the
  static flood-prone-area reference dataset).
- `activity_logs` — the audit trail.
- `users` — role assignment (`admin` / `editor` / `viewer`) per
  Google-authenticated email.

Both the Apps Script client (`src/lib/apps-script.ts`) and the Supabase
client (`src/lib/supabase.ts`) are **server-only** — the browser never talks
to either directly. Client Components call this app's own Route Handlers
under `src/app/api/`, which hold the real secrets and forward the request.

## 4. GitHub repository

- Repo: `paran87/floodwatch` (private)
- Default branch: `main`
- This is a **separate repository** from `paran87/flutter-game` — never
  push FloodWatch changes there, and never touch flutter-game from here.

## 5. Vercel deployment

- Connect this GitHub repo to a Vercel project; production deploys follow
  pushes to `main` automatically. Don't tell a user to manually redeploy
  unless automatic deployment genuinely failed — diagnose first.
- Required environment variables on Vercel: everything in `.env.example`.
  `APPS_SCRIPT_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must be set as
  **server-only** env vars (never `NEXT_PUBLIC_*`).

## 6. Google Sheets data model (discovered, not assumed)

Spreadsheet: **"Flood Prone Areas"**
(`11iAygKmAlHTmtG6wFT2gWOCxCleGBidNQie4ZhVE42w`), owned by the account this
app is built for. One tab: **`FLOOD PRONE`**.

- Row 1: merged title row ("FLOOD PRONE AREAS"), not data.
- Row 2: header row. Columns A–I:
  `Region, Province, Municipality/City, DEO, Barangay, Road Name/Waterways, KM Station Limit, Latitude, Longitude`
- Rows 3–1766: data (~1,763 records). Columns J–N exist in the sheet's grid
  but are completely empty/unused — do not read or write them.

**Known data-shape quirks** (verified by inspection on 2026-10-02, not
assumed):
- `Region` is visually merged across repeated rows; the stored cell value
  is **blank** on every row after the first occurrence of a region. All
  Sheets-reading code must forward-fill `Region` (see
  `apps-script/Utils.js forwardFillColumn_` and
  `src/lib/utils.ts forwardFillRegion`) rather than treating a blank as
  "missing." Province/Municipality/DEO/Barangay/Road do **not** use this
  pattern — they're filled per row (small numbers of genuinely blank cells
  exist: ~9–22 out of 1,763 depending on column).
- **Latitude/Longitude are blank for 100% of current records** (0 of
  ~1,763). This is expected, not a bug — see §8.
- A handful of records (3 observed, all in Nueva Ecija) have a
  `"lat, lng"` string typed into the **`KM Station Limit`** column instead
  of Road Name/Waterways being blank and coordinates going in H/I. This is
  surfaced by `LocationResolver` as a review-queue candidate — **never**
  auto-trusted or silently "fixed" in the sheet.

**Never:** rename tabs/columns, clear rows, bulk-overwrite records, add new
columns to this sheet, or create a second "Flood Prone Areas" spreadsheet.
If a column genuinely needs adding later (e.g. the suggested
`location_verified` fields), propose it and get explicit approval first —
and prefer Supabase (which already exists for exactly this purpose) over
touching the production sheet at all.

## 7. Folder structure

```
floodwatch/
├── src/
│   ├── app/                     — Next.js App Router pages + API routes
│   ├── components/
│   │   ├── ui/                  — Button, Input, Select, Table, Card, Badge, Alert…
│   │   ├── dashboard/           — StatsCards, RegionBreakdown, LocationResolutionBreakdown
│   │   ├── flood-prone-areas/   — AreaTable, AreaFilters, LocationBadge
│   │   ├── reports/             — ReportTable, ReportFilters, StatusBadge, SeverityBadge
│   │   ├── maps/                — FloodMap (Leaflet), typed marker conversion
│   │   ├── layout/               — AppShell, Sidebar, Topbar
│   │   └── shared/               — LoadingState, EmptyState, ErrorState
│   ├── lib/
│   │   ├── apps-script.ts       — SERVER-ONLY typed client for the Sheets gateway
│   │   ├── supabase.ts          — SERVER-ONLY Supabase client (service role)
│   │   ├── api.ts               — SERVER-ONLY Supabase-backed data access (reports, logs, review queue)
│   │   ├── auth.ts              — NextAuth config, Google Sign-In, role lookup
│   │   ├── types.ts             — domain types, matched to the REAL sheet schema
│   │   ├── constants.ts
│   │   └── utils.ts
│   └── hooks/                   — client hooks that call this app's own /api routes
├── apps-script/                 — pushed to Google Apps Script via clasp
├── supabase/migrations/         — SQL schema for the secondary datastore
└── CLAUDE.md
```

Don't add a new top-level folder without explaining why here first.

## 8. Location resolution & geocoding

Hierarchy (strongest to weakest) — see `apps-script/LocationResolver.js`
and mirrored in `src/lib/constants.ts`:

1. Existing latitude + longitude (currently: none)
2. Exact address/location description
3. Road + barangay + municipality + province
4. Barangay + municipality + province
5. Municipality + province
6. Province
7. Region
8. Insufficient information → `unresolved`

**Never invent coordinates.** A record with only municipality-level
information gets a `municipality`-level accuracy classification and an
approximate point — the UI shows it as approximate (amber marker, "needs
review" badge), never plotted as if it were exact.

**Geocoding provider: Nominatim (OpenStreetMap)**, chosen over Google's
Geocoding API because it needs no API key or billing-enabled GCP project
(the same custom-GCP-project requirement that blocked `clasp run` — see
§11). Tradeoff: its usage policy caps requests at 1/sec and requires a
descriptive User-Agent, and rural/remote-area road coverage is
inconsistent (confirmed directly: several Davao Oriental road segments
had no OSM match at all and correctly fell back to municipality-level).
Apps Script's `LocationResolver.js callGeocodingProvider_` seam is
**unused** — see "Where geocoding actually runs" below for why.

### Where geocoding actually runs

Not in Apps Script. Supabase is Next.js-exclusive by design (Apps Script
has no visibility into it), so the geocoding call and the Supabase write
both had to happen on the same side — Next.js was the natural fit, since
Apps Script's job is strictly "Sheets gateway."

```
src/app/api/admin/geocode (POST, shared-secret gated)
   → getFloodProneAreas()              Apps Script — candidate rows + their query
   → getCachedLocations()              Supabase — skip anything already done
   → buildGeocodingQueries()           src/lib/geocoding.ts — road→barangay→municipality→province→region fallback tiers
   → geocodeWithFallback()             src/lib/geocoding.ts — Nominatim, 1 req/sec, tries tiers until one hits
   → classifyGeocodeResult()           src/lib/geocoding.ts — decides resolved vs needs_review
   → upsertLocationCache() / enqueueLocationReview()   Supabase — persists the outcome
```

**Idempotency:** a row already `resolved` or `needs_review` in
`location_cache` is never reprocessed — only `not_attempted`-equivalent
(no cache row) or a previous `failed` (transient error) are eligible.
Verified directly: re-running the same province twice advanced to the
next batch of rows both times, with zero duplicate processing.

**Confidence/ambiguity handling** (`classifyGeocodeResult`): a match is
trusted as exact only if (a) it came from the road or barangay query tier,
**and** (b) the result's `display_name` mentions the record's province.
Anything that only matched at municipality/province/region tier, or
whose result doesn't clearly mention the right province, goes to
`needs_review` with a specific, human-readable reason — never silently
trusted. Confirmed with a real case: a mismatched/low-specificity result
correctly produced `"Only municipality-level location information was
specific enough to geocode..."` rather than a false "resolved."

**Rate limits & errors:** `geocodeWithFallback` throttles to ≤1 req/sec
across all tiers tried (shared module-level timestamp). An HTTP 429 stops
the whole batch immediately (not just that record) rather than continuing
to hammer a provider that just rejected a request; other errors are
logged per-record and marked `failed` (retried on a future run) without
aborting the batch. All non-success paths write to `activity_logs` with a
specific message (no result / API error / rate limit) via the existing
`VALIDATION_FAILURE` event type — no schema change needed, since
`activity_logs.message` is free text and `location_cache.geocoding_status`
already has the right granularity (`not_attempted` / `pending` / `resolved`
/ `needs_review` / `failed`).

**Caching:** resolved coordinates live in Supabase's `location_cache`
(keyed by `sheet_row_index`), overlaid onto Apps Script's live
classification by `src/lib/overlayLocations.ts` in both
`/api/flood-prone-areas` routes — the only place the two are merged.
That overlay is wrapped in try/catch in both routes: if Supabase is ever
unreachable, the Sheet-derived listing still succeeds (same lesson as the
`/api/dashboard` fix).

**Manual verification:** `location_review_queue` holds low-confidence
results (including the stray-coordinate quirk in §6) for an authorized
user to accept, adjust, or reject. The review **UI** is still not built —
the data model and the proposed-coordinate surfacing to the frontend are
done (a `needs_review` row's `proposedLatitude/Longitude` already renders
as the amber marker), but there's no admin page yet to act on
`location_review_queue.status`. See §14.

**Running it:** `POST /api/admin/geocode` with header `x-admin-key:
<GEOCODING_ADMIN_KEY>` and JSON body `{"province": "...", "batchSize": N}`
(both optional — omit `province` to pull from the whole dataset, omit
`batchSize` for the default of 20, max 100). Not gated by real user
auth yet (see §13) since Google Sign-In isn't configured in this
environment — gate it behind `canPerform(role, ...)` once it is, same as
reports.

**Map behavior:** `src/components/maps/types.ts toMapMarker()` returns
`null` for any record without a real or proposed point, and nothing
renders a marker for it. It stays visible in the data table with a
"needs location review" badge instead, now rendered as a clear
`MapUnavailable` empty state rather than a blank map — see
`src/components/maps/MapUnavailable.tsx` and
`src/components/flood-prone-areas/LocationBadge.tsx`.

## 9. Next.js conventions

- App Router, Server Components by default; `"use client"` only where
  interactivity/hooks require it (filters, tables with client-side
  pagination controls, the Leaflet map).
- `src/lib/apps-script.ts` and `src/lib/supabase.ts` carry `import
  "server-only"` — if a build ever fails because one of these got imported
  into a Client Component, that's the guard doing its job; fix the import,
  don't remove the guard.
- All reads/writes to Apps Script or Supabase go through `src/lib/*`, never
  as raw `fetch()`/Supabase calls scattered in components.
- Leaflet touches `window` at import time — always load `FloodMap` via
  `next/dynamic(..., { ssr: false })` (see
  `src/app/flood-prone-areas/page.tsx`).

## 10. Apps Script conventions

```
Code.js (doGet/doPost router)
   → authenticateRequest_   (Auth.js — shared-secret API key)
   → route by e.parameter.action
   → requireRole_ where relevant
   → feature module (FloodProneAreas.js / Dashboard.js)
   → successResponse_ / errorResponse_ (Response.js)
```

- Never assume column positions — everything is header-mapped
  (`Utils.js readSheetAsObjects_`).
- Only **read** actions are wired up today
  (`getFloodProneAreas`, `getFloodProneArea`, `getFloodProneAreaFacets`,
  `getDashboardStats`). Write actions are out of scope until explicitly
  approved — see §14.
- `Reports.js` and `Users.js` are intentionally near-empty: reports and
  user roles live in Supabase, not in this sheet. Don't add sheet-reading
  logic there without a reason tied to the actual sheet.
- Required Script Properties: `SPREADSHEET_ID`, `API_KEY`,
  `GEOCODING_PROVIDER` (default `none`), `GEOCODING_API_KEY` (once a
  provider is chosen). Never hard-code these in source.

## 11. clasp workflow

**Status: connected.** The Apps Script project is created, pushed, and
deployed:
- Script ID: `1jLSfgr-miuS8Xz8eGtTxMC3KYGzmX97lq20mMkmYGkwRBaiuwOe_Zk4f`
  (standalone project, titled "FloodWatch", owned by the same account that
  owns the "Flood Prone Areas" spreadsheet — not one of the pre-existing
  "flood"/"flood prone areas"/"Untitled project" scripts found during
  discovery, which all point at a *different*, unrelated spreadsheet).
- Versioned deployment `AKfycbzswWIUKAA75uLTHiWCxNE_KjMYFH_oRZhrOEilAa7gRjnRZPPHsPTxBMjonb2fq0LK`
  (`@1`, web app, access `ANYONE_ANONYMOUS` / execute as `USER_DEPLOYING`),
  exec URL `https://script.google.com/macros/s/AKfycbzswWIUKAA75uLTHiWCxNE_KjMYFH_oRZhrOEilAa7gRjnRZPPHsPTxBMjonb2fq0LK/exec`.
- Script Properties (`SPREADSHEET_ID`, `API_KEY`, `GEOCODING_PROVIDER=none`)
  are set — see `apps-script/Bootstrap.js` for how, since the obvious path
  didn't work:

**Two Apps Script gotchas hit during setup, for next time:**
1. `clasp create-script` overwrites the local `appsscript.json` with
   Google's generic default manifest (wrong timezone, no `webapp` block).
   Always `git diff apps-script/appsscript.json` right after creating a
   project and restore it before pushing.
2. `clasp run` (the Execution API) fails with a generic `NOT_FOUND` on a
   script using Apps Script's default (hidden) GCP project — it only works
   on a script linked to a custom, standard GCP project, which requires IDE
   access to set up. So Script Properties can't be set via `clasp run`
   without that extra setup. `Bootstrap.js` works around this with two
   actions reachable through the public web app endpoint instead —
   `bootstrapProperties` and `checkScriptProperties` — both listed in
   `Code.js`'s `UNAUTHENTICATED_ACTIONS_` map (the only entries that skip
   `authenticateRequest_`, because there's no `API_KEY` yet to check on the
   very first call). `bootstrapProperties` is self-disabling: it refuses
   to run again once `API_KEY` is set, so the unauthenticated window is
   only ever open until the first successful call. Never add another
   action to that map.
3. A freshly API-deployed web app also returns a blanket 403 to everyone,
   including the owner, until the deploying account completes a one-time
   manual OAuth consent for the project's scopes (normally handled
   automatically by the "Deploy" button in the Apps Script IDE, skipped
   entirely when deploying via `clasp`/the API). Fix: open
   `https://script.google.com/d/<scriptId>/edit`, pick any function in the
   toolbar dropdown (parameterless ones only — `doGet`/`doPost` are
   special-cased into that list even though they take `e`), click **Run**,
   and click through the "unverified app" consent prompt. The function can
   error after that (e.g. `doGet` with no real request object) — the
   authorization is granted before the function body runs, so that's fine.

Ongoing workflow:
```bash
clasp pull    # before pushing, to see what's actually deployed
clasp push    # uploads apps-script/* to the connected project (updates @HEAD only)
clasp redeploy <deploymentId> -d "..."   # updates the EXISTING versioned deployment (same exec URL) to current code
clasp create-deployment --description "..."   # only with explicit approval — creates a NEW deployment, a different exec URL
```
- Review the diff and confirm no secret is embedded before every push.
- `clasp push` alone updates only the `@HEAD` (development) deployment,
  which Next.js does **not** point at — a code change (e.g. the single-row
  read optimization in FloodProneAreas.js) isn't live until you also run
  `clasp redeploy` against the deployment ID Next.js actually uses.
- Do not run `clasp create-deployment` (a brand new deployment, a
  different exec URL) without explicit approval, since every existing
  config (`.env.local`, Next.js) points at one specific exec URL —
  creating a new deployment instead of redeploying the existing one
  silently breaks that until every consumer is updated.

## 12. API conventions

Every Apps Script action and every Next.js API route returns the same
envelope (`src/lib/types.ts ApiResponse<T>`):
```json
{ "success": true, "data": { } }
{ "success": false, "message": "Human-readable, safe message", "code": "ERROR_CODE" }
```
No stack traces or internal details ever reach the client.

## 13. Authentication & authorization

- **Authentication:** Google Sign-In via NextAuth (`src/lib/auth.ts`). No
  custom password storage exists anywhere in this stack — Sheets/Apps
  Script has no secure place to keep password hashes, so building one would
  violate spec §20 ("stop and explain the limitation rather than creating
  insecure authentication").
- **Authorization:** role (`admin` / `editor` / `viewer`) is looked up
  server-side from Supabase's `users` table by verified email. An email
  with no row defaults to `viewer` — never `admin`.
- Every mutating action must re-check the role **server-side** (Next.js API
  route via `canPerform()`, and — once write actions exist — Apps Script's
  own `requireRole_`). The frontend role check is a UI affordance only.
- Apps Script itself is protected by a shared-secret `apiKey` parameter
  (not a header — Apps Script's `doGet/doPost` can't read custom headers),
  checked in `Auth.js authenticateRequest_`. It also receives
  `actorEmail`/`actorRole`, already verified by Next.js before the call —
  this is defense in depth, not the primary auth boundary.

## 14. Not yet implemented (by design — this is a scaffold)

These are real gaps, not accidents, left for a deliberate next phase after
review:
- Write/update/delete actions for flood-prone areas (Apps Script side).
- The manual-verification review **UI** for `location_review_queue` —
  the data model, the batch job that populates it, and the frontend's
  rendering of a `needs_review` row (amber marker) are done; there's no
  admin page yet to accept/adjust/reject a queued entry.
- A report-creation form in the UI (the API route `POST /api/reports`
  exists and works; there's no form calling it yet).
- Gating `POST /api/admin/geocode` behind real user auth/role instead of
  a shared secret — see §8 "Running it."
- Running the geocoding batch job across the full dataset. As of this
  writing it's been run across 5 provinces (Cebu, Nueva Ecija, Pangasinan,
  Davao Oriental, Camarines Sur — 85 records, spanning Luzon/Visayas/
  Mindanao) as a deliberate, verified sample; the ~1,700 remaining
  road-tier records are untouched. Re-running the same endpoint with
  different/no `province` filters continues the job — it's idempotent and
  safe to resume.

## 15. Testing

Before calling any feature "done":
1. `npm run typecheck`
2. `npm run lint`
3. Exercise the Apps Script action manually (Apps Script editor's "Run" or
   a direct URL hit) before wiring it into the frontend.
4. Test empty/error/loading states, not just the happy path.
5. Confirm the production spreadsheet is unchanged (`clasp pull` plus a
   manual diff, or just re-reading the relevant range) after anything that
   touches Apps Script.

## 16. Git workflow

- Default branch `main`. No force-push, no history rewrites on shared
  branches, no destructive resets without explicit confirmation.
- Commit messages: `feat: …`, `fix: …`, `refactor: …`, `docs: …`.
- This repo and `paran87/flutter-game` are unrelated — never cross-merge or
  push between them.

## 17. Production safety (read this before touching Sheets or Supabase)

- The Google Sheet is **real operational data**. No destructive
  migration, no bulk overwrite, no clearing of rows/columns, ever, without
  explicit, specific approval for that exact operation.
- Prefer read-only Sheets operations until a write path has been reviewed
  and approved.
- Supabase holds no flood-prone-area records and should stay that way —
  if a future feature seems to need it to, that's a sign the architecture
  needs a conversation, not a quiet migration.
- **This account has other Supabase and Apps Script projects that are not
  FloodWatch's**, discovered during setup and deliberately left untouched:
  Supabase project "bragz" (shared with an unrelated video/photo-sharing
  app, and paused "bragz87@gmail.com's Project") and three Apps Script
  projects ("flood", "flood prone areas", "Untitled project") bound to a
  *different* spreadsheet shared by another account. Never assume a
  same-ish-named existing resource is this project's — verify its actual
  contents first, the way both of those were checked before FloodWatch's
  own dedicated project/deployment were created instead.
- Never log secrets (API keys, tokens, service-role key) anywhere,
  including `activity_logs.message`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
