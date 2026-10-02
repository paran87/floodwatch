import { NextResponse } from "next/server";
import { getFloodProneArea, AppsScriptError } from "@/lib/apps-script";
import { overlayLocationCache } from "@/lib/overlayLocations";
import type { ApiResponse } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ rowIndex: string }> }) {
  const { rowIndex } = await params;
  try {
    const raw = await getFloodProneArea(Number(rowIndex));
    let data = raw;
    try {
      [data] = await overlayLocationCache([raw]);
    } catch (err) {
      console.warn("[flood-prone-area] location cache overlay unavailable:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json<ApiResponse<typeof data>>({ success: true, data });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Flood-prone area not found.";
    const code = err instanceof AppsScriptError ? err.code : "NOT_FOUND";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 404 });
  }
}
