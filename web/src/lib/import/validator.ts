import { parseGeometry } from "@/lib/import/geojson";
import type { ValidationIssue } from "@/lib/import/types";
import type { FloodProneAreaInput } from "@/lib/types";

export function validateFloodRecord(record: FloodProneAreaInput): ValidationIssue[] {
  const errors: ValidationIssue[] = [];

  if (!record.city_municipality?.trim()) {
    errors.push({ field: "city_municipality", message: "City / municipality is required." });
  }

  if (record.latitude != null) {
    if (!Number.isFinite(record.latitude) || record.latitude < -90 || record.latitude > 90) {
      errors.push({ field: "latitude", message: "Latitude must be between -90 and 90." });
    }
  }

  if (record.longitude != null) {
    if (!Number.isFinite(record.longitude) || record.longitude < -180 || record.longitude > 180) {
      errors.push({ field: "longitude", message: "Longitude must be between -180 and 180." });
    }
  }

  if (record.road_length != null && !Number.isFinite(record.road_length)) {
    errors.push({ field: "road_length", message: "Road length must be numeric." });
  }

  if (record.geometry) {
    const parsed = parseGeometry(record.geometry);
    if (parsed && "error" in parsed) {
      errors.push({ field: "geometry", message: parsed.error });
    }
  }

  return errors;
}
