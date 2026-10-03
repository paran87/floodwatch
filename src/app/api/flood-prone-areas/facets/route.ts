import { NextResponse } from "next/server";
import { AppsScriptError } from "@/lib/apps-script";
import { getFacets } from "@/lib/areasCache";
import type { ApiResponse } from "@/lib/types";

// A cold read of the whole sheet can take several seconds; allow it (and its retries) to finish.
export const maxDuration = 60;

export async function GET() {
  try {
    const data = await getFacets();
    return NextResponse.json<ApiResponse<typeof data>>({ success: true, data });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Failed to load filter options.";
    const code = err instanceof AppsScriptError ? err.code : "UNKNOWN_ERROR";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
