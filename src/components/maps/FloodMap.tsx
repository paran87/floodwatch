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

function FlyToSelected({ marker, markerRefs }: { marker: FloodMapMarker | undefined; markerRefs: React.RefObject<Map<number, LeafletCircleMarker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!marker) return;
    map.flyTo([marker.latitude, marker.longitude], ZOOM_BY_ACCURACY[marker.accuracy] ?? 13, { duration: 0.8 });
    const timer = setTimeout(() => markerRefs.current.get(marker.id)?.openPopup(), 850);
    return () => clearTimeout(timer);
  }, [map, marker, markerRefs]);
  return null;
}

/**
 * Reusable, provider-agnostic map. It only ever plots markers that already
 * carry real coordinates (see toMapMarker) — records without a resolved
 * location simply don't appear here; they stay visible in the data table
 * instead (see CLAUDE.md "Map Behavior").
 */
export function FloodMap({ markers, selectedId }: { markers: FloodMapMarker[]; selectedId?: number | null }) {
  const markerRefs = useRef(new Map<number, LeafletCircleMarker>());
  const selected = selectedId == null ? undefined : markers.find((m) => m.id === selectedId);

  return (
    <MapContainer center={PHILIPPINES_CENTER} zoom={6} className="h-full w-full rounded-lg" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToSelected marker={selected} markerRefs={markerRefs} />
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
            color: marker.id === selectedId ? "#be123c" : marker.isProposed ? "#d97706" : "#0284c7",
            fillColor: marker.isProposed ? "#fbbf24" : "#38bdf8",
            fillOpacity: 0.8,
            weight: marker.id === selectedId ? 3 : 2,
          }}
        >
          <Popup>
            <p className="font-medium">{marker.title}</p>
            <p className="text-xs text-slate-500">{marker.subtitle}</p>
            {marker.isProposed ? <p className="mt-1 text-xs text-amber-600">Needs location review — not yet verified.</p> : null}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
