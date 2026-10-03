import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { getFloodProneAreas } from "./apps-script";
import { getAllCachedLocations, getAllReviewQueueEntries } from "./locationCache";
import { applyLocationOverlay } from "./overlayLocations";
import { computeFacets, filterAreas } from "./areaFilter";
import type { FloodProneArea, FloodProneAreaFilters } from "./types";

/**
 * In-memory snapshot of the whole dataset (~1,763 rows) with Supabase's
 * geocoded locations already merged in.
 *
 * Apps Script has to read and classify every row on every call, which costs
 * seconds, so the Sheet is read once and kept. Reads are served from the
 * snapshot:
 *   - fresh (< FRESH_MS):  served as is.
 *   - stale (< STALE_MS):  served immediately, refreshed in the background
 *                          (`after()` keeps the work alive past the response).
 *   - older / none:        the request waits for a refresh.
 * The Sheet stays the source of truth; this is a read-through cache only.
 * Supabase is read in bulk with the same refresh, instead of two big
 * `IN (…)` queries on every request.
 */

/**
 * Layer 2: Next's persistent Data Cache, shared by every serverless instance
 * and kept across deployments, holding the raw Sheet read. Apps Script is slow
 * and erratic (a trivial call took 1.3–1.8 s normally and 18 s once), and the
 * in-memory layer below is per instance — so without this, every cold
 * instance, and every deploy, made a visitor wait on a full sheet read. When
 * the entry is older than L2_REVALIDATE_S, Next serves the old copy at once
 * and refreshes it in the background.
 *
 * The list is stored gzipped + base64 (about a tenth of its size) so it stays
 * far below the Data Cache's 2 MB item limit. Bump SHEET_CACHE_VERSION if the
 * shape of an Apps Script row ever changes, so old entries aren't misread.
 */
const SHEET_CACHE_VERSION = "v1";
const L2_REVALIDATE_S = Number(process.env.AREAS_L2_REVALIDATE_S) || 300;

const readSheetEncoded = unstable_cache(
  async () => {
    const { items } = await getFloodProneAreas({ pageSize: MAX_PAGE_SIZE });
    return gzipSync(JSON.stringify(items)).toString("base64");
  },
  ["sheet-areas", SHEET_CACHE_VERSION],
  { revalidate: L2_REVALIDATE_S, tags: ["sheet-areas"] },
);

async function readSheet(): Promise<FloodProneArea[]> {
  const encoded = await readSheetEncoded();
  return JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8")) as FloodProneArea[];
}

const FRESH_MS = 2 * 60 * 1000;
const STALE_MS = 30 * 60 * 1000;
/** If Supabase was unreachable during a refresh, retry sooner than a normal TTL. */
const OVERLAY_RETRY_MS = 20 * 1000;
const MAX_PAGE_SIZE = 2000;
const DEFAULT_PAGE_SIZE = 25;

interface Snapshot {
  items: FloodProneArea[];
  fetchedAt: number;
  overlayOk: boolean;
}

// Stashed on globalThis so `next dev` hot reloads don't throw the snapshot away.
const store = globalThis as unknown as { __floodAreasSnapshot?: Snapshot; __floodAreasInflight?: Promise<Snapshot> };

async function build(): Promise<Snapshot> {
  const [sheetItems, overlay] = await Promise.all([
    readSheet(),
    Promise.all([getAllCachedLocations(), getAllReviewQueueEntries()]).catch((err: unknown) => {
      // Supabase being unreachable must never take down the Sheet-derived listing.
      console.warn("[areas] location overlay unavailable:", err instanceof Error ? err.message : err);
      return null;
    }),
  ]);
  const items = overlay ? applyLocationOverlay(sheetItems, overlay[0], overlay[1]) : sheetItems;
  return { items, fetchedAt: Date.now(), overlayOk: overlay !== null };
}

function refresh(): Promise<Snapshot> {
  if (!store.__floodAreasInflight) {
    store.__floodAreasInflight = build()
      .then((snapshot) => {
        store.__floodAreasSnapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        store.__floodAreasInflight = undefined;
      });
  }
  return store.__floodAreasInflight;
}

function refreshInBackground() {
  const run = () => refresh().catch((err: unknown) => console.warn("[areas] background refresh failed:", err instanceof Error ? err.message : err));
  try {
    after(run);
  } catch {
    void run(); // not inside a request scope (e.g. a script): just fire it
  }
}

async function getSnapshot(): Promise<Snapshot> {
  const current = store.__floodAreasSnapshot;
  if (current) {
    const age = Date.now() - current.fetchedAt;
    const freshFor = current.overlayOk ? FRESH_MS : OVERLAY_RETRY_MS;
    if (age < freshFor) return current;
    if (age < STALE_MS) {
      refreshInBackground();
      return current;
    }
  }
  try {
    return await refresh();
  } catch (err) {
    // Serve old data rather than failing if Apps Script is briefly unavailable.
    if (current) return current;
    throw err;
  }
}

export async function getAllAreas(): Promise<FloodProneArea[]> {
  return (await getSnapshot()).items;
}

/** Returns the area from the snapshot if one is already loaded; never triggers the slow full-sheet read. */
export function peekArea(rowIndex: number): FloodProneArea | undefined {
  return store.__floodAreasSnapshot?.items.find((item) => item.rowIndex === rowIndex);
}

/** Reflects a just-persisted location change in the snapshot immediately, without waiting for the next refresh. */
export function patchArea(updated: FloodProneArea) {
  const snapshot = store.__floodAreasSnapshot;
  if (!snapshot) return;
  const i = snapshot.items.findIndex((item) => item.rowIndex === updated.rowIndex);
  if (i >= 0) snapshot.items = snapshot.items.map((item, idx) => (idx === i ? updated : item));
}

/** Marks the snapshot stale so the next read refreshes it (e.g. after a batch geocoding run). */
export function invalidateAreas() {
  if (store.__floodAreasSnapshot) store.__floodAreasSnapshot = { ...store.__floodAreasSnapshot, fetchedAt: 0 };
}

export async function queryAreas(filters: FloodProneAreaFilters): Promise<{ items: FloodProneArea[]; total: number }> {
  const filtered = filterAreas(await getAllAreas(), filters);
  const page = Math.max(1, Number(filters.page) || 1);
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const start = (page - 1) * size;
  return { items: filtered.slice(start, start + size), total: filtered.length };
}

export async function getFacets() {
  return computeFacets(await getAllAreas());
}
