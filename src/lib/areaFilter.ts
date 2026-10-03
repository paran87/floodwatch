import type { FloodProneArea, FloodProneAreaFilters } from "./types";

/**
 * Pure filtering/facet helpers shared by the server snapshot (areasCache.ts)
 * and the browser. The browser filters the full dataset locally, so
 * searching and filter changes are instant and never hit the network.
 * Mirrors apps-script/FloodProneAreas.js action_getFloodProneAreas_.
 */

function includesIgnoreCase(haystack: string | undefined, needle: string): boolean {
  return (haystack ?? "").toLowerCase().includes(needle.toLowerCase());
}

export function filterAreas(all: FloodProneArea[], filters: FloodProneAreaFilters): FloodProneArea[] {
  const search = filters.search?.trim();
  const noFilters = !search && !filters.region && !filters.province && !filters.municipalityCity && !filters.barangay && !filters.deo && !filters.accuracy;
  if (noFilters) return all;

  return all.filter((row) => {
    if (filters.region && row.region !== filters.region) return false;
    if (filters.province && row.province !== filters.province) return false;
    if (filters.municipalityCity && row.municipalityCity !== filters.municipalityCity) return false;
    if (filters.barangay && row.barangay !== filters.barangay) return false;
    if (filters.deo && row.deo !== filters.deo) return false;
    if (filters.accuracy && row.location?.accuracy !== filters.accuracy) return false;
    if (
      search &&
      !(
        includesIgnoreCase(row.province, search) ||
        includesIgnoreCase(row.municipalityCity, search) ||
        includesIgnoreCase(row.barangay, search) ||
        includesIgnoreCase(row.roadNameWaterways, search) ||
        includesIgnoreCase(row.deo, search)
      )
    ) {
      return false;
    }
    return true;
  });
}

export interface AreaFacets {
  regions: string[];
  provinces: string[];
  municipalities: string[];
  barangays: string[];
  deos: string[];
}

export function computeFacets(all: FloodProneArea[]): AreaFacets {
  const uniqueSorted = (pick: (row: FloodProneArea) => string) => Array.from(new Set(all.map(pick).filter(Boolean))).sort();
  return {
    regions: uniqueSorted((r) => r.region),
    provinces: uniqueSorted((r) => r.province),
    municipalities: uniqueSorted((r) => r.municipalityCity),
    barangays: uniqueSorted((r) => r.barangay),
    deos: uniqueSorted((r) => r.deo),
  };
}
