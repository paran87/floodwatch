import { NextRequest, NextResponse } from "next/server";
import { getFloodProneAreas, AppsScriptError } from "@/lib/apps-script";
import { getCachedLocations, upsertLocationCache, enqueueLocationReview } from "@/lib/locationCache";
import { buildGeocodingQueries, classifyGeocodeResult, geocodeWithFallback } from "@/lib/geocoding";
import { logActivity } from "@/lib/api";
import type { ApiResponse } from "@/lib/types";

/**
 * Admin-only batch geocoding trigger. Not part of the public UI yet — see
 * CLAUDE.md §8 "Location resolution & geocoding" for the full design and
 * why this isn't gated by the (not-yet-operational) user-role system.
 *
 * Gated by a shared secret (GEOCODING_ADMIN_KEY), same pattern as Apps
 * Script's API_KEY. Idempotent: skips any record already resolved or
 * queued for review in Supabase, so repeated/resumed runs never redo work
 * or hammer Nominatim for records already handled. Bounded per call
 * (DEFAULT_BATCH_SIZE/MAX_BATCH_SIZE below) so one invocation respects
 * Nominatim's 1 req/sec policy without running indefinitely — call it
 * again to continue with the next batch.
 */

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

interface BatchSummary {
  totalCandidates: number;
  /** Rows already resolved or queued for review before this run — skipped entirely, not reprocessed. */
  alreadyCached: number;
  /** Eligible rows left unprocessed after this run because they exceeded batchSize — call again to continue. */
  remainingAfterThisBatch: number;
  processed: number;
  resolved: number;
  needsReview: number;
  failed: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const providedKey = request.nextUrl.searchParams.get("adminKey") ?? request.headers.get("x-admin-key");
  const expectedKey = process.env.GEOCODING_ADMIN_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Invalid or missing admin key.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const batchSize = Math.min(MAX_BATCH_SIZE, Math.max(1, Number(body.batchSize) || DEFAULT_BATCH_SIZE));
  const provinceFilter = typeof body.province === "string" ? body.province : undefined;

  try {
    const { items } = await getFloodProneAreas({ province: provinceFilter, pageSize: 2000 });

    // Candidates: records Apps Script classified as geocodable (a query exists). Apps Script has no
    // visibility into Supabase, so `geocodingStatus` here is always "pending" regardless of cache state —
    // the actual idempotency check against location_cache happens below.
    const candidates = items.filter((item) => item.location?.geocodingQuery && item.location.geocodingStatus === "pending");
    const cached = await getCachedLocations(candidates.map((c) => c.rowIndex));

    // Idempotency: a row already resolved or queued for review is done — never reprocessed.
    // Only "no cache row yet" or a previous transient failure are eligible for (re)processing.
    const eligible = candidates.filter((item) => {
      const existing = cached.get(item.rowIndex);
      return !existing || existing.geocodingStatus === "not_attempted" || existing.geocodingStatus === "failed";
    });
    const alreadyCached = candidates.length - eligible.length;
    const toProcess = eligible.slice(0, batchSize);
    const remainingAfterThisBatch = eligible.length - toProcess.length;

    const summary: BatchSummary = {
      totalCandidates: candidates.length,
      alreadyCached,
      remainingAfterThisBatch,
      processed: 0,
      resolved: 0,
      needsReview: 0,
      failed: 0,
      errors: [],
    };

    for (const area of toProcess) {
      const queries = buildGeocodingQueries(area);
      summary.processed++;

      if (queries.length === 0) {
        await upsertLocationCache({
          sheetRowIndex: area.rowIndex,
          latitude: null,
          longitude: null,
          accuracy: "unresolved",
          source: "unresolved",
          geocodingQuery: null,
          geocodingStatus: "failed",
        });
        summary.failed++;
        continue;
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
          summary.needsReview++;
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
          summary.resolved++;
        }
        await logActivity(
          "LOCATION_GEOCODED",
          null,
          "location",
          String(area.rowIndex),
          `${classification.needsReview ? "Needs review" : "Resolved"} at ${classification.accuracy} tier via query "${outcome.queryUsed}".`,
        );
      } else if (outcome.status === "no_result") {
        await upsertLocationCache({
          sheetRowIndex: area.rowIndex,
          latitude: null,
          longitude: null,
          accuracy: "unresolved",
          source: "unresolved",
          geocodingQuery: queries[0],
          geocodingStatus: "failed",
        });
        summary.failed++;
        await logActivity("VALIDATION_FAILURE", null, "location", String(area.rowIndex), `No geocoding result for any query tier (tried: ${queries.join(" | ")}).`);
      } else {
        // API/network/rate-limit error: record as failed (retried on a future run) and stop the batch early
        // rather than continuing to hammer a provider that just rejected or failed a request.
        await upsertLocationCache({
          sheetRowIndex: area.rowIndex,
          latitude: null,
          longitude: null,
          accuracy: "unresolved",
          source: "unresolved",
          geocodingQuery: queries[0],
          geocodingStatus: "failed",
        });
        summary.failed++;
        summary.errors.push(`row ${area.rowIndex}: ${outcome.message}`);
        await logActivity("VALIDATION_FAILURE", null, "location", String(area.rowIndex), `Geocoding provider error: ${outcome.message}`);
        if (outcome.isRateLimit) break;
      }
    }

    return NextResponse.json<ApiResponse<BatchSummary>>({ success: true, data: summary });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : err instanceof Error ? err.message : "Batch geocoding failed.";
    const code = err instanceof AppsScriptError ? err.code : "GEOCODE_BATCH_FAILED";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
