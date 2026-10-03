import type { FloodProneArea } from "./types";

export interface ApproximateLocation {
  latitude: number;
  longitude: number;
  /** How the guess was formed: neighbours in the same municipality, or in the same province. */
  basis: "municipality" | "province";
}

function pointOf(area: FloodProneArea): { lat: number; lng: number } | null {
  const loc = area.location;
  if (!loc) return null;
  const lat = loc.latitude ?? loc.proposedLatitude;
  const lng = loc.longitude ?? loc.proposedLongitude;
  return lat == null || lng == null ? null : { lat, lng };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * An instant, temporary stand-in shown while the precise lookup runs: the
 * median position of areas in the same municipality (else province) that
 * already have a real or proposed location. It is derived from real
 * geocoding results, labelled approximate in the UI, never saved, and
 * dropped as soon as the precise result arrives — nothing is invented
 * (CLAUDE.md §8). Returns null when no neighbour has a location.
 */
export function approximateFromNeighbours(area: FloodProneArea, all: FloodProneArea[]): ApproximateLocation | null {
  const sameProvince = all.filter((a) => a.rowIndex !== area.rowIndex && a.province === area.province);
  const sameMunicipality = sameProvince.filter((a) => a.municipalityCity === area.municipalityCity);

  for (const [group, basis] of [[sameMunicipality, "municipality"], [sameProvince, "province"]] as const) {
    const points = group.map(pointOf).filter((p): p is { lat: number; lng: number } => p !== null);
    if (points.length > 0) {
      return { latitude: median(points.map((p) => p.lat)), longitude: median(points.map((p) => p.lng)), basis };
    }
  }
  return null;
}
