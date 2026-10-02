import "server-only";
import { buildGeocodingQueries, classifyGeocodeResult, geocodeWithFallback } from "./geocoding";
import { upsertLocationCache, enqueueLocationReview } from "./locationCache";
import { logActivity } from "./api";
import type { FloodProneArea } from "./types";

export type GeocodeAreaResult =
  | { status: "resolved" | "needs_review" | "failed"; error?: undefined; isRateLimit?: undefined }
  | { status: "failed"; error: string; isRateLimit: boolean };

/**
 * Geocodes one area through the fallback tiers and persists the outcome to
 * Supabase (never the Sheet). Shared by the admin batch job and the
 * on-demand "locate this area" route so both apply identical confidence
 * rules — see CLAUDE.md §8.
 */
export async function geocodeAndPersistArea(area: FloodProneArea): Promise<GeocodeAreaResult> {
  const queries = buildGeocodingQueries(area);

  const persistFailure = (query: string | null) =>
    upsertLocationCache({
      sheetRowIndex: area.rowIndex,
      latitude: null,
      longitude: null,
      accuracy: "unresolved",
      source: "unresolved",
      geocodingQuery: query,
      geocodingStatus: "failed",
    });

  if (queries.length === 0) {
    await persistFailure(null);
    return { status: "failed" };
  }

  const outcome = await geocodeWithFallback(queries);

  if (outcome.status === "resolved") {
    const classification = classifyGeocodeResult(outcome.queryTierIndex, outcome.candidate.displayName, area.province);

    if (classification.needsReview) {
      await upsertLocationCache({
        sheetRowIndex: area.rowIndex,
        latitude: null,
        longitude: null,
        accuracy: classification.accuracy,
        source: "approximate",
        geocodingQuery: outcome.queryUsed,
        geocodingStatus: "needs_review",
      });
      await enqueueLocationReview({
        sheetRowIndex: area.rowIndex,
        proposedLatitude: outcome.candidate.latitude,
        proposedLongitude: outcome.candidate.longitude,
        proposedAccuracy: classification.accuracy,
        reason: classification.reason ?? "Low-confidence geocoding result.",
      });
    } else {
      await upsertLocationCache({
        sheetRowIndex: area.rowIndex,
        latitude: outcome.candidate.latitude,
        longitude: outcome.candidate.longitude,
        accuracy: classification.accuracy,
        source: "geocoded",
        geocodingQuery: outcome.queryUsed,
        geocodingStatus: "resolved",
        geocodedAt: new Date().toISOString(),
      });
    }
    await logActivity(
      "LOCATION_GEOCODED",
      null,
      "location",
      String(area.rowIndex),
      `${classification.needsReview ? "Needs review" : "Resolved"} at ${classification.accuracy} tier via query "${outcome.queryUsed}".`,
    );
    return { status: classification.needsReview ? "needs_review" : "resolved" };
  }

  if (outcome.status === "no_result") {
    await persistFailure(queries[0]);
    await logActivity("VALIDATION_FAILURE", null, "location", String(area.rowIndex), `No geocoding result for any query tier (tried: ${queries.join(" | ")}).`);
    return { status: "failed" };
  }

  // API/network/rate-limit error: recorded as failed so a future run retries it.
  await persistFailure(queries[0]);
  await logActivity("VALIDATION_FAILURE", null, "location", String(area.rowIndex), `Geocoding provider error: ${outcome.message}`);
  return { status: "failed", error: outcome.message, isRateLimit: outcome.isRateLimit };
}
