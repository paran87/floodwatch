import type { FloodProneAreaInput } from "@/lib/types";

export const FLOOD_AREA_FIELDS = [
  "name",
  "address",
  "barangay",
  "city_municipality",
  "road_name",
  "road_length",
  "latitude",
  "longitude",
  "flood_status",
  "description",
  "geometry",
  "region",
  "deo",
  "location_source",
] as const;

export type FloodAreaField = (typeof FLOOD_AREA_FIELDS)[number];

const FIELD_ALIASES: Record<FloodAreaField, string[]> = {
  name: ["name", "location name", "place name", "place", "location"],
  address: ["address", "full address", "location address"],
  barangay: ["barangay", "brgy", "brgy name", "barangay name", "barangay/village"],
  city_municipality: [
    "city municipality",
    "city/municipality",
    "municipality/city",
    "municipality",
    "city",
    "lgu",
    "city or municipality",
    "municipality city",
  ],
  road_name: [
    "road name",
    "road",
    "road/street",
    "street",
    "street name",
    "highway",
    "national road",
  ],
  road_length: ["road length", "length", "length m", "length meters", "km"],
  latitude: ["latitude", "lat", "y"],
  longitude: ["longitude", "lng", "lon", "long", "x"],
  flood_status: ["flood status", "status", "risk", "flood risk"],
  description: ["description", "remarks", "notes", "comment"],
  geometry: ["geometry", "geojson", "wkt"],
  region: ["region"],
  deo: ["deo", "district engineering office", "district", "engineering office"],
  location_source: ["location source", "source", "geocode source"],
};

export function foldHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function mapHeaderToField(header: string): FloodAreaField | null {
  const folded = foldHeader(header);
  if (!folded) return null;
  for (const field of FLOOD_AREA_FIELDS) {
    if (FIELD_ALIASES[field].some((alias) => foldHeader(alias) === folded)) return field;
  }
  return null;
}

export function isFieldHeaderLiteral(field: FloodAreaField, value: string) {
  const folded = foldHeader(value);
  if (!folded) return false;
  return FIELD_ALIASES[field].some((alias) => foldHeader(alias) === folded);
}

export type ColumnMapping = {
  field: FloodAreaField;
  header: string;
};

export type MappingResult = {
  mapping: ColumnMapping[];
  unmappedHeaders: string[];
  mapped: Partial<Record<FloodAreaField, string>>;
};

export function mapRowColumns(
  headers: string[],
  values: unknown[],
): MappingResult {
  const mapping: ColumnMapping[] = [];
  const unmappedHeaders: string[] = [];
  const mapped: Partial<Record<FloodAreaField, string>> = {};
  const used = new Set<FloodAreaField>();

  headers.forEach((header, index) => {
    const field = mapHeaderToField(header);
    const value = values[index];
    const text = value == null ? "" : String(value).trim();
    if (!field) {
      if (foldHeader(header)) unmappedHeaders.push(header);
      return;
    }
    if (used.has(field)) {
      unmappedHeaders.push(header);
      return;
    }
    used.add(field);
    mapping.push({ field, header });
    if (text) mapped[field] = text;
  });

  return { mapping, unmappedHeaders, mapped };
}

export function rowObject(headers: string[], values: unknown[]) {
  const raw: Record<string, string> = {};
  headers.forEach((header, index) => {
    const key = header?.trim();
    if (!key) return;
    raw[key] = values[index] == null ? "" : String(values[index]).trim();
  });
  return raw;
}

export function emptyFloodInput(): FloodProneAreaInput {
  return {
    name: null,
    address: null,
    barangay: null,
    city_municipality: "",
    road_name: null,
    road_length: null,
    latitude: null,
    longitude: null,
    flood_status: "Flood-prone",
    description: null,
    geometry: null,
    region: null,
    deo: null,
    location_source: "Google Sheet",
  };
}
