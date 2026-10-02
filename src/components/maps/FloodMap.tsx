"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import type { FloodMapMarker } from "./types";
import type { LocationAccuracy } from "@/lib/types";

const PHILIPPINES_CENTER: [number, number] = [12.8797, 121.774];

/** How far to zoom in on a selected marker — the coarser the match, the wider the view. */
const ZOOM_BY_ACCURACY: Partial<Record<LocationAccuracy, number>> = {
  exact: 17,
  address: 16,
  road: 15,
  barangay: 14,
  municipality: 12,
  province: 9,
  region: 7,
};

function FlyToSelected({
  marker,
  markerRefs,
  bottomInset,
}: {
  marker: FloodMapMarker | undefined;
  markerRefs: React.RefObject<Map<number, LeafletCircleMarker>>;
  bottomInset: number;
}) {
  const map = useMap();
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
    if (id === undefined || latitude === undefined || longitude === undefined) return;
    const zoom = ZOOM_BY_ACCURACY[accuracy as LocationAccuracy] ?? 13;
    // Shift the target down by half the covered strip so the pin lands in the visible part of the map.
    const target = map.unproject(map.project([latitude, longitude], zoom).add([0, insetRef.current / 2]), zoom);
    map.flyTo(target, zoom, { duration: 0.8 });
    const timer = setTimeout(() => markerRefs.current.get(id)?.openPopup(), 850);
    return () => clearTimeout(timer);
  }, [map, id, latitude, longitude, accuracy, markerRefs]);
  return null;
}

/**
 * Reusable, provider-agnostic map. It only ever plots markers that already
 * carry real coordinates (see toMapMarker) — records without a resolved
 * location simply don't appear here; they stay visible in the data table
 * instead (see CLAUDE.md "Map Behavior").
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
  const markerRefs = useRef(new Map<number, LeafletCircleMarker>());
  const selected = selectedId == null ? undefined : markers.find((m) => m.id === selectedId);

  return (
    <MapContainer center={PHILIPPINES_CENTER} zoom={6} className="h-full w-full rounded-lg" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToSelected marker={selected} markerRefs={markerRefs} bottomInset={bottomInset} />
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          ref={(instance) => {
            if (instance) markerRefs.current.set(marker.id, instance);
            else markerRefs.current.delete(marker.id);
          }}
          center={[marker.latitude, marker.longitude]}
          radius={marker.id === selectedId ? 11 : 7}
          pathOptions={{
            color: marker.id === selectedId ? "#071a4a" : marker.isProposed ? "#e0560b" : "#1a4aa8",
            fillColor: marker.isProposed ? "#f26a1b" : "#4f86e8",
            fillOpacity: 0.8,
            weight: marker.id === selectedId ? 3 : 2,
          }}
        >
          <Popup>
            <p className="font-medium">{marker.title}</p>
            <p className="text-xs text-slate-500">{marker.subtitle}</p>
            {marker.isProposed ? <p className="mt-1 text-xs text-brand-600">Needs location review — not yet verified.</p> : null}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
