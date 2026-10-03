import { NextResponse } from "next/server";
import { getFloodProneArea, AppsScriptError } from "@/lib/apps-script";
import { peekArea } from "@/lib/areasCache";
import { overlayLocationCache } from "@/lib/overlayLocations";
import type { ApiResponse } from "@/lib/types";

// A cold read of the whole sheet can take several seconds; allow it (and its retries) to finish.
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ rowIndex: string }> }) {
  const { rowIndex } = await params;
  try {
    const cached = peekArea(Number(rowIndex));
    let data = cached ?? (await getFloodProneArea(Number(rowIndex)));
    if (!cached) {
      // Not in the snapshot: this came straight from the Sheet, so merge the geocoded location in.
      try {
        [data] = await overlayLocationCache([data]);
      } catch (err) {
        console.warn("[flood-prone-area] location cache overlay unavailable:", err instanceof Error ? err.message : err);
      }
    }
    return NextResponse.json<ApiResponse<typeof data>>({ success: true, data });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Flood-prone area not found.";
    const code = err instanceof AppsScriptError ? err.code : "NOT_FOUND";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 404 });
  }
}
