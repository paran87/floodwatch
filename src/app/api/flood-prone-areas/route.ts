import { NextRequest, NextResponse } from "next/server";
import { AppsScriptError } from "@/lib/apps-script";
import { queryAreas } from "@/lib/areasCache";
import type { ApiResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    // The snapshot already has Supabase's geocoded locations merged in (see areasCache.ts).
    const result = await queryAreas({
      search: params.get("search") ?? undefined,
      region: params.get("region") ?? undefined,
      province: params.get("province") ?? undefined,
      municipalityCity: params.get("municipalityCity") ?? undefined,
      barangay: params.get("barangay") ?? undefined,
      deo: params.get("deo") ?? undefined,
      accuracy: (params.get("accuracy") as never) ?? undefined,
      page: params.get("page") ? Number(params.get("page")) : undefined,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
    });
    return NextResponse.json<ApiResponse<typeof result>>(
      { success: true, data: result },
      // Back/forward and quick revisits reuse this instead of re-downloading ~1 MB.
      { headers: { "Cache-Control": "private, max-age=20" } },
    );
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Failed to load flood-prone areas.";
    const code = err instanceof AppsScriptError ? err.code : "UNKNOWN_ERROR";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
