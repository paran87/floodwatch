import { NextResponse } from "next/server";
import { getDashboardStats, AppsScriptError } from "@/lib/apps-script";
import { getPendingLocationReviewCount } from "@/lib/api";
import type { ApiResponse, DashboardStats } from "@/lib/types";

/**
 * Merges Sheet-derived stats (Apps Script, authoritative) with Supabase-
 * derived stats (pending location reviews) into one dashboard payload.
 *
 * The Supabase call is optional at the response level: Supabase is a
 * secondary datastore that may not exist yet (e.g. before it's been
 * provisioned), and that must never take down the Sheet-derived stats,
 * which are the ones that actually matter here. A failure there reports
 * `pendingLocationReviews: null` (not 0 — 0 would wrongly claim "checked,
 * none pending") and is logged server-side, not swallowed silently.
 */
export async function GET() {
  try {
    const sheetStats = await getDashboardStats();

    let pendingLocationReviews: number | null = null;
    try {
      pendingLocationReviews = await getPendingLocationReviewCount();
    } catch (err) {
      console.warn("[dashboard] Supabase pendingLocationReviews unavailable:", err instanceof Error ? err.message : err);
    }

    const data: DashboardStats = { ...sheetStats, pendingLocationReviews };
    return NextResponse.json<ApiResponse<DashboardStats>>({ success: true, data });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Failed to load dashboard statistics.";
    const code = err instanceof AppsScriptError ? err.code : "UNKNOWN_ERROR";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
