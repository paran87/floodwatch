import { emptyFloodInput, type FloodAreaField } from "@/lib/google-sheets/mapper";
import { foldCompare } from "@/lib/import/normalizer";
import { parseGeometry } from "@/lib/import/geojson";
import type { FloodProneAreaInput } from "@/lib/types";

const ALLOWED_FIELDS: FloodAreaField[] = [
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
];

export type AiNormalizationResult = {
  normalized_data: FloodProneAreaInput;
  confidence: number;
  warnings: string[];
};

function asString(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function asNumber(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseAiNormalization(payload: unknown): AiNormalizationResult | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    normalized_data?: Record<string, unknown>;
    confidence?: unknown;
    warnings?: unknown;
  };
  if (!data.normalized_data || typeof data.normalized_data !== "object") return null;

  const record = emptyFloodInput();
  for (const field of ALLOWED_FIELDS) {
    if (!(field in data.normalized_data)) continue;
    const value = data.normalized_data[field];
    if (field === "road_length" || field === "latitude" || field === "longitude") {
      (record as Record<string, unknown>)[field] = asNumber(value);
    } else if (field === "geometry") {
      const geometry = parseGeometry(value);
      record.geometry = geometry && "error" in geometry ? null : geometry;
    } else if (field === "city_municipality") {
      record.city_municipality = asString(value) ?? "";
    } else {
      (record as Record<string, unknown>)[field] = asString(value);
    }
  }

  const confidence = asNumber(data.confidence) ?? 0;
  const warnings = Array.isArray(data.warnings)
    ? data.warnings.map((item) => String(item)).filter(Boolean)
    : [];

  return { normalized_data: record, confidence, warnings };
}

function sourceHadValue(mapped: Partial<Record<FloodAreaField, string>>, field: FloodAreaField) {
  return Boolean(mapped[field]?.trim());
}

export function mergeAiNormalization(
  current: FloodProneAreaInput,
  mapped: Partial<Record<FloodAreaField, string>>,
  ai: AiNormalizationResult,
): { record: FloodProneAreaInput; warnings: string[] } {
  const record = { ...current };
  const warnings = [...ai.warnings];

  for (const field of ALLOWED_FIELDS) {
    if (field === "flood_status" || field === "location_source") continue;
    const aiValue = ai.normalized_data[field];
    if (aiValue == null || aiValue === "") continue;
    if (!sourceHadValue(mapped, field)) {
      warnings.push(`AI suggested ${field} but the spreadsheet had no value, so it was ignored.`);
      continue;
    }
    if (field === "city_municipality") {
      record.city_municipality = String(aiValue);
      continue;
    }
    (record as Record<string, unknown>)[field] = aiValue;
  }

  if (!sourceHadValue(mapped, "flood_status")) {
    record.flood_status = current.flood_status || "Flood-prone";
  }
  if (!sourceHadValue(mapped, "location_source")) {
    record.location_source = current.location_source || "Google Sheet";
  }

  if (foldCompare(record.city_municipality) !== foldCompare(current.city_municipality) && mapped.city_municipality) {
    const aiCity = foldCompare(record.city_municipality);
    const rawCity = foldCompare(mapped.city_municipality);
    if (aiCity && rawCity && !rawCity.includes(aiCity) && !aiCity.includes(rawCity.split(" ")[0] ?? "")) {
      record.city_municipality = current.city_municipality;
      warnings.push("AI municipality did not match the spreadsheet value and was ignored.");
    }
  }

  return { record, warnings };
}
