import type { AreaGeometry } from "@/lib/types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

export function parseGeometry(value: unknown): AreaGeometry | null | { error: string } {
  if (value == null || value === "") return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { error: "Geometry is not valid JSON." };
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return { error: "Geometry must be a GeoJSON object." };
  }
  const geo = parsed as { type?: string; coordinates?: unknown };
  if (geo.type === "Point") {
    if (!isPosition(geo.coordinates)) return { error: "Point geometry has invalid coordinates." };
    return { type: "Point", coordinates: [geo.coordinates[0], geo.coordinates[1]] };
  }
  if (geo.type === "LineString") {
    if (!Array.isArray(geo.coordinates) || geo.coordinates.length === 0) {
      return { error: "LineString geometry has invalid coordinates." };
    }
    const coords: [number, number][] = [];
    for (const pair of geo.coordinates) {
      if (!isPosition(pair)) return { error: "LineString geometry has invalid coordinates." };
      coords.push([pair[0], pair[1]]);
    }
    return { type: "LineString", coordinates: coords };
  }
  return { error: "Geometry must be a GeoJSON Point or LineString." };
}
