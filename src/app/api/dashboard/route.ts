import { NextResponse } from "next/server";
import { getDashboardStats, AppsScriptError } from "@/lib/apps-script";
import { getPendingLocationReviewCount } from "@/lib/api";
import type { ApiResponse, DashboardStats } from "@/lib/types";

/**
 * Merges Sheet-derived stats (Apps Script) with Supabase-derived stats
 * (pending location reviews) into one dashboard payload.
 */
export async function GET() {
  try {
    const [sheetStats, pendingLocationReviews] = await Promise.all([
      getDashboardStats(),
      getPendingLocationReviewCount(),
    ]);
    const data: DashboardStats = { ...sheetStats, pendingLocationReviews };
    return NextResponse.json<ApiResponse<DashboardStats>>({ success: true, data });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Failed to load dashboard statistics.";
    const code = err instanceof AppsScriptError ? err.code : "UNKNOWN_ERROR";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
