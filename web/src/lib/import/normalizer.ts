import { emptyFloodInput } from "@/lib/google-sheets/mapper";
import type { FloodAreaField } from "@/lib/google-sheets/mapper";
import { toCoord } from "@/lib/geo";
import type { AreaGeometry, FloodProneAreaInput } from "@/lib/types";
import { parseGeometry } from "@/lib/import/geojson";

const REGION_ALIASES: Record<string, string> = {
  ncr: "NCR",
  "national capital region": "NCR",
  car: "CAR",
  "cordillera administrative region": "CAR",
  i: "Region I",
  "region i": "Region I",
  ilocos: "Region I",
  "ilocos region": "Region I",
  ii: "Region II",
  "region ii": "Region II",
  "cagayan valley": "Region II",
  iii: "Region III",
  "region iii": "Region III",
  "central luzon": "Region III",
  iva: "CALABARZON",
  "iv a": "CALABARZON",
  "iv-a": "CALABARZON",
  "region iv-a": "CALABARZON",
  "region iva": "CALABARZON",
  calabarzon: "CALABARZON",
  ivb: "MIMAROPA",
  "iv b": "MIMAROPA",
  "iv-b": "MIMAROPA",
  "region iv-b": "MIMAROPA",
  "region ivb": "MIMAROPA",
  mimaropa: "MIMAROPA",
  v: "Region V",
  "region v": "Region V",
  bicol: "Region V",
  "bicol region": "Region V",
  vi: "Region VI",
  "region vi": "Region VI",
  "western visayas": "Region VI",
  vii: "Region VII",
  "region vii": "Region VII",
  "central visayas": "Region VII",
  viii: "Region VIII",
  "region viii": "Region VIII",
  "eastern visayas": "Region VIII",
  ix: "Region IX",
  "region ix": "Region IX",
  "zamboanga peninsula": "Region IX",
  x: "Region X",
  "region x": "Region X",
  "northern mindanao": "Region X",
  xi: "Region XI",
  "region xi": "Region XI",
  davao: "Region XI",
  "davao region": "Region XI",
  xii: "Region XII",
  "region xii": "Region XII",
  soccsksargen: "Region XII",
  xiii: "Region XIII",
  "region xiii": "Region XIII",
  caraga: "Region XIII",
  barmm: "BARMM",
  armm: "BARMM",
  nir: "NEGROS ISLAND REGION",
  "negros island region": "NEGROS ISLAND REGION",
  "negros island": "NEGROS ISLAND REGION",
};

const DEO_RULES: Array<[RegExp, string]> = [
  [/\bocc(?:idental)?\.?\s*mindoro\b/i, "Occidental Mindoro DEO"],
  [/\bor(?:iental)?\.?\s*mindoro\b/i, "Oriental Mindoro DEO"],
];

export function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function expandAbbreviations(value: string) {
  return collapseWhitespace(
    value
      .replace(/\bnatl\b\.?/gi, "National")
      .replace(/\bhwy\b\.?/gi, "Highway")
      .replace(/\brd\b\.?/gi, "Road")
      .replace(/\bst\b\.?/gi, "Street")
      .replace(/\bave\b\.?/gi, "Avenue")
      .replace(/\bblvd\b\.?/gi, "Boulevard"),
  );
}

export function stripBarangayPrefix(value: string) {
  return collapseWhitespace(value.replace(/^(brgy\.?|barangay)\s+/i, ""));
}

export function titleCase(value: string) {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bDeo\b/g, "DEO")
    .replace(/\bNcr\b/g, "NCR")
    .replace(/\bBarmm\b/g, "BARMM")
    .replace(/\bMimaropa\b/g, "MIMAROPA")
    .replace(/\bCalabarzon\b/g, "CALABARZON");
}

