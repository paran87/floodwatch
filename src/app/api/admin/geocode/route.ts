import { NextRequest, NextResponse } from "next/server";
import { getFloodProneAreas, AppsScriptError } from "@/lib/apps-script";
import { getCachedLocations } from "@/lib/locationCache";
import { geocodeAndPersistArea } from "@/lib/geocodeArea";
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
      summary.processed++;
      const result = await geocodeAndPersistArea(area);

      if (result.status === "resolved") summary.resolved++;
      else if (result.status === "needs_review") summary.needsReview++;
      else {
        summary.failed++;
        if (result.error) {
          summary.errors.push(`row ${area.rowIndex}: ${result.error}`);
          // Stop early on a rate limit rather than continuing to hammer a provider that just rejected a request.
          if (result.isRateLimit) break;
        }
      }
    }

    return NextResponse.json<ApiResponse<BatchSummary>>({ success: true, data: summary });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : err instanceof Error ? err.message : "Batch geocoding failed.";
    const code = err instanceof AppsScriptError ? err.code : "GEOCODE_BATCH_FAILED";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
