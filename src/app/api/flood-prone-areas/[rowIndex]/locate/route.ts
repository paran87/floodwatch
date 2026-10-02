import { NextResponse } from "next/server";
import { getFloodProneArea, AppsScriptError } from "@/lib/apps-script";
import { peekArea } from "@/lib/areasCache";
import { overlayLocationCache } from "@/lib/overlayLocations";
import { getCachedLocation } from "@/lib/locationCache";
import { geocodeAndPersistArea } from "@/lib/geocodeArea";
import type { ApiResponse } from "@/lib/types";

/**
 * On-demand geocoding for a single selected area, so the map can show a
 * location the moment a row is picked instead of waiting for the admin
 * batch job. Idempotent: a row already resolved or queued for review is
 * returned from Supabase without calling Nominatim again, and the result of
 * a fresh lookup is persisted so it is never geocoded twice. Writes go to
 * Supabase only — never the Sheet (CLAUDE.md §8, §17).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ rowIndex: string }> }) {
  const { rowIndex } = await params;
  const index = Number(rowIndex);
  if (!Number.isInteger(index) || index < 1) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Invalid row.", code: "VALIDATION_FAILURE" }, { status: 400 });
  }

  try {
    const area = peekArea(index) ?? (await getFloodProneArea(index));

    const existing = await getCachedLocation(index).catch(() => null);
    const alreadyDone = existing && (existing.geocodingStatus === "resolved" || existing.geocodingStatus === "needs_review");

    if (!alreadyDone && area.location?.geocodingQuery) {
      const result = await geocodeAndPersistArea(area);
      if (result.status === "failed" && result.error) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, message: "The geocoding service is unavailable right now. Please try again shortly.", code: "GEOCODE_UNAVAILABLE" },
          { status: 502 },
        );
      }
    }

    const [data] = await overlayLocationCache([area]);
    return NextResponse.json<ApiResponse<typeof data>>({ success: true, data });
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Could not locate this area.";
    const code = err instanceof AppsScriptError ? err.code : "LOCATE_FAILED";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
