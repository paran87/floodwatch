import { NextResponse, after } from "next/server";
import { getFloodProneArea, AppsScriptError } from "@/lib/apps-script";
import { patchArea, peekArea } from "@/lib/areasCache";
import { overlayLocationCache } from "@/lib/overlayLocations";
import { applyOutcome, geocodeArea, persistGeocodeOutcome, type GeocodeAreaOutcome } from "@/lib/geocodeArea";
import type { ApiResponse, FloodProneArea } from "@/lib/types";

/**
 * On-demand geocoding for a single selected area, so the map can show a
 * location the moment a row is picked instead of waiting for the admin batch
 * job. Written to be fast:
 *
 *  - Already located / queued for review (known from the cached snapshot):
 *    returned immediately, no geocoder and no database call.
 *  - Otherwise geocode, then respond straight away; the Supabase writes
 *    happen after the response (`after()`), and the response is built from
 *    the outcome locally rather than read back from the database.
 *  - Duplicate clicks on the same row share one lookup, and a lookup nobody
 *    is waiting for any more (the user clicked elsewhere) is cancelled so
 *    the newest click isn't queued behind it at the geocoder's 1 req/s limit.
 *
 * Writes go to Supabase only — never the Sheet (CLAUDE.md §8, §17).
 */

interface Flight {
  promise: Promise<GeocodeAreaOutcome>;
  controller: AbortController;
  waiters: number;
}
const g = globalThis as unknown as { __locateFlights?: Map<number, Flight> };
const flights = (g.__locateFlights ??= new Map<number, Flight>());

function join(area: FloodProneArea, signal: AbortSignal): Promise<GeocodeAreaOutcome> {
  let flight = flights.get(area.rowIndex);
  if (!flight) {
    const controller = new AbortController();
    const promise = geocodeArea(area, { signal: controller.signal })
      .then((outcome) => {
        // Persist once, for the request that started the lookup, after the response has gone out.
        after(() => persistGeocodeOutcome(area, outcome).catch((err: unknown) => console.warn("[locate] could not persist:", err instanceof Error ? err.message : err)));
        return outcome;
      })
      .finally(() => flights.delete(area.rowIndex));
    flight = { promise, controller, waiters: 0 };
    flights.set(area.rowIndex, flight);
  }
  const current = flight;
  current.waiters++;
  const onAbort = () => {
    current.waiters--;
    if (current.waiters <= 0) current.controller.abort();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  return current.promise.finally(() => signal.removeEventListener("abort", onAbort));
}

const ok = (data: FloodProneArea) => NextResponse.json<ApiResponse<FloodProneArea>>({ success: true, data });

export async function POST(request: Request, { params }: { params: Promise<{ rowIndex: string }> }) {
  const { rowIndex } = await params;
  const index = Number(rowIndex);
  if (!Number.isInteger(index) || index < 1) {
    return NextResponse.json<ApiResponse<never>>({ success: false, message: "Invalid row.", code: "VALIDATION_FAILURE" }, { status: 400 });
  }

  try {
    let area = peekArea(index);
    if (!area) {
      // Snapshot not loaded on this instance: read the one row, and merge its stored location in.
      [area] = await overlayLocationCache([await getFloodProneArea(index)]);
    }

    const status = area.location?.geocodingStatus;
    if (status === "resolved" || status === "needs_review" || !area.location?.geocodingQuery) return ok(area);

    const outcome = await join(area, request.signal);
    if (outcome.kind === "aborted") return new NextResponse(null, { status: 204 }); // the client moved on

    if (outcome.error) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, message: "The geocoding service is unavailable right now. Please try again shortly.", code: "GEOCODE_UNAVAILABLE" },
        { status: 502 },
      );
    }

    const located = applyOutcome(area, outcome);
    patchArea(located); // list views see the new location straight away, not after the next refresh
    return ok(located);
  } catch (err) {
    const message = err instanceof AppsScriptError ? err.message : "Could not locate this area.";
    const code = err instanceof AppsScriptError ? err.code : "LOCATE_FAILED";
    return NextResponse.json<ApiResponse<never>>({ success: false, message, code }, { status: 502 });
  }
}
