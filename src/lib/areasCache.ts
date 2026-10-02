import "server-only";
import { getFloodProneAreas } from "./apps-script";
import type { FloodProneArea, FloodProneAreaFilters } from "./types";

/**
 * In-memory snapshot of the whole sheet-derived dataset (~1,763 rows).
 *
 * Apps Script has to read and classify every row on every call no matter how
 * small the requested page is, which costs several seconds per request. The
 * data changes rarely, so we fetch it once, keep it for a few minutes, and
 * do filtering/pagination here instead. The Sheet stays the source of truth;
 * this is a read-through cache only.
 */

const TTL_MS = 5 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 2000;

interface Snapshot {
  items: FloodProneArea[];
  fetchedAt: number;
}

// Stashed on globalThis so `next dev` hot reloads don't throw the snapshot away.
const store = globalThis as unknown as { __floodAreasSnapshot?: Snapshot; __floodAreasInflight?: Promise<Snapshot> };

async function refresh(): Promise<Snapshot> {
  if (!store.__floodAreasInflight) {
    store.__floodAreasInflight = getFloodProneAreas({ pageSize: MAX_PAGE_SIZE })
      .then((result) => {
        const snapshot = { items: result.items, fetchedAt: Date.now() };
        store.__floodAreasSnapshot = snapshot;
        return snapshot;
      })
      .finally(() => {
        store.__floodAreasInflight = undefined;
      });
  }
  return store.__floodAreasInflight;
}

async function getSnapshot(): Promise<Snapshot> {
  const current = store.__floodAreasSnapshot;
  if (current && Date.now() - current.fetchedAt < TTL_MS) return current;
  try {
    return await refresh();
  } catch (err) {
    // Serve slightly stale data rather than failing if Apps Script is briefly unavailable.
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

function includesIgnoreCase(haystack: string | undefined, needle: string): boolean {
  return (haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

/** Mirrors apps-script/FloodProneAreas.js action_getFloodProneAreas_ so results are unchanged. */
export async function queryAreas(filters: FloodProneAreaFilters): Promise<{ items: FloodProneArea[]; total: number }> {
  const all = await getAllAreas();
  const search = filters.search?.trim();

  const filtered = all.filter((row) => {
    if (filters.region && row.region !== filters.region) return false;
    if (filters.province && row.province !== filters.province) return false;
    if (filters.municipalityCity && row.municipalityCity !== filters.municipalityCity) return false;
    if (filters.barangay && row.barangay !== filters.barangay) return false;
    if (filters.deo && row.deo !== filters.deo) return false;
    if (filters.accuracy && row.location?.accuracy !== filters.accuracy) return false;
    if (
      search &&
      !(
        includesIgnoreCase(row.province, search) ||
        includesIgnoreCase(row.municipalityCity, search) ||
        includesIgnoreCase(row.barangay, search) ||
        includesIgnoreCase(row.roadNameWaterways, search) ||
        includesIgnoreCase(row.deo, search)
      )
    ) {
      return false;
    }
    return true;
  });

  const page = Math.max(1, Number(filters.page) || 1);
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const start = (page - 1) * size;
  return { items: filtered.slice(start, start + size), total: filtered.length };
}

export async function getFacets() {
  const all = await getAllAreas();
  const uniqueSorted = (pick: (row: FloodProneArea) => string) =>
    Array.from(new Set(all.map(pick).filter(Boolean))).sort();
  return {
    regions: uniqueSorted((r) => r.region),
    provinces: uniqueSorted((r) => r.province),
    municipalities: uniqueSorted((r) => r.municipalityCity),
    barangays: uniqueSorted((r) => r.barangay),
    deos: uniqueSorted((r) => r.deo),
  };
}
