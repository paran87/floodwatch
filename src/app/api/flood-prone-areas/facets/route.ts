import { NextResponse } from "next/server";
import { AppsScriptError } from "@/lib/apps-script";
import { getFacets } from "@/lib/areasCache";
import type { ApiResponse } from "@/lib/types";

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
