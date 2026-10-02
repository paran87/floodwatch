import "server-only";
import type { FloodProneArea, LocationAccuracy } from "./types";

/**
 * Nominatim (OpenStreetMap) geocoding client — server-only, called from the
 * admin batch route (src/app/api/admin/geocode/route.ts), never from a
 * per-request path. Chosen over Google's Geocoding API because it needs no
 * API key or billing-enabled GCP project (see CLAUDE.md §8/§11 on why that
 * blocked other things in this project); the tradeoff is Nominatim's usage
 * policy, which this client respects: max 1 request/second and a
 * descriptive User-Agent (https://operations.osmfoundation.org/policies/nominatim/).
 */

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "FloodWatch/1.0 (https://github.com/paran87/floodwatch; flood-prone-area geocoding)";
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

export interface GeocodeCandidate {
  latitude: number;
  longitude: number;
  displayName: string;
}

export type GeocodeOutcome =
  | { status: "resolved"; candidate: GeocodeCandidate; queryUsed: string; queryTierIndex: number }
  | { status: "no_result" }
  | { status: "error"; message: string; isRateLimit: boolean };

/**
 * Builds progressively broader query candidates from an area's raw fields,
 * mirroring apps-script/LocationResolver.js's hierarchy (road > barangay >
 * municipality > province > region), but constructed here in Next.js
 * because fallback tiers aren't part of what the Apps Script API returns
 * (it returns only the single strongest-tier query). Index in the returned
 * array corresponds 1:1 to a LocationAccuracy tier — see TIER_ACCURACY.
 */
export const TIER_ACCURACY: LocationAccuracy[] = ["road", "barangay", "municipality", "province", "region"];

export function buildGeocodingQueries(area: FloodProneArea): string[] {
  const road = area.roadNameWaterways?.trim();
  const barangay = area.barangay?.trim();
  const municipality = area.municipalityCity?.trim();
  const province = area.province?.trim();
  const region = area.region?.trim();

  const tiers: Array<(string | undefined)[]> = [
    [road, barangay, municipality, province],
    [barangay, municipality, province],
    [municipality, province],
    [province],
    [region],
  ];

  const queries: string[] = [];
  tiers.forEach((parts) => {
    const filtered = parts.filter((p): p is string => Boolean(p && p.length > 0));
    if (filtered.length === 0) return;
    const query = [...filtered, "Philippines"].join(", ");
    if (!queries.includes(query)) queries.push(query);
  });
  return queries;
}

/** Tries each query tier in order, stopping at the first that returns a result. Respects the 1 req/sec rate limit across all tiers tried. */
export async function geocodeWithFallback(queries: string[]): Promise<GeocodeOutcome> {
  for (let i = 0; i < queries.length; i++) {
    await throttle();
    try {
      const url = new URL(NOMINATIM_SEARCH_URL);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "ph");
      url.searchParams.set("q", queries[i]);

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      });

      if (response.status === 429) {
        return { status: "error", message: "Nominatim rate limit hit (HTTP 429).", isRateLimit: true };
      }
      if (!response.ok) {
        return { status: "error", message: `Nominatim returned HTTP ${response.status}.`, isRateLimit: false };
      }

      const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (results.length > 0) {
        const match = results[0];
        return {
          status: "resolved",
          candidate: { latitude: Number(match.lat), longitude: Number(match.lon), displayName: match.display_name },
          queryUsed: queries[i],
          queryTierIndex: i,
        };
      }
      // No result at this tier — fall through and try the next, broader query.
    } catch (err) {
      return { status: "error", message: err instanceof Error ? err.message : "Unknown network error calling Nominatim.", isRateLimit: false };
    }
  }
  return { status: "no_result" };
}

export interface GeocodeClassification {
  accuracy: LocationAccuracy;
  needsReview: boolean;
  reason: string | null;
}

/**
 * Decides whether a Nominatim match is trustworthy enough to show as an
 * exact pin, or should go to manual review instead. Never returns a result
 * that silently claims more confidence than the data supports.
 */
export function classifyGeocodeResult(queryTierIndex: number, displayName: string, province: string): GeocodeClassification {
  const accuracy = TIER_ACCURACY[queryTierIndex] ?? "region";
  const provinceMatches = province.length > 0 && displayName.toLowerCase().includes(province.toLowerCase());

  if (!provinceMatches) {
    return {
      accuracy,
      needsReview: true,
      reason: `Geocoder result ("${displayName}") doesn't clearly mention the expected province ("${province}") — needs manual confirmation.`,
    };
  }
  if (accuracy === "municipality" || accuracy === "province" || accuracy === "region") {
    return {
      accuracy,
      needsReview: true,
      reason: `Only ${accuracy}-level location information was specific enough to geocode; the resulting point is approximate, not exact.`,
    };
  }
  return { accuracy, needsReview: false, reason: null };
}