export function foldCompare(value: string | null | undefined) {
  return expandAbbreviations(stripBarangayPrefix(value ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function comparisonKey(input: {
  region?: string | null;
  deo?: string | null;
  city_municipality?: string | null;
  barangay?: string | null;
  road_name?: string | null;
}) {
  return [
    foldCompare(normalizeRegion(input.region)),
    foldCompare(normalizeDeo(input.deo)),
    foldCompare(input.city_municipality),
    foldCompare(input.barangay),
    foldCompare(input.road_name),
  ].join("|");
}

export function rawDedupKey(input: {
  region?: string | null;
  deo?: string | null;
  city_municipality?: string | null;
  barangay?: string | null;
  road_name?: string | null;
}) {
  return [
    input.region ?? "",
    input.deo ?? "",
    input.city_municipality ?? "",
    input.barangay ?? "",
    input.road_name ?? "",
  ].join("|");
}

function foldLookup(value: string) {
  return value
    .toLowerCase()
    .replace(/^region\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeRegion(value: string | null | undefined) {
  const raw = collapseWhitespace(value ?? "");
  if (!raw) return null;
  const folded = foldLookup(raw);
  return REGION_ALIASES[folded] ?? REGION_ALIASES[raw.toLowerCase()] ?? raw;
}

export function isKnownRegionLabel(value: string | null | undefined) {
  const raw = collapseWhitespace(value ?? "");
  if (!raw) return false;
  const folded = foldLookup(raw);
  if (REGION_ALIASES[folded] || REGION_ALIASES[raw.toLowerCase()]) return true;
  return /^(region\s+)?([ivxlcdm]+-?[ab]?|\d{1,2})$/i.test(raw);
}

export function normalizeDeo(value: string | null | undefined) {
  const raw = collapseWhitespace(value ?? "");
  if (!raw) return null;
  for (const [pattern, replacement] of DEO_RULES) {
    if (pattern.test(raw)) return replacement;
  }
  const expanded = expandAbbreviations(raw);
  return /deo$/i.test(expanded) ? titleCase(expanded) : `${titleCase(expanded)}`.replace(/\s+Deo$/i, " DEO");
}

export function normalizePlaceName(value: string | null | undefined) {
  const raw = collapseWhitespace(value ?? "");
  if (!raw) return null;
  const withoutPrefix = stripBarangayPrefix(expandAbbreviations(raw));
  return titleCase(withoutPrefix);
}

export function splitCityAndProvince(value: string) {
  const parts = value.split(",").map((part) => collapseWhitespace(part)).filter(Boolean);
  if (parts.length < 2) return { city: value, extra: null };
  return { city: parts[0], extra: parts.slice(1).join(", ") };
}

function parseNumber(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

export function normalizeMappedFields(
  mapped: Partial<Record<FloodAreaField, string>>,
): { record: FloodProneAreaInput; warnings: string[] } {
  const warnings: string[] = [];
  const record = emptyFloodInput();

  const cityRaw = mapped.city_municipality ? collapseWhitespace(mapped.city_municipality) : "";
  if (cityRaw.includes(",")) {
    const split = splitCityAndProvince(cityRaw);
    record.city_municipality = titleCase(split.city);
    if (split.extra && !mapped.deo) {
      warnings.push(`Municipality cell also contained "${split.extra}"; it was not copied into DEO.`);
    }
  } else {
    record.city_municipality = cityRaw ? titleCase(cityRaw) : "";
  }

  record.name = mapped.name ? titleCase(expandAbbreviations(mapped.name)) : null;
  record.address = mapped.address ? collapseWhitespace(mapped.address) : null;
  record.barangay = normalizePlaceName(mapped.barangay);
  record.road_name = mapped.road_name ? titleCase(expandAbbreviations(mapped.road_name)) : null;
  record.region = normalizeRegion(mapped.region);
  record.deo = mapped.deo ? normalizeDeo(mapped.deo) : null;
  record.description = mapped.description ? collapseWhitespace(mapped.description) : null;
  record.flood_status = mapped.flood_status ? collapseWhitespace(mapped.flood_status) : "Flood-prone";
  record.location_source = mapped.location_source
    ? collapseWhitespace(mapped.location_source)
    : "Google Sheet";

  if (mapped.road_length) {
    const length = parseNumber(mapped.road_length);
    if (Number.isNaN(length)) {
      warnings.push("Road length is not a valid number.");
      record.road_length = null;
    } else {
      record.road_length = length;
    }
  }

  if (mapped.latitude) {
    const lat = toCoord(mapped.latitude.replace(/,/g, ""));
    record.latitude = lat;
    if (lat == null) warnings.push("Latitude could not be parsed.");
  }
  if (mapped.longitude) {
    const lng = toCoord(mapped.longitude.replace(/,/g, ""));
    record.longitude = lng;
    if (lng == null) warnings.push("Longitude could not be parsed.");
  }

  if (mapped.geometry) {
    const geometry = parseGeometry(mapped.geometry);
    if (geometry && "error" in geometry) {
      warnings.push(geometry.error);
      record.geometry = null;
    } else {
      record.geometry = geometry as AreaGeometry | null;
    }
  }

  if (!record.name) {
    record.name = record.road_name || record.barangay || record.city_municipality || null;
  }

  return { record, warnings };
}

export function displayText(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
