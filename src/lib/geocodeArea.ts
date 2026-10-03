import "server-only";
import { classifyGeocodeResult, geocodeWithFallback } from "./geocoding";
import { buildGeocodingTiers } from "./geocodeQuery";
import { upsertLocationCache, enqueueLocationReview, type LocationCacheRow, type LocationReviewEntry } from "./locationCache";
import { applyLocationOverlay } from "./overlayLocations";
import { logActivity } from "./api";
import type { FloodProneArea, LocationAccuracy } from "./types";

/**
 * Geocoding one area is split in two so the interactive "locate" click never
 * waits on the database:
 *
 *   geocodeArea()          — talks to the geocoder only; returns what should be stored.
 *   persistGeocodeOutcome()— writes that to Supabase (cache + review queue + audit log, in parallel).
 *   applyOutcome()         — merges the outcome into the area locally, so the response can be built without reading Supabase back.
 *
 * `geocodeAndPersistArea()` is the all-in-one used by the admin batch job.
 * Confidence rules are identical everywhere — see CLAUDE.md §8.
 */

export interface GeocodeAreaOutcome {
  kind: "resolved" | "needs_review" | "failed" | "aborted";
  cacheEntry?: Parameters<typeof upsertLocationCache>[0];
  review?: Parameters<typeof enqueueLocationReview>[0];
  activity?: { type: "LOCATION_GEOCODED" | "VALIDATION_FAILURE"; message: string };
  /** Set when the provider itself failed (not just "no result"); the batch job stops early on a rate limit. */
  error?: string;
  isRateLimit?: boolean;
}

export async function geocodeArea(area: FloodProneArea, options: { signal?: AbortSignal } = {}): Promise<GeocodeAreaOutcome> {
  const tiers = buildGeocodingTiers(area);

  const failed = (query: string | null): Parameters<typeof upsertLocationCache>[0] => ({
    sheetRowIndex: area.rowIndex,
    latitude: null,
    longitude: null,
    accuracy: "unresolved",
    source: "unresolved",
    geocodingQuery: query,
    geocodingStatus: "failed",
  });

  if (tiers.length === 0) return { kind: "failed", cacheEntry: failed(null) };

  const outcome = await geocodeWithFallback(tiers, { signal: options.signal });

  if (outcome.status === "aborted") return { kind: "aborted" };

  if (outcome.status === "resolved") {
    const classification = classifyGeocodeResult(outcome.accuracy, outcome.candidate.displayName, area.province, area.municipalityCity);
    const activity = {
      type: "LOCATION_GEOCODED" as const,
      message: `${classification.needsReview ? "Needs review" : "Resolved"} at ${classification.accuracy} tier via query "${outcome.queryUsed}".`,
    };

    if (classification.needsReview) {
      return {
        kind: "needs_review",
        cacheEntry: {
          sheetRowIndex: area.rowIndex,
          latitude: null,
          longitude: null,
          accuracy: classification.accuracy,
          source: "approximate",
          geocodingQuery: outcome.queryUsed,
          geocodingStatus: "needs_review",
        },
        review: {
          sheetRowIndex: area.rowIndex,
          proposedLatitude: outcome.candidate.latitude,
          proposedLongitude: outcome.candidate.longitude,
          proposedAccuracy: classification.accuracy,
          reason: classification.reason ?? "Low-confidence geocoding result.",
        },
        activity,
      };
    }
    return {
      kind: "resolved",
      cacheEntry: {
        sheetRowIndex: area.rowIndex,
        latitude: outcome.candidate.latitude,
        longitude: outcome.candidate.longitude,
        accuracy: classification.accuracy,
        source: "geocoded",
        geocodingQuery: outcome.queryUsed,
        geocodingStatus: "resolved",
        geocodedAt: new Date().toISOString(),
      },
      activity,
    };
  }

  if (outcome.status === "no_result") {
    return {
      kind: "failed",
      cacheEntry: failed(tiers[0].query),
      activity: { type: "VALIDATION_FAILURE", message: `No geocoding result for any query tier (tried: ${tiers.map((t) => t.query).join(" | ")}).` },
    };
  }

  // Provider/network/rate-limit error: stored as failed so a future run retries it.
  return {
    kind: "failed",
    cacheEntry: failed(tiers[0].query),
    activity: { type: "VALIDATION_FAILURE", message: `Geocoding provider error: ${outcome.message}` },
    error: outcome.message,
    isRateLimit: outcome.isRateLimit,
  };
}

/** Writes an outcome to Supabase. The three writes are independent, so they run in parallel. */
export async function persistGeocodeOutcome(area: FloodProneArea, outcome: GeocodeAreaOutcome): Promise<void> {
  if (outcome.kind === "aborted" || !outcome.cacheEntry) return;
  await Promise.all([
    upsertLocationCache(outcome.cacheEntry),
    outcome.review ? enqueueLocationReview(outcome.review) : Promise.resolve(),
    outcome.activity ? logActivity(outcome.activity.type, null, "location", String(area.rowIndex), outcome.activity.message) : Promise.resolve(),
  ]);
}

/** The area as it will look once the outcome is stored — computed locally, no database read-back. */
export function applyOutcome(area: FloodProneArea, outcome: GeocodeAreaOutcome): FloodProneArea {
  const entry = outcome.cacheEntry;
  if (!entry) return area;
  const row: LocationCacheRow = {
    sheetRowIndex: entry.sheetRowIndex,
    latitude: entry.latitude,
    longitude: entry.longitude,
    accuracy: entry.accuracy as LocationAccuracy,
    source: entry.source,
    geocodingQuery: entry.geocodingQuery,
    geocodingStatus: entry.geocodingStatus,
    geocodedAt: entry.geocodedAt ?? null,
    verified: false,
    verifiedBy: null,
    verifiedAt: null,
  };
  const reviews = new Map<number, LocationReviewEntry>();
  if (outcome.review) {
    reviews.set(area.rowIndex, { proposedLatitude: outcome.review.proposedLatitude, proposedLongitude: outcome.review.proposedLongitude, reason: outcome.review.reason });
  }
  return applyLocationOverlay([area], new Map([[area.rowIndex, row]]), reviews)[0];
}

export type GeocodeAreaResult =
  | { status: "resolved" | "needs_review" | "failed"; error?: undefined; isRateLimit?: undefined }
  | { status: "failed"; error: string; isRateLimit: boolean };

/** Geocode + persist in one call (admin batch job). */
export async function geocodeAndPersistArea(area: FloodProneArea): Promise<GeocodeAreaResult> {
  const outcome = await geocodeArea(area);
  await persistGeocodeOutcome(area, outcome);
  if (outcome.error) return { status: "failed", error: outcome.error, isRateLimit: Boolean(outcome.isRateLimit) };
  return { status: outcome.kind === "resolved" || outcome.kind === "needs_review" ? outcome.kind : "failed" };
}
