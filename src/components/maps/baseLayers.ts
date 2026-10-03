import type { StyleSpecification, LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";

/**
 * Selectable base maps. All are free, key-less raster tile services (no
 * account or billing needed — same reasoning as using Nominatim, CLAUDE.md
 * §8). Each entry carries the attribution its provider requires. Keep usage
 * modest: OSM and Esri tile servers are fair-use services, not CDNs.
 */
export type BaseLayerId = "standard" | "satellite" | "hybrid" | "terrain" | "light";

interface RasterSource {
  tiles: string[];
  attribution: string;
  maxzoom: number;
}

const OSM: RasterSource = {
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
  maxzoom: 19,
};
const ESRI_IMAGERY: RasterSource = {
  tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
  attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  maxzoom: 19,
};
const ESRI_LABELS: RasterSource = {
  tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
  attribution: "Labels © Esri",
  maxzoom: 19,
};
const TOPO: RasterSource = {
  tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
  attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, SRTM | © <a href='https://opentopomap.org'>OpenTopoMap</a> (CC-BY-SA)",
  maxzoom: 17,
};
const LIGHT: RasterSource = {
  tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`),
  attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors © <a href='https://carto.com/attributions'>CARTO</a>",
  maxzoom: 19,
};

export const BASE_LAYERS: Array<{ id: BaseLayerId; label: string; swatch: string; sources: RasterSource[] }> = [
  { id: "standard", label: "Standard", swatch: "linear-gradient(135deg,#aad3df 0 35%,#f2efe9 35% 65%,#c8e6a0 65%)", sources: [OSM] },
  { id: "satellite", label: "Satellite", swatch: "linear-gradient(135deg,#1d3b2a,#3c5a3a 50%,#5d7a4c)", sources: [ESRI_IMAGERY] },
  { id: "hybrid", label: "Satellite + labels", swatch: "linear-gradient(135deg,#1d3b2a,#3c5a3a 55%,#e8e8e8 55% 62%,#3c5a3a 62%)", sources: [ESRI_IMAGERY, ESRI_LABELS] },
  { id: "terrain", label: "Terrain", swatch: "linear-gradient(135deg,#d9e8c5,#e8d9a8 50%,#c4a574)", sources: [TOPO] },
  { id: "light", label: "Light", swatch: "linear-gradient(135deg,#f5f5f5,#e6e6e6 50%,#fafafa)", sources: [LIGHT] },
];

export const DEFAULT_BASE_LAYER: BaseLayerId = "standard";

export function isBaseLayerId(value: unknown): value is BaseLayerId {
  return BASE_LAYERS.some((layer) => layer.id === value);
}

/** Marker data: one point per located (or proposed) area. `proposed` = approximate, needs review; `selected` = the row picked in the list. */
export type AreaFeatureCollection = FeatureCollection<Point, { id: number; proposed: boolean; selected: boolean }>;

export const AREAS_LAYER_ID = "areas";

/**
 * The whole map as one declarative style: the chosen base map, then the
 * flood-prone-area markers on top. MapLibre diffs successive styles, so
 * switching base layers only swaps raster layers and a new selection only
 * updates the marker data — nothing is rebuilt.
 */
export function buildMapStyle(baseId: BaseLayerId, areas: AreaFeatureCollection): StyleSpecification {
  const base = BASE_LAYERS.find((layer) => layer.id === baseId) ?? BASE_LAYERS[0];
  const sources: Record<string, SourceSpecification> = {};
  const layers: LayerSpecification[] = [{ id: "background", type: "background", paint: { "background-color": "#dbe6fb" } }];

  base.sources.forEach((source, i) => {
    const id = `base-${i}`;
    sources[id] = { type: "raster", tiles: source.tiles, tileSize: 256, maxzoom: source.maxzoom, attribution: source.attribution };
    layers.push({ id, type: "raster", source: id });
  });

  sources.areas = { type: "geojson", data: areas };
  layers.push({
    id: AREAS_LAYER_ID,
    type: "circle",
    source: "areas",
    layout: { "circle-sort-key": ["case", ["get", "selected"], 1, 0] },
    paint: {
      "circle-radius": ["case", ["get", "selected"], 11, 7],
      "circle-color": ["case", ["get", "proposed"], "#f26a1b", "#4f86e8"],
      "circle-opacity": 0.9,
      "circle-stroke-width": ["case", ["get", "selected"], 3, 2],
      "circle-stroke-color": ["case", ["get", "selected"], "#071a4a", ["get", "proposed"], "#e0560b", "#1a4aa8"],
      // Keep markers upright and round when the map is rotated or tilted.
      "circle-pitch-alignment": "viewport",
      "circle-pitch-scale": "viewport",
    },
  });

  return { version: 8, sources, layers };
}
