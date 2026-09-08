import { NextRequest, NextResponse } from "next/server";
import { geocodeAttempts } from "@/lib/geo";

type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  importance?: number;
};

const cache = new Map<
  string,
  { latitude: number; longitude: number; label: string; importance: number }
>();

async function searchNominatim(query: string) {
  const cached = cache.get(query);
  if (cached) return [cached];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ph");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FloodwatchDashboard/1.0 (flood-prone-area-management)",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Geocoding service is unavailable right now.");
  }

  const results = (await response.json()) as NominatimHit[];
  const mapped = results
    .map((item) => ({
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      label: item.display_name,
      importance: item.importance ?? 0,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude) &&
        item.latitude >= 4 &&
        item.latitude <= 22 &&
        item.longitude >= 116 &&
        item.longitude <= 127,
    );
  if (mapped[0]) cache.set(query, mapped[0]);
  return mapped;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const attempts = geocodeAttempts({
    road_name: params.get("road"),
    barangay: params.get("barangay"),
    city_municipality: params.get("city"),
    address: params.get("address"),
    region: params.get("region"),
  });
  const freeform = params.get("q")?.trim();
  if (freeform) attempts.unshift(freeform);

  const unique = [...new Set(attempts.filter(Boolean))];
  if (unique.length === 0) {
    return NextResponse.json({ error: "Missing search query." }, { status: 400 });
  }

  try {
    for (const query of unique) {
      const results = await searchNominatim(query);
      if (results.length > 0) {
        return NextResponse.json({ results, query });
      }
    }
    return NextResponse.json({ results: [], query: unique[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Geocoding failed." },
      { status: 502 },
    );
  }
}
