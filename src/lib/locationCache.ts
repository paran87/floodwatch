import "server-only";
import { getSupabaseClient } from "./supabase";
import type { GeocodingStatus, LocationAccuracy, LocationSource } from "./types";

/**
 * Server-only read/write access to Supabase's `location_cache` and
 * `location_review_queue` tables — the only place geocoded coordinates for
 * flood-prone-area records are persisted. Never the Google Sheet: see
 * CLAUDE.md §8 and §17.
 */

export interface LocationCacheRow {
  sheetRowIndex: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: LocationAccuracy;
  source: LocationSource;
  geocodingQuery: string | null;
  geocodingStatus: GeocodingStatus;
  geocodedAt: string | null;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

interface LocationCacheDbRow {
  sheet_row_index: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: LocationAccuracy;
  source: LocationSource;
  geocoding_query: string | null;
  geocoding_status: GeocodingStatus;
  geocoded_at: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
}

function fromDbRow(row: LocationCacheDbRow): LocationCacheRow {
  return {
    sheetRowIndex: row.sheet_row_index,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    source: row.source,
    geocodingQuery: row.geocoding_query,
    geocodingStatus: row.geocoding_status,
    geocodedAt: row.geocoded_at,
    verified: row.verified,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
  };
}

/** Batch lookup, keyed by sheet row index — used to overlay cached coordinates onto a page of Apps Script results. */
export async function getCachedLocations(sheetRowIndexes: number[]): Promise<Map<number, LocationCacheRow>> {
  const map = new Map<number, LocationCacheRow>();
  if (sheetRowIndexes.length === 0) return map;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("location_cache").select("*").in("sheet_row_index", sheetRowIndexes);
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as LocationCacheDbRow[]) {
    map.set(row.sheet_row_index, fromDbRow(row));
  }
  return map;
}

const PAGE = 1000;

/**
 * Every row of location_cache. The table only holds rows that have been
 * geocoded, so this is far cheaper than a giant `IN (…1,763 ids…)` query —
 * and PostgREST caps one response at 1,000 rows, so it is read in pages.
 */
export async function getAllCachedLocations(): Promise<Map<number, LocationCacheRow>> {
  const supabase = getSupabaseClient();
  const map = new Map<number, LocationCacheRow>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("location_cache").select("*").order("sheet_row_index").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as LocationCacheDbRow[]) map.set(row.sheet_row_index, fromDbRow(row));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return map;
}

export async function getCachedLocation(sheetRowIndex: number): Promise<LocationCacheRow | null> {
  const map = await getCachedLocations([sheetRowIndex]);
  return map.get(sheetRowIndex) ?? null;
}

export async function upsertLocationCache(entry: {
  sheetRowIndex: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: LocationAccuracy;
  source: LocationSource;
  geocodingQuery: string | null;
  geocodingStatus: GeocodingStatus;
  geocodedAt?: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("location_cache").upsert({
    sheet_row_index: entry.sheetRowIndex,
    latitude: entry.latitude,
    longitude: entry.longitude,
    accuracy: entry.accuracy,
    source: entry.source,
    geocoding_query: entry.geocodingQuery,
    geocoding_status: entry.geocodingStatus,
    geocoded_at: entry.geocodedAt ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export interface LocationReviewEntry {
  proposedLatitude: number | null;
  proposedLongitude: number | null;
  reason: string;
}

/** Latest pending review entry per row — surfaced as `location.proposedLatitude/Longitude` for the frontend's existing "needs review" marker. */
export async function getReviewQueueEntries(sheetRowIndexes: number[]): Promise<Map<number, LocationReviewEntry>> {
  const map = new Map<number, LocationReviewEntry>();
  if (sheetRowIndexes.length === 0) return map;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("location_review_queue")
    .select("sheet_row_index, proposed_latitude, proposed_longitude, reason")
    .in("sheet_row_index", sheetRowIndexes)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as Array<{ sheet_row_index: number; proposed_latitude: number | null; proposed_longitude: number | null; reason: string }>) {
    if (!map.has(row.sheet_row_index)) {
      map.set(row.sheet_row_index, { proposedLatitude: row.proposed_latitude, proposedLongitude: row.proposed_longitude, reason: row.reason });
    }
  }
  return map;
}

/** Latest pending review entry per row, for every row (paged, newest first). */
export async function getAllReviewQueueEntries(): Promise<Map<number, LocationReviewEntry>> {
  const supabase = getSupabaseClient();
  const map = new Map<number, LocationReviewEntry>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("location_review_queue")
      .select("sheet_row_index, proposed_latitude, proposed_longitude, reason")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ sheet_row_index: number; proposed_latitude: number | null; proposed_longitude: number | null; reason: string }>;
    for (const row of rows) {
      if (!map.has(row.sheet_row_index)) {
        map.set(row.sheet_row_index, { proposedLatitude: row.proposed_latitude, proposedLongitude: row.proposed_longitude, reason: row.reason });
      }
    }
    if (rows.length < PAGE) break;
  }
  return map;
}

export async function enqueueLocationReview(entry: {
  sheetRowIndex: number;
  proposedLatitude: number | null;
  proposedLongitude: number | null;
  proposedAccuracy: LocationAccuracy;
  reason: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("location_review_queue").insert({
    sheet_row_index: entry.sheetRowIndex,
    proposed_latitude: entry.proposedLatitude,
    proposed_longitude: entry.proposedLongitude,
    proposed_accuracy: entry.proposedAccuracy,
    reason: entry.reason,
  });
  if (error) throw new Error(error.message);
}
