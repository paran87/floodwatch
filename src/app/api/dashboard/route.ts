import { NextResponse } from "next/server";
import { AppsScriptError } from "@/lib/apps-script";
import { getDashboardStats } from "@/lib/dashboardStats";
import type { ApiResponse, DashboardStats } from "@/lib/types";

/**
 * Sheet-derived stats come from the cached dataset snapshot; Supabase-derived
 * counts (pending location reviews, unresolved reports) are merged in and
 * report `null` — not 0 — if Supabase is unavailable. See
 * src/lib/dashboardStats.ts.
 */
export async function GET() {
  try {
    const data = await getDashboardStats();
    return NextResponse.json<ApiResponse<DashboardStats>>(
      { success: true, data },
      { headers: { "Cache-Control": "private, max-age=20" } },
    );
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Failed to load dashboard statistics.";
    const code = err instanceof AppsScriptError ? err.code : "UNKNOWN_ERROR";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
