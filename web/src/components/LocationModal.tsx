"use client";

import type { ChangeEvent } from "react";
import { MapPin, Route, Sparkles, Trash2, X } from "lucide-react";
import { formatLength } from "@/lib/geo";
import { FLOOD_STATUSES, type FloodProneAreaInput, type MapPickMode } from "@/lib/types";

type FormState = FloodProneAreaInput;

export function LocationModal({
  title,
  form,
  pickMode,
  saving,
  error,
  onChange,
  onClose,
  onSave,
  onGeocode,
  onPickMode,
  onClearGeometry,
  geocoding,
}: {
  title: string;
  form: FormState;
  pickMode: MapPickMode;
  saving: boolean;
  error: string | null;
  geocoding: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onClose: () => void;
  onSave: () => void;
  onGeocode: () => void;
  onPickMode: (mode: MapPickMode) => void;
  onClearGeometry: () => void;
}) {
  const set =
    (key: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      if (key === "road_length" || key === "latitude" || key === "longitude") {
        onChange({ [key]: value === "" ? null : Number(value) } as Partial<FormState>);
        return;
      }
      onChange({ [key]: value } as Partial<FormState>);
    };

  return (
    <div className="overlay pointer-events-none fixed inset-0 z-[2000] flex items-end justify-center md:items-start md:justify-start md:p-4">
      <div className="pointer-events-auto flex max-h-[min(88dvh,44rem)] w-full max-w-xl flex-col rounded-t-3xl border border-[var(--line)] bg-[var(--panel-solid)] shadow-[var(--shadow)] md:mt-0 md:max-h-[calc(100dvh-2rem)] md:max-w-[420px] md:rounded-3xl">
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">Record</p>
            <h2 className="display-title mt-1 text-2xl">{title}</h2>
          </div>
          <button className="btn btn-ghost px-3" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-5 scrollbar-thin">
          <label className="block text-xs text-muted">
            Location / place name
            <input className="field mt-1" value={form.name ?? ""} onChange={set("name")} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              Barangay
              <input className="field mt-1" value={form.barangay ?? ""} onChange={set("barangay")} />
            </label>
            <label className="block text-xs text-muted">
              City / municipality
              <input
                className="field mt-1"
                value={form.city_municipality}
                onChange={set("city_municipality")}
                required
              />
            </label>
          </div>
          <label className="block text-xs text-muted">
            Address
            <input className="field mt-1" value={form.address ?? ""} onChange={set("address")} />
          </label>
          <label className="block text-xs text-muted">
            Street / road name
            <input className="field mt-1" value={form.road_name ?? ""} onChange={set("road_name")} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              Road length (m)
              <input
                className="field mt-1"
                type="number"
                min="0"
                step="0.1"
                value={form.road_length ?? ""}
                onChange={set("road_length")}
              />
            </label>
            <label className="block text-xs text-muted">
              Flood status
              <select className="field mt-1" value={form.flood_status} onChange={set("flood_status")}>
                {FLOOD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              Latitude
              <input
                className="field mt-1"
                type="number"
                step="any"
                value={form.latitude ?? ""}
                onChange={set("latitude")}
              />
            </label>
            <label className="block text-xs text-muted">
              Longitude
              <input
                className="field mt-1"
                type="number"
                step="any"
                value={form.longitude ?? ""}
                onChange={set("longitude")}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              Region
              <input className="field mt-1" value={form.region ?? ""} onChange={set("region")} />
            </label>
            <label className="block text-xs text-muted">
              DEO
              <input className="field mt-1" value={form.deo ?? ""} onChange={set("deo")} />
            </label>
          </div>
          <label className="block text-xs text-muted">
            Notes / description
            <textarea
              className="field mt-1 min-h-20"
              value={form.description ?? ""}
              onChange={set("description")}
            />
          </label>

          <div className="rounded-2xl border border-[var(--line)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Map location
            </p>
            <p className="mt-1 text-sm text-muted">
              Coordinates were not invented from the source file. Place a pin or
              trace the flood-prone road on the map, or geocode the address.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={`btn ${pickMode === "pin" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => onPickMode(pickMode === "pin" ? "none" : "pin")}
                type="button"
              >
                <MapPin className="h-4 w-4" />
                Drop pin
              </button>
              <button
                className={`btn ${pickMode === "draw" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => onPickMode(pickMode === "draw" ? "none" : "draw")}
                type="button"
              >
                <Route className="h-4 w-4" />
                Draw road
              </button>
              <button className="btn btn-ghost" onClick={onGeocode} type="button" disabled={geocoding}>
                <Sparkles className="h-4 w-4" />
                {geocoding ? "Locating..." : "Geocode"}
              </button>
              <button className="btn btn-ghost" onClick={onClearGeometry} type="button">
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Drawn length: {formatLength(form.road_length)} · Source:{" "}
              {form.location_source || "unset"}
            </p>
          </div>

          {error ? (
            <p className="rounded-xl bg-[rgba(225,29,72,0.12)] px-3 py-2 text-sm text-[#fb7185]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-[var(--line)] px-5 py-4">
          <button className="btn btn-ghost flex-1" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary flex-1" onClick={onSave} disabled={saving} type="button">
            {saving ? "Saving..." : "Save to Supabase"}
          </button>
        </div>
      </div>
    </div>
  );
}
