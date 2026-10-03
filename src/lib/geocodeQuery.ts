import type { LocationAccuracy } from "./types";

/**
 * Builds the progressively broader geocoding queries for an area
 * (road → barangay → municipality → province → region), mirroring
 * apps-script/LocationResolver.js's hierarchy. Pure and dependency-free so it
 * can be unit-tested and reused. Each tier carries its own accuracy label —
 * deriving it from the array position is wrong as soon as an early tier is
 * empty or de-duplicated.
 *
 * The Sheet's text is written for people, not geocoders ("Aklan East Road
 * (S00322PN)", "Multiple / Grace Park area", "Padang, Poblacion, Igbobon"),
 * and those strings almost never match OpenStreetMap. The `clean*` helpers
 * strip that decoration so more lookups succeed at the precise tiers,
 * instead of falling through to a coarse one. The Sheet itself is never
 * modified (CLAUDE.md §6).
 */

export interface GeocodeTier {
  query: string;
  accuracy: LocationAccuracy;
}

interface AreaLike {
  roadNameWaterways?: string;
  barangay?: string;
  municipalityCity?: string;
  province?: string;
  region?: string;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** "Aklan East Road (S00322PN)" → "Aklan East Road"; drops "area" suffixes and stray punctuation. */
export function cleanRoad(road: string | undefined): string {
  if (!road) return "";
  return squash(road.replace(/\([^)]*\)/g, " ").replace(/\barea\b/gi, " ").replace(/[–—]/g, "-"));
}

/**
 * A barangay cell often lists several ("Padang, Poblacion, Igbobon", "Fe & Caridad")
 * or is a placeholder ("Multiple", "Multiple / Las Piñas"). Use the first named
 * barangay; placeholders mean "no barangay".
 */
export function cleanBarangay(barangay: string | undefined): string {
  if (!barangay) return "";
  const trimmed = squash(barangay);
  if (/^multiple\b/i.test(trimmed)) return "";
  const first = trimmed.split(/\s*(?:,|&|\/|\band\b|\bto\b)\s*/i)[0] ?? "";
  return squash(first.replace(/\barea\b/gi, " ").replace(/^pob\.?(?=\s|$)/i, "Poblacion"));
}

export function buildGeocodingTiers(area: AreaLike): GeocodeTier[] {
  const road = cleanRoad(area.roadNameWaterways);
  const barangay = cleanBarangay(area.barangay);
  const municipality = squash(area.municipalityCity ?? "");
  const province = squash(area.province ?? "");
  const region = squash(area.region ?? "");

  const tiers: Array<{ accuracy: LocationAccuracy; parts: string[] }> = [
    { accuracy: "road", parts: [road, barangay, municipality, province] },
    { accuracy: "barangay", parts: [barangay, municipality, province] },
    { accuracy: "municipality", parts: [municipality, province] },
    { accuracy: "province", parts: [province] },
    { accuracy: "region", parts: [region] },
  ];

  const result: GeocodeTier[] = [];
  const seen = new Set<string>();
  for (const { accuracy, parts } of tiers) {
    const present = parts.filter(Boolean);
    // A "road" tier without a road, or "barangay" without a barangay, is just a broader tier in disguise.
    if (accuracy === "road" && !road) continue;
    if (accuracy === "barangay" && !barangay) continue;
    if (present.length === 0) continue;
    const query = [...present, "Philippines"].join(", ");
    if (seen.has(query)) continue;
    seen.add(query);
    result.push({ query, accuracy });
  }
  return result;
}
