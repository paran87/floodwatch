"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { FloodMapMarker } from "./types";

const PHILIPPINES_CENTER: [number, number] = [12.8797, 121.774];

/**
 * Reusable, provider-agnostic map. It only ever plots markers that already
 * carry real coordinates (see toMapMarker) — records without a resolved
 * location simply don't appear here; they stay visible in the data table
 * instead (see CLAUDE.md "Map Behavior").
 */
export function FloodMap({ markers }: { markers: FloodMapMarker[] }) {
  return (
    <MapContainer center={PHILIPPINES_CENTER} zoom={6} className="h-full w-full rounded-lg" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={[marker.latitude, marker.longitude]}
          radius={7}
          pathOptions={{
            color: marker.isProposed ? "#d97706" : "#0284c7",
            fillColor: marker.isProposed ? "#fbbf24" : "#38bdf8",
            fillOpacity: 0.8,
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
