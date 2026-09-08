"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { formatLength, hasCoordinates, latLngsFromGeometry, PH_BOUNDS, PH_CENTER, toCoord, validLatLng } from "@/lib/geo";
import { displayName, formatBarangay } from "@/lib/format";
import type { FloodProneArea, MapPickMode } from "@/lib/types";

function markerIcon(selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="flood-marker${selected ? " selected" : ""}"></div>`,
    iconSize: selected ? [22, 22] : [18, 18],
    iconAnchor: selected ? [11, 11] : [9, 9],
    popupAnchor: [0, -12],
  });
}

function MapEvents({
  pickMode,
  onMapClick,
}: {
  pickMode: MapPickMode;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      if (pickMode === "none") return;
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function flyToPair(map: L.Map, lat: unknown, lng: unknown, zoom: number, duration: number) {
  const pair = validLatLng(lat, lng);
  if (!pair) return false;
  try {
    map.flyTo(L.latLng(pair[0], pair[1]), zoom, { duration });
    return true;
  } catch {
    return false;
  }
}

function FlyToSelection({
  area,
  draftPoints,
  focusNonce,
}: {
  area: FloodProneArea | null;
  draftPoints: [number, number][];
  focusNonce: number;
}) {
  const map = useMap();

  useEffect(() => {
    const validDraft = draftPoints.filter((point) => validLatLng(point[0], point[1]));
    if (validDraft.length >= 2) {
      try {
        map.fitBounds(L.latLngBounds(validDraft), { padding: [48, 48], maxZoom: 17 });
      } catch {
        /* ignore malformed draft bounds */
      }
      return;
    }
    if (validDraft.length === 1) {
      flyToPair(map, validDraft[0][0], validDraft[0][1], 16, 0.8);
      return;
    }
    if (!area) return;
    const line = latLngsFromGeometry(area.geometry).filter((point) => validLatLng(point[0], point[1]));
    if (line.length >= 2) {
      try {
        map.fitBounds(L.latLngBounds(line), { padding: [56, 56], maxZoom: 17 });
      } catch {
        /* ignore malformed geometry bounds */
      }
      return;
    }
    if (line.length === 1) {
      flyToPair(map, line[0][0], line[0][1], 16, 0.85);
      return;
    }
    flyToPair(map, area.latitude, area.longitude, 16, 0.85);
  }, [
    area?.id,
    area?.latitude,
    area?.longitude,
    area?.geometry,
    draftPoints,
    focusNonce,
    map,
  ]);

  return null;
}

function SelectableMarker({
  area,
  selected,
  onSelect,
}: {
  area: FloodProneArea;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (selected) {
      markerRef.current?.openPopup();
    }
  }, [selected]);

  const lat = toCoord(area.latitude);
  const lng = toCoord(area.longitude);
  if (lat == null || lng == null) return null;

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={markerIcon(selected)}
      zIndexOffset={selected ? 500 : 0}
      eventHandlers={{ click: () => onSelect(area.id) }}
    >
      <Popup
        autoPan
        autoPanPadding={[24, 72]}
        maxWidth={220}
        minWidth={140}
        offset={[0, -4]}
      >
        <div className="max-w-[196px] space-y-0.5">
          <p className="display-title text-sm leading-tight">{displayName(area)}</p>
          <p className="text-[11px] leading-snug text-muted">
            {[formatBarangay(area.barangay), area.city_municipality, area.region]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {area.road_name && area.road_name !== displayName(area) ? (
            <p className="text-[11px] leading-snug">{area.road_name}</p>
          ) : null}
          <p className="text-[11px] text-muted">
            {area.flood_status} · {formatLength(area.road_length)}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

function ThemeTiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
  );
}

export function FloodMap({
  areas,
  selectedId,
  theme,
  pickMode,
  draftPoints,
  focusNonce = 0,
  onSelect,
  onMapClick,
}: {
  areas: FloodProneArea[];
  selectedId: string | null;
  theme: "dark" | "light";
  pickMode: MapPickMode;
  draftPoints: [number, number][];
  focusNonce?: number;
  onSelect: (id: string) => void;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const selected = areas.find((area) => area.id === selectedId) ?? null;
  const located = useMemo(
    () =>
      areas.filter(
        (area) =>
          hasCoordinates(area.latitude, area.longitude) ||
          latLngsFromGeometry(area.geometry).length > 0,
      ),
    [areas],
  );

  return (
    <MapContainer
      center={PH_CENTER}
      zoom={6}
      minZoom={5}
      maxBounds={PH_BOUNDS}
      maxBoundsViscosity={0.7}
      className={`h-full w-full ${theme === "dark" ? "leaflet-dark-tiles" : ""} ${pickMode !== "none" ? "cursor-crosshair" : ""}`}
      zoomControl
    >
      <ThemeTiles />
      <MapEvents pickMode={pickMode} onMapClick={onMapClick} />
      <FlyToSelection area={selected} draftPoints={draftPoints} focusNonce={focusNonce} />

      {located.map((area) => {
        const points = latLngsFromGeometry(area.geometry);
        if (points.length < 2) return null;
        const selectedLine = area.id === selectedId;
        return (
          <Polyline
            key={`line-${area.id}`}
            positions={points}
            pathOptions={{
              color: "#e11d48",
              weight: selectedLine ? 7 : 4,
              opacity: selectedLine ? 0.95 : 0.72,
              lineCap: "round",
              lineJoin: "round",
            }}
            eventHandlers={{ click: () => onSelect(area.id) }}
          />
        );
      })}

      {located.map((area) => (
        <SelectableMarker
          key={area.id}
          area={area}
          selected={area.id === selectedId}
          onSelect={onSelect}
        />
      ))}

      {draftPoints.length >= 2 ? (
        <Polyline
          positions={draftPoints}
          pathOptions={{ color: "#e11d48", weight: 6, dashArray: "8 8", opacity: 0.95 }}
        />
      ) : null}

      {draftPoints.map((point, index) => (
        <Marker key={`draft-${index}`} position={point} icon={markerIcon(index === draftPoints.length - 1)} />
      ))}
    </MapContainer>
  );
}
