import type { FloodProneArea, LocationAccuracy } from "@/lib/types";

/**
 * Frontend map marker — deliberately decoupled from Google Sheet column
 * names. `toMapMarker` is the only place that reads sheet-shaped fields;
 * every map component consumes this type instead.
 */
export interface FloodMapMarker {
  id: number;
  latitude: number;
  longitude: number;
  accuracy: LocationAccuracy;
  isProposed: boolean;
  title: string;
  subtitle: string;
}

/** Returns null when a record has no plottable point — callers must not fabricate one. */
export function toMapMarker(area: FloodProneArea): FloodMapMarker | null {
  const loc = area.location;
  if (!loc) return null;

  const lat = loc.latitude ?? loc.proposedLatitude;
  const lng = loc.longitude ?? loc.proposedLongitude;
  if (lat === null || lng === null || lat === undefined || lng === undefined) return null;

  return {
    id: area.rowIndex,
    latitude: lat,
    longitude: lng,
    accuracy: loc.accuracy,
    isProposed: loc.latitude === null || loc.latitude === undefined,
    title: area.roadNameWaterways || area.barangay,
    subtitle: [area.barangay, area.municipalityCity, area.province].filter(Boolean).join(", "),
  };
}
