import type { AreaGeometry } from "@/lib/types";

export const PH_CENTER: [number, number] = [12.8797, 121.774];
export const PH_BOUNDS: [[number, number], [number, number]] = [
  [4.4, 116.0],
  [21.3, 127.0],
];

export function toCoord(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

export function validLatLng(lat: unknown, lng: unknown): [number, number] | null {
  const latitude = toCoord(lat);
  const longitude = toCoord(lng);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return [latitude, longitude];
}

export function hasCoordinates(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return validLatLng(latitude, longitude) != null;
}

export function lineStringFromLatLngs(points: [number, number][]): AreaGeometry | null {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return { type: "Point", coordinates: [points[0][1], points[0][0]] };
  }
  return {
    type: "LineString",
    coordinates: points.map(([lat, lng]) => [lng, lat]),
  };
}

export function latLngsFromGeometry(geometry: AreaGeometry | null): [number, number][] {
  if (!geometry) return [];
  if (geometry.type === "Point") {
    const lng = toCoord(geometry.coordinates?.[0]);
    const lat = toCoord(geometry.coordinates?.[1]);
    return lat != null && lng != null ? [[lat, lng]] : [];
  }
  if (!Array.isArray(geometry.coordinates)) return [];
  return geometry.coordinates.flatMap((pair) => {
    if (!Array.isArray(pair)) return [];
    const lng = toCoord(pair[0]);
    const lat = toCoord(pair[1]);
    return lat != null && lng != null ? [[lat, lng]] : [];
  });
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a: [number, number], b: [number, number]) {
  const earth = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthMeters(points: [number, number][]) {
  if (points.length < 2) return 0;
  return points.slice(1).reduce((sum, point, index) => {
    return sum + haversineMeters(points[index], point);
  }, 0);
}

export function formatLength(meters: number | null | undefined) {
  if (meters == null || !Number.isFinite(meters)) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  if (meters >= 10) return `${Math.round(meters)} m`;
  return `${meters.toFixed(1)} m`;
}

export function firstPlacePart(value: string | null | undefined) {
  if (!value) return null;
  const part = value
    .split(/[/;]| to /i)
    .map((item) => item.trim())
    .find(Boolean);
  if (!part) return null;
  return part.replace(/^(brgy\.?|barangay)\s+/i, "").trim() || null;
}

export function geocodeAttempts(input: {
  road_name?: string | null;
  barangay?: string | null;
  city_municipality?: string | null;
  address?: string | null;
  region?: string | null;
}) {
  const road = firstPlacePart(input.road_name);
  const barangay = firstPlacePart(input.barangay);
  const city = firstPlacePart(input.city_municipality);
  const region = firstPlacePart(input.region);
  const attempts = [
    [road, barangay, city, "Philippines"],
    [barangay, city, "Philippines"],
    [road, city, "Philippines"],
    [barangay, city, region, "Philippines"],
    [city, "Philippines"],
  ]
    .map((parts) => parts.filter(Boolean).join(", "))
    .filter((query) => query.split(",").length >= 2);

  return [...new Set(attempts)];
}

export function buildGeocodeQuery(input: {
  road_name?: string | null;
  barangay?: string | null;
  city_municipality?: string | null;
  address?: string | null;
  region?: string | null;
}) {
  return geocodeAttempts(input)[0] ?? [input.address, "Philippines"].filter(Boolean).join(", ");
}
