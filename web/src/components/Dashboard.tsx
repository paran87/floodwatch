"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import {
  Activity,
  Clock3,
  LayoutList,
  Map as MapIcon,
  MapPinned,
  Moon,
  Plus,
  Route,
  Search,
  Sheet,
  Sun,
  Wallet,
} from "lucide-react";
import { Atmosphere } from "@/components/Atmosphere";
import { BrandMark } from "@/components/BrandMark";
import { FundingDrawer } from "@/components/FundingDrawer";
import { FloodMapDynamic } from "@/components/FloodMapDynamic";
import { LocationModal } from "@/components/LocationModal";
import { LocationTable } from "@/components/LocationTable";
import { displayName, formatBarangay, formatPeso, matchesQuery, relativeTime, statusTone } from "@/lib/format";
import {
  buildGeocodeQuery,
  formatLength,
  hasCoordinates,
  toCoord,
  lineStringFromLatLngs,
  pathLengthMeters,
} from "@/lib/geo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  EquipmentFundRequest,
  FloodProneArea,
  FloodProneAreaInput,
  MapPickMode,
} from "@/lib/types";

type Toast = { kind: "ok" | "err"; message: string } | null;
type MobilePane = "list" | "map";
type Theme = "dark" | "light";
type PanelTab = "areas" | "equipment" | "regions";

const emptyForm = (): FloodProneAreaInput => ({
  name: "",
  address: "",
  barangay: "",
  city_municipality: "",
  road_name: "",
  road_length: null,
  latitude: null,
  longitude: null,
  flood_status: "Flood-prone",
  description: "",
  geometry: null,
  region: "",
  deo: "",
  location_source: null,
});

function fromArea(area: FloodProneArea): FloodProneAreaInput {
  return {
    name: area.name ?? "",
    address: area.address ?? "",
    barangay: area.barangay ?? "",
    city_municipality: area.city_municipality,
    road_name: area.road_name ?? "",
    road_length: area.road_length,
    latitude: area.latitude,
    longitude: area.longitude,
    flood_status: area.flood_status,
    description: area.description ?? "",
    geometry: area.geometry,
    region: area.region ?? "",
    deo: area.deo ?? "",
    location_source: area.location_source,
  };
}

function clean(form: FloodProneAreaInput): FloodProneAreaInput {
  const trim = (value: string | null) => {
    const next = value?.trim() ?? "";
    return next ? next : null;
  };
  return {
    ...form,
    name: trim(form.name),
    address: trim(form.address),
    barangay: trim(form.barangay),
    city_municipality: form.city_municipality.trim(),
    road_name: trim(form.road_name),
    description: trim(form.description),
    region: trim(form.region),
    deo: trim(form.deo),
  };
}

