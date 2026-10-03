"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Map, NavigationControl, Popup, useMap, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import type { FloodMapMarker } from "./types";
import type { LocationAccuracy } from "@/lib/types";
import { AREAS_LAYER_ID, DEFAULT_BASE_LAYER, buildMapStyle, isBaseLayerId, type AreaFeatureCollection, type BaseLayerId } from "./baseLayers";
import { LayerSwitcher } from "./LayerSwitcher";

const PHILIPPINES_CENTER = { longitude: 121.774, latitude: 12.8797 };
const STORAGE_KEY = "floodwatch.baseLayer";

// MapLibre's worker has to be served from a known URL (see scripts/copy-maplibre-worker.mjs); set it
// before the first map is created. Passed to <Map> through `mapLib` so that ordering is guaranteed.
const maplibre = import("maplibre-gl").then((lib) => {
  lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  return lib;
});

/**
 * How far to zoom in on a selected marker — the coarser the match, the wider
 * the view. MapLibre's zoom scale is one step below the 256px-tile scale the
 * numbers were originally chosen on, hence the -1 where they're used.
 */
const ZOOM_BY_ACCURACY: Partial<Record<LocationAccuracy, number>> = {
  exact: 17,
  address: 16,
  road: 15,
  barangay: 14,
  municipality: 12,
  province: 9,
  region: 7,
};

function FlyToSelected({ marker, bottomInset }: { marker: FloodMapMarker | undefined; bottomInset: number }) {
  const { current: map } = useMap();
  // Read through a ref so dragging the sheet (which changes the inset) doesn't re-trigger the fly-to.
  const insetRef = useRef(bottomInset);
  useEffect(() => {
    insetRef.current = bottomInset;
  }, [bottomInset]);

  const id = marker?.id;
  const latitude = marker?.latitude;
  const longitude = marker?.longitude;
  const accuracy = marker?.accuracy;

  useEffect(() => {
    if (!map || id === undefined || latitude === undefined || longitude === undefined) return;
    // `padding` keeps the pin centred in the part of the map not covered by the mobile sheet.
    map.flyTo({
      center: [longitude, latitude],
      zoom: (ZOOM_BY_ACCURACY[accuracy as LocationAccuracy] ?? 13) - 1,
      padding: { top: 0, left: 0, right: 0, bottom: insetRef.current },
      duration: 800,
    });
  }, [map, id, latitude, longitude, accuracy]);
  return null;
}

function readSavedBaseLayer(): BaseLayerId {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isBaseLayerId(saved)) return saved;
  } catch {
    /* storage can be blocked (private mode); fall back to the default */
  }
  return DEFAULT_BASE_LAYER;
}

/**
 * Reusable map. It only ever plots markers that already carry real or
 * proposed coordinates (see toMapMarker) — records without a location stay in
 * the list instead (CLAUDE.md §8 "Map behavior"). Supports Google-Maps-style
 * gestures: two-finger rotate/tilt on touch, right-drag or Ctrl-drag on
 * desktop, a compass button to reset north, and a base-layer switcher
 * (standard / satellite / hybrid / terrain / light).
 */
export function FloodMap({
  markers,
  selectedId,
  bottomInset = 0,
}: {
  markers: FloodMapMarker[];
  selectedId?: number | null;
  /** Pixels at the bottom of the map covered by an overlay (the mobile sheet). */
  bottomInset?: number;
}) {
  const [baseLayer, setBaseLayer] = useState<BaseLayerId>(readSavedBaseLayer);
  const [cursor, setCursor] = useState("");
  // A popup opens for the selected row, or for a marker the user taps; each can be dismissed.
  const [clickedId, setClickedId] = useState<number | null>(null);
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId);
    setClickedId(null);
    setDismissedId(null);
  }

  const areas = useMemo<AreaFeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: markers.map((m) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.longitude, m.latitude] },
        properties: { id: m.id, proposed: m.isProposed, selected: m.id === selectedId },
      })),
    }),
    [markers, selectedId],
  );
  const mapStyle = useMemo(() => buildMapStyle(baseLayer, areas), [baseLayer, areas]);

  const selected = selectedId == null ? undefined : markers.find((m) => m.id === selectedId);
  const popupId = clickedId ?? selectedId ?? null;
  const popupMarker = popupId !== null && popupId !== dismissedId ? markers.find((m) => m.id === popupId) : undefined;

  function chooseBaseLayer(id: BaseLayerId) {
    setBaseLayer(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* not persisting is fine */
    }
  }

  function onClick(e: MapLayerMouseEvent) {
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "number") {
      setClickedId(id);
      setDismissedId(null);
    }
  }

  return (
    <div className="relative h-full w-full">
      <Map
        mapLib={maplibre}
        initialViewState={{ ...PHILIPPINES_CENTER, zoom: 5 }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={[AREAS_LAYER_ID]}
        onClick={onClick}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        cursor={cursor}
        // Rotation and tilt are on by default: two-finger twist/drag on touch, right-drag or Ctrl-drag with a mouse.
        dragRotate
        touchZoomRotate
        touchPitch
        maxPitch={60}
        minZoom={3}
      >
        {/* Zoom buttons plus a compass that shows the current bearing and resets north when tapped. */}
        <NavigationControl position="top-right" showCompass showZoom visualizePitch />
        <FlyToSelected marker={selected} bottomInset={bottomInset} />
        {popupMarker ? (
          <Popup
            longitude={popupMarker.longitude}
            latitude={popupMarker.latitude}
            anchor="bottom"
            offset={14}
            closeOnClick={false}
            onClose={() => setDismissedId(popupMarker.id)}
            maxWidth="240px"
          >
            <p className="font-medium">{popupMarker.title}</p>
            <p className="text-xs text-slate-500">{popupMarker.subtitle}</p>
            {popupMarker.isProposed ? <p className="mt-1 text-xs text-brand-600">Needs location review — not yet verified.</p> : null}
          </Popup>
        ) : null}
      </Map>
      <LayerSwitcher value={baseLayer} onChange={chooseBaseLayer} />
    </div>
  );
}
