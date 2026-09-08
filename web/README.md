# Floodwatch

A flood-prone area management dashboard for the DPWH inventory in `FLOOD PRONE AREAS & REQ. FUND FOR EQUIPMENT.xlsx`.

## What it does

- Lists all imported flood-prone roads with instant search
- Syncs a Leaflet/OpenStreetMap map with the selected record
- Draws flood-prone road segments in red once geometry is assigned
- Creates, edits, and deletes records in Supabase
- Tracks dashboard statistics from live database data
- Includes equipment fund requests from the second spreadsheet sheet
- Reviews Google Sheet rows in `/admin/google-import` before writing to Supabase

The source file has **no coordinates or road lengths**. Records are imported as-is. Use **Geocode**, **Drop pin**, or **Draw road** to place them. Coordinates are never invented during import.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

Use only the **publishable / anon** key in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Keep `SUPABASE_SECRET_KEY` server-side for seeding.

3. Apply the schema once. The Data API cannot create tables, so paste `supabase/schema.sql` into the Supabase SQL editor and run it. You can also click **Copy schema SQL** in the app.

4. Import the spreadsheet records with either **Import spreadsheet** in the app or:

```bash
npm run seed
```

5. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Google Sheet importer

FloodWatch remains the source of truth. Google Sheets rows are staged, validated, and reviewed before they can change `flood_prone_areas`.

1. Apply `supabase/migrations/20260907_google_sheet_imports.sql` in the **FloodWatch** Supabase SQL editor (not another project). If you are creating a new database, `supabase/schema.sql` already includes these tables.
2. Share the spreadsheet with the Google service-account email.
3. Set `GOOGLE_SHEETS_SPREADSHEET_ID` and `GOOGLE_SHEETS_CREDENTIALS` in `.env.local` and in Vercel. Keep `SUPABASE_SECRET_KEY` server-side.
4. Open [http://localhost:3000/admin/google-import](http://localhost:3000/admin/google-import) and click **Sync Now**.
5. Approve new rows or merge possible duplicates. The dashboard map and table already subscribe to Supabase Realtime on `flood_prone_areas`, so approved changes appear without a refresh.

Vercel Hobby does not run scheduled Sheet sync. Use **Sync Now** on `/admin/google-import`. The cron route is kept for later; do not add a `crons` entry in `vercel.json` until the project is on Pro. Then you can schedule `/api/cron/google-sheets-sync` and set `CRON_SECRET`. Set the Vercel project root to `web`.

AI is optional. If `AI_API_KEY` is missing or the model fails, deterministic mapping/normalization/duplicate detection still runs.

```bash
npm test
```

## Source data notes

The Excel file contained 565 unique flood-prone road records after removing 20 duplicates. Regions II, III, V, X, and BARMM were present as headers only, with no location rows. Coordinates and road lengths were not in the file and are not invented on import. Use **Geocode**, **Drop pin**, or **Draw road** to place a record.