export function Dashboard() {
  const [areas, setAreas] = useState<FloodProneArea[]>([]);
  const [funds, setFunds] = useState<EquipmentFundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [deoFilter, setDeoFilter] = useState("all");
  const [panelTab, setPanelTab] = useState<PanelTab>("areas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FloodProneAreaInput>(emptyForm);
  const [pickMode, setPickMode] = useState<MapPickMode>("none");
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [fundsOpen, setFundsOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [importing, setImporting] = useState(false);
  const [locatingId, setLocatingId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const locateSeq = useRef(0);
  const areasRef = useRef<FloodProneArea[]>([]);
  areasRef.current = areas;

  const showToast = useCallback((kind: "ok" | "err", message: string) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  const loadAreas = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: queryError } = await supabase
      .from("flood_prone_areas")
      .select("*")
      .order("updated_at", { ascending: false });
    if (queryError) throw queryError;
    setAreas((data ?? []) as FloodProneArea[]);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      await loadAreas();
      const { data, error: fundError } = await supabase
        .from("equipment_fund_requests")
        .select("*")
        .order("date_requested", { ascending: true });
      if (fundError && !/relation|schema cache/i.test(fundError.message)) {
        throw fundError;
      }
      setFunds((data as EquipmentFundRequest[]) ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load flood-prone areas.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [loadAreas]);

  useEffect(() => {
    const stored = window.localStorage.getItem("floodwatch-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.classList.toggle("light", stored === "light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!formOpen) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [formOpen]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("flood-prone-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flood_prone_areas" },
        () => {
          void loadAreas();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAreas]);

  const regions = useMemo(() => {
    return [...new Set(areas.map((area) => area.region).filter(Boolean) as string[])].sort();
  }, [areas]);

  const deos = useMemo(() => {
    return [
      ...new Set(
        areas
          .filter((area) => regionFilter === "all" || area.region === regionFilter)
          .map((area) => area.deo)
          .filter(Boolean) as string[],
      ),
    ].sort();
  }, [areas, regionFilter]);

  const filtered = useMemo(
    () =>
      areas.filter((area) => {
        if (regionFilter !== "all" && area.region !== regionFilter) return false;
        if (deoFilter !== "all" && area.deo !== deoFilter) return false;
        return matchesQuery(area, query);
      }),
    [areas, query, regionFilter, deoFilter],
  );

  const regionSummary = useMemo(() => {
    const groups = new Map<string, { count: number; deos: Set<string> }>();
    for (const area of areas) {
      const key = area.region || "Unspecified";
      const current = groups.get(key) ?? { count: 0, deos: new Set<string>() };
      current.count += 1;
      if (area.deo) current.deos.add(area.deo);
      groups.set(key, current);
    }
    return [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [areas]);

  const selected = areas.find((area) => area.id === selectedId) ?? null;
  const selectedIsMapped = Boolean(selected && hasCoordinates(selected.latitude, selected.longitude));
  const mapHint =
    pickMode === "pin"
      ? "Click the map to drop a pin."
      : pickMode === "draw"
        ? "Click along the road to add points."
        : locatingId && locatingId === selectedId
          ? "Finding this barangay on the map…"
          : selected && !selectedIsMapped
            ? "Could not match this place yet. Edit it to drop a pin."
            : selected
              ? null
              : "Click a row to focus the map.";
  const locatedCount = areas.filter(
    (area) => hasCoordinates(area.latitude, area.longitude) || area.geometry,
  ).length;
  const totalLength = areas.reduce((sum, area) => sum + (area.road_length ?? 0), 0);
  const byStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const area of areas) {
      counts.set(area.flood_status, (counts.get(area.flood_status) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [areas]);
  const recent = useMemo(() => areas.slice(0, 3), [areas]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    window.localStorage.setItem("floodwatch-theme", next);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDraftPoints([]);
    setPickMode("pin");
    setFormError(null);
    setFormOpen(true);
    setMobilePane("map");
  };

  const openEdit = (area: FloodProneArea, event?: MouseEvent) => {
    event?.stopPropagation();
    setEditingId(area.id);
    setForm(fromArea(area));
    const lat = toCoord(area.latitude);
    const lng = toCoord(area.longitude);
    setDraftPoints(lat != null && lng != null ? [[lat, lng]] : []);
    setPickMode("none");
    setFormError(null);
    setFormOpen(true);
    setSelectedId(area.id);
    setMobilePane("map");
    void locateArea(area);
  };

  const closeForm = () => {
    setFormOpen(false);
    setPickMode("none");
    setDraftPoints([]);
    setFormError(null);
  };

  const applyCoordinates = useCallback(
    async (
      area: FloodProneArea,
      latitude: number,
      longitude: number,
      source: string,
      persist: boolean,
    ) => {
      const lat = toCoord(latitude);
      const lng = toCoord(longitude);
      if (lat == null || lng == null) return;
      const geometry = { type: "Point" as const, coordinates: [lng, lat] as [number, number] };
      setAreas((current) =>
        current.map((item) =>
          item.id === area.id
            ? { ...item, latitude: lat, longitude: lng, geometry, location_source: source }
            : item,
        ),
      );
      if (formOpen && editingId === area.id) {
        setForm((current) => ({
          ...current,
          latitude: lat,
          longitude: lng,
          geometry,
          location_source: source,
        }));
        setDraftPoints([[lat, lng]]);
      }
      if (!persist) return;
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("flood_prone_areas")
        .update({
          latitude: lat,
          longitude: lng,
          geometry,
          location_source: source,
        })
        .eq("id", area.id);
      if (updateError) throw updateError;
    },
    [editingId, formOpen],
  );

  const locateArea = useCallback(
    async (area: FloodProneArea) => {
      if (hasCoordinates(area.latitude, area.longitude)) return;

      const seq = ++locateSeq.current;
      setLocatingId(area.id);
      try {
        const params = new URLSearchParams({
          road: area.road_name ?? "",
          barangay: area.barangay ?? "",
          city: area.city_municipality ?? "",
          address: area.address ?? "",
          region: area.region ?? "",
        });
        const response = await fetch(`/api/geocode?${params.toString()}`);
        const payload = await response.json();
        if (seq !== locateSeq.current) return;
        if (!response.ok) throw new Error(payload.error || "Geocode failed.");
        const first = payload.results?.[0];
        if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) {
          showToast("err", "Could not find this barangay or city on the map.");
          return;
        }
        await applyCoordinates(area, Number(first.latitude), Number(first.longitude), "geocoded", true);
      } catch (err) {
        if (seq !== locateSeq.current) return;
        showToast("err", err instanceof Error ? err.message : "Could not locate this place.");
      } finally {
        if (seq === locateSeq.current) setLocatingId(null);
      }
    },
    [applyCoordinates, showToast],
  );

  const selectArea = (id: string) => {
    setSelectedId(id);
    setFocusNonce((value) => value + 1);
    setMobilePane("map");
    const node = cardRefs.current[id];
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const area = areasRef.current.find((item) => item.id === id);
    if (area) void locateArea(area);
  };

  const patchForm = (patch: Partial<FloodProneAreaInput>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (pickMode === "pin") {
      setDraftPoints([[lat, lng]]);
      patchForm({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        geometry: { type: "Point", coordinates: [lng, lat] },
        location_source: "manual",
      });
      return;
    }
    if (pickMode === "draw") {
      const next = [...draftPoints, [lat, lng] as [number, number]];
      setDraftPoints(next);
      const geometry = lineStringFromLatLngs(next);
      const length = pathLengthMeters(next);
      patchForm({
        latitude: Number(next[0][0].toFixed(6)),
        longitude: Number(next[0][1].toFixed(6)),
        geometry,
        road_length: length > 0 ? Number(length.toFixed(1)) : form.road_length,
        location_source: "manual",
      });
    }
  };

  const handleGeocode = async () => {
    setGeocoding(true);
    setFormError(null);
    try {
      const q = buildGeocodeQuery(form);
      const params = new URLSearchParams({
        q: q,
        road: form.road_name ?? "",
        barangay: form.barangay ?? "",
        city: form.city_municipality ?? "",
        address: form.address ?? "",
        region: form.region ?? "",
      });
      const response = await fetch(`/api/geocode?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Geocode failed.");
      const first = payload.results?.[0];
      if (!first) throw new Error("No matching place was found. Try a more specific address.");
      patchForm({
        latitude: first.latitude,
        longitude: first.longitude,
        geometry: { type: "Point", coordinates: [first.longitude, first.latitude] },
        location_source: "geocoded",
      });
      setDraftPoints([[first.latitude, first.longitude]]);
      setMobilePane("map");
      showToast("ok", `Located via OpenStreetMap: ${first.label}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Geocode failed.");
    } finally {
      setGeocoding(false);
    }
  };

  const saveForm = async () => {
    const payload = clean(form);
    if (!payload.city_municipality) {
      setFormError("City / municipality is required.");
      return;
    }
    if (!payload.name && payload.road_name) payload.name = payload.road_name;
    setSaving(true);
    setFormError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (editingId) {
        const { error: updateError } = await supabase
          .from("flood_prone_areas")
          .update(payload)
          .eq("id", editingId);
        if (updateError) throw updateError;
        showToast("ok", "Location updated in Supabase.");
      } else {
        const { data, error: insertError } = await supabase
          .from("flood_prone_areas")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        setSelectedId(data.id);
        showToast("ok", "Location added to Supabase.");
      }
      closeForm();
      await loadAreas();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const copySchema = async () => {
    try {
      const response = await fetch("/api/setup/schema");
      const sql = await response.text();
      await navigator.clipboard.writeText(sql);
      showToast("ok", "Schema SQL copied. Paste it in the Supabase SQL editor.");
    } catch {
      showToast("err", "Could not copy the schema SQL.");
    }
  };

  const importSourceData = async () => {
    setImporting(true);
    try {
      const response = await fetch("/api/setup/import", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Import failed.");
      showToast("ok", `Imported ${payload.imported} locations. Total: ${payload.total}.`);
      await loadAll();
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const deleteArea = async (id: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: deleteError } = await supabase.from("flood_prone_areas").delete().eq("id", id);
      if (deleteError) throw deleteError;
      if (selectedId === id) setSelectedId(null);
      setConfirmId(null);
      showToast("ok", "Location removed.");
      await loadAreas();
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div className={`app-shell ${theme === "light" ? "light" : ""}`}>
      <Atmosphere />
      <div className="mx-auto flex h-dvh max-w-[1600px] flex-col px-3 py-2 md:px-5 md:py-3">
        <header className="hero-panel glass-panel mb-2 rounded-2xl px-3 py-2 md:mb-2 md:rounded-2xl md:px-4 md:py-2.5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <BrandMark />
              <div className="min-w-0">
                <p className="kicker">Floodwatch</p>
                <h1 className="display-title text-[1.35rem] italic leading-none md:text-2xl">
                  Flood Prone Areas
                </h1>
                <p className="lede mt-0.5 hidden truncate text-xs lg:block">
                  DPWH flood-prone barangays and national roads across the archipelago
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <Link href="/admin/google-import" className="btn btn-ghost px-2 py-1.5 text-xs md:text-sm">
                <Sheet className="h-4 w-4" />
                <span className="hidden lg:inline">Sheet import</span>
              </Link>
              <button
                className="btn btn-ghost px-2 py-1.5 text-xs md:text-sm"
                onClick={() => {
                  setPanelTab("equipment");
                  setMobilePane("list");
                  setFundsOpen(false);
                }}
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden lg:inline">Equipment funds</span>
              </button>
              <button
                className="btn btn-ghost px-2 py-1.5 text-xs md:text-sm"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="hidden lg:inline">{theme === "dark" ? "Light" : "Dark"}</span>
              </button>
              <button className="btn btn-primary px-2 py-1.5 text-xs md:text-sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">Add location</span>
                <span className="lg:hidden">Add</span>
              </button>
            </div>
            </div>

          <div className="flex items-baseline gap-3 overflow-x-auto text-xs text-muted lg:hidden">
            <p>
              <span className="display-title mr-1 text-xl italic text-[var(--ink)]">
                {loading ? "—" : areas.length}
              </span>
              locations
            </p>
            <p>{locatedCount} mapped</p>
            {byStatus[0] ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  statusTone(byStatus[0][0]) === "critical" || statusTone(byStatus[0][0]) === "flood"
                    ? "bg-[rgba(255,93,115,0.14)] text-[#fb7185]"
                    : "bg-[rgba(78,224,200,0.12)] text-teal"
                }`}
              >
                {byStatus[0][0]} {byStatus[0][1]}
              </span>
            ) : null}
          </div>

          <div className="hidden gap-2 lg:grid lg:grid-cols-4">
            <article className="stat-tile rounded-xl border border-[var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Locations</p>
                <span className="stat-icon">
                  <MapPinned className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="display-title text-2xl italic leading-none">
                {loading ? "—" : areas.length}
                <span className="ml-2 text-xs font-sans not-italic text-muted">{locatedCount} mapped</span>
              </p>
            </article>
            <article className="stat-tile rounded-xl border border-[var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Road length</p>
                <span className="stat-icon">
                  <Route className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="display-title text-2xl italic leading-none">{formatLength(totalLength)}</p>
            </article>
            <article className="stat-tile rounded-xl border border-[var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">By status</p>
                <span className="stat-icon">
                  <Activity className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {byStatus.length === 0 ? (
                  <span className="text-xs text-muted">No categories yet</span>
                ) : (
                  byStatus.slice(0, 2).map(([status, count]) => (
                    <span
                      key={status}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        statusTone(status) === "critical" || statusTone(status) === "flood"
                          ? "bg-[rgba(255,93,115,0.14)] text-[#fb7185]"
                          : "bg-[rgba(78,224,200,0.12)] text-teal"
                      }`}
                    >
                      {status} {count}
                    </span>
                  ))
                )}
              </div>
            </article>
            <article className="stat-tile rounded-xl border border-[var(--line)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Recently updated</p>
                <span className="stat-icon">
                  <Clock3 className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 truncate text-sm">
                {recent[0] ? (
                  <>
                    {displayName(recent[0])}
                    <span className="ml-2 text-xs text-muted" suppressHydrationWarning>
                      {relativeTime(recent[0].updated_at)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">No records yet</span>
                )}
              </p>
            </article>
          </div>
          </div>
        </header>

        <div className="mb-2 flex gap-2 md:hidden">
          <button
            className={`btn flex-1 px-2 py-1.5 text-xs ${mobilePane === "list" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMobilePane("list")}
          >
            <LayoutList className="h-4 w-4" />
            Areas
          </button>
          <button
            className={`btn flex-1 px-2 py-1.5 text-xs ${mobilePane === "map" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMobilePane("map")}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(640px,1.25fr)_minmax(360px,0.9fr)]">
          <section
            className={`glass-panel flex min-h-0 flex-col overflow-hidden rounded-[28px] ${
              mobilePane === "map" ? "hidden xl:flex" : "flex"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`panel-tab ${panelTab === "areas" ? "is-active" : ""}`}
                  onClick={() => setPanelTab("areas")}
                >
                  Flood Prone Areas
                </button>
                <button
                  type="button"
                  className={`panel-tab ${panelTab === "equipment" ? "is-active" : ""}`}
                  onClick={() => setPanelTab("equipment")}
                >
                  Equipment Requests
                </button>
                <button
                  type="button"
                  className={`panel-tab ${panelTab === "regions" ? "is-active" : ""}`}
                  onClick={() => setPanelTab("regions")}
                >
                  Regions Overview
                </button>
              </div>
              {panelTab === "areas" ? (
                <button className="btn btn-primary px-3 py-1.5 text-xs" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              ) : null}
            </div>

            {panelTab === "areas" ? (
              <>
                <div className="flex flex-col gap-2 border-b border-[var(--line)] px-4 py-3">
                  <div className="search-field">
                    <Search className="h-4 w-4 shrink-0 text-muted" />
                    <input
                      type="text"
                      placeholder="Search by location, road name..."
                      aria-label="Search flood-prone areas"
                      autoComplete="off"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="field sm:w-44"
                      value={regionFilter}
                      onChange={(event) => {
                        setRegionFilter(event.target.value);
                        setDeoFilter("all");
                      }}
                      aria-label="Filter by region"
                    >
                      <option value="all">All Regions</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                    <select
                      className="field sm:min-w-0 sm:flex-1"
                      value={deoFilter}
                      onChange={(event) => setDeoFilter(event.target.value)}
                      aria-label="Filter by DEO"
                    >
                      <option value="all">All DEO</option>
                      {deos.map((deo) => (
                        <option key={deo} value={deo}>
                          {deo}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="px-4 py-2 text-xs text-muted">
                  {filtered.length} shown · click a row to focus the map
                </p>
                <div ref={listRef} className="flex min-h-0 flex-1 flex-col">
                  {loading ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-10 animate-pulse rounded-lg bg-[rgba(255,255,255,0.04)]"
                        />
                      ))}
                    </div>
                  ) : error ? (
                    <div className="m-4 rounded-2xl border border-[rgba(225,29,72,0.3)] p-4 text-sm">
                      <p className="font-semibold text-[#fb7185]">Could not load Supabase data</p>
                      <p className="mt-1 text-muted">{error}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className="btn btn-ghost" onClick={() => void copySchema()}>
                          Copy schema SQL
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => void importSourceData()}
                          disabled={importing}
                        >
                          {importing ? "Importing..." : "Import spreadsheet"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => void loadAll()}>
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="m-4 rounded-2xl border border-dashed border-[var(--line)] p-6 text-sm text-muted">
                      No matching flood-prone areas.
                    </div>
                  ) : (
                    <LocationTable
                      areas={filtered}
                      selectedId={selectedId}
                      onSelect={selectArea}
                      onEdit={(area) => openEdit(area)}
                      onDelete={setConfirmId}
                      rowRefs={cardRefs}
                    />
                  )}
                </div>
              </>
            ) : null}

            {panelTab === "equipment" ? (
              <div className="min-h-0 flex-1 overflow-auto p-4 scrollbar-thin">
                {funds.length === 0 ? (
                  <p className="text-sm text-muted">No equipment fund requests imported yet.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Region</th>
                        <th>Date</th>
                        <th>Equipment</th>
                        <th>Qty</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funds.map((item) => (
                        <tr key={item.id}>
                          <td>{item.region || "—"}</td>
                          <td>{item.date_requested || "—"}</td>
                          <td>{item.equipment}</td>
                          <td>{item.quantity ?? "—"}</td>
                          <td>{formatPeso(item.request_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}

            {panelTab === "regions" ? (
              <div className="min-h-0 flex-1 overflow-auto p-4 scrollbar-thin">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Region</th>
                      <th>Locations</th>
                      <th>DEOs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionSummary.map(([region, info]) => (
                      <tr
                        key={region}
                        onClick={() => {
                          setPanelTab("areas");
                          setRegionFilter(region === "Unspecified" ? "all" : region);
                          setDeoFilter("all");
                        }}
                      >
                        <td>{region}</td>
                        <td>{info.count}</td>
                        <td>{info.deos.size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section
            className={`glass-panel relative min-h-[52vh] overflow-hidden rounded-[28px] md:min-h-0 ${
              mobilePane === "list" ? "hidden xl:block" : "block"
            }`}
          >
            <FloodMapDynamic
              areas={areas}
              selectedId={selectedId}
              theme={theme}
              pickMode={pickMode}
              draftPoints={draftPoints}
              focusNonce={focusNonce}
              onSelect={selectArea}
              onMapClick={handleMapClick}
            />
            <div className="map-caption">
              <p className="kicker text-[9px]">Live atlas</p>
              <p className="display-title mt-0.5 text-sm italic leading-tight">Philippine waters</p>
            </div>
            {mapHint ? (
              <div
                className={`pointer-events-none absolute bottom-8 left-3 z-[500] max-w-[220px] rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[11px] leading-snug shadow-[var(--shadow)] backdrop-blur-xl ${
                  locatingId === selectedId || (selected && !selectedIsMapped) ? "text-amber" : "text-muted"
                }`}
              >
                {mapHint}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {formOpen ? (
        <LocationModal
          title={editingId ? "Edit location" : "Add location"}
          form={form}
          pickMode={pickMode}
          saving={saving}
          error={formError}
          geocoding={geocoding}
          onChange={patchForm}
          onClose={closeForm}
          onSave={() => void saveForm()}
          onGeocode={() => void handleGeocode()}
          onPickMode={setPickMode}
          onClearGeometry={() => {
            setDraftPoints([]);
            patchForm({
              latitude: null,
              longitude: null,
              geometry: null,
              location_source: null,
            });
          }}
        />
      ) : null}

      <FundingDrawer open={fundsOpen} items={funds} onClose={() => setFundsOpen(false)} />

      {confirmId ? (
        <div className="overlay fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6">
            <h3 className="display-title text-2xl">Delete this location?</h3>
            <p className="mt-2 text-sm text-muted">
              This permanently removes the record from Supabase and the map.
            </p>
            <div className="mt-5 flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setConfirmId(null)}>
                Cancel
              </button>
              <button className="btn btn-danger flex-1" onClick={() => void deleteArea(confirmId)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`overlay fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-[var(--shadow)] ${
            toast.kind === "ok"
              ? "bg-[rgba(16,40,36,0.92)] text-[#86efac]"
              : "bg-[rgba(48,12,22,0.92)] text-[#fda4af]"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
