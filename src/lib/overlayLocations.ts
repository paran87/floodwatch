import "server-only";
import { getCachedLocations, getReviewQueueEntries, type LocationCacheRow, type LocationReviewEntry } from "./locationCache";
import type { FloodProneArea } from "./types";

/**
 * Overlays Supabase's persisted geocoding results onto Apps Script's live
 * (uncached) classification. Apps Script never knows about Supabase (see
 * CLAUDE.md) — this is the one place the two are merged, always in
 * Next.js, after the Sheet data has already been fetched.
 *
 * - geocoding_status 'resolved'  → real latitude/longitude, exact marker.
 * - geocoding_status 'needs_review' → coordinates stay null; proposed
 *   lat/lng come from location_review_queue instead, rendered as the
 *   existing amber "needs review" marker — never promoted to "resolved."
 * - geocoding_status 'failed' or no cache row → left exactly as Apps
 *   Script classified it (usually "pending", meaning not geocoded yet).
 */
export async function overlayLocationCache(items: FloodProneArea[]): Promise<FloodProneArea[]> {
  const rowIndexes = items.map((item) => item.rowIndex);
  const [cacheMap, reviewMap] = await Promise.all([getCachedLocations(rowIndexes), getReviewQueueEntries(rowIndexes)]);
  return applyLocationOverlay(items, cacheMap, reviewMap);
}

/** The merge itself, separated from the Supabase reads so a bulk-loaded snapshot can reuse it. */
export function applyLocationOverlay(
  items: FloodProneArea[],
  cacheMap: Map<number, LocationCacheRow>,
  reviewMap: Map<number, LocationReviewEntry>,
): FloodProneArea[] {
  return items.map((item) => {
    const cached = cacheMap.get(item.rowIndex);
    if (!cached || !item.location) return item;

    if (cached.geocodingStatus === "resolved") {
      return {
        ...item,
        location: {
          ...item.location,
          latitude: cached.latitude,
          longitude: cached.longitude,
          accuracy: cached.accuracy,
          source: cached.source,
          geocodingQuery: cached.geocodingQuery,
          geocodingStatus: "resolved",
          geocodedAt: cached.geocodedAt,
          verified: cached.verified,
          verifiedBy: cached.verifiedBy,
          verifiedAt: cached.verifiedAt,
          needsReview: false,
          reviewReason: null,
        },
      };
    }

    if (cached.geocodingStatus === "needs_review") {
      const review = reviewMap.get(item.rowIndex);
      return {
        ...item,
        location: {
          ...item.location,
          accuracy: cached.accuracy,
          source: cached.source,
          geocodingQuery: cached.geocodingQuery,
          geocodingStatus: "needs_review",
          needsReview: true,
          reviewReason: review?.reason ?? item.location.reviewReason,
          proposedLatitude: review?.proposedLatitude ?? item.location.proposedLatitude,
          proposedLongitude: review?.proposedLongitude ?? item.location.proposedLongitude,
        },
      };
    }

    if (cached.geocodingStatus === "failed") {
      return {
        ...item,
        location: { ...item.location, accuracy: "unresolved", source: "unresolved", geocodingStatus: "failed" },
      };
    }

    return item;
  });
}
