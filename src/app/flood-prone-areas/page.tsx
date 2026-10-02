"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { AreaFilters } from "@/components/flood-prone-areas/AreaFilters";
import { AreaTable } from "@/components/flood-prone-areas/AreaTable";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { BottomSheet, type SheetSnap } from "@/components/flood-prone-areas/BottomSheet";
import { useFloodProneAreas } from "@/hooks/useFloodProneAreas";
import { toMapMarker } from "@/components/maps/types";
import { MapUnavailable } from "@/components/maps/MapUnavailable";
import type { FloodProneArea, FloodProneAreaFilters } from "@/lib/types";

// Leaflet touches `window` at import time — never render it during SSR.
const FloodMap = dynamic(() => import("@/components/maps/FloodMap").then((m) => m.FloodMap), {
  ssr: false,
  loading: () => <LoadingState label="Loading map…" />,
});

type Facets = { regions: string[]; provinces: string[]; municipalities: string[]; barangays: string[]; deos: string[] };

// The API caps a single response at 2000 rows; the full dataset (~1,763) fits in one load, so there is no pagination.
const ALL_ROWS = 2000;

export default function FloodProneAreasPage() {
  const [filters, setFilters] = useState<FloodProneAreaFilters>({ pageSize: ALL_ROWS });
  const [facets, setFacets] = useState<Facets | null>(null);
  const { items: fetchedItems, total, loading, error } = useFloodProneAreas(filters);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  // Areas geocoded on demand after selection, layered over the fetched rows.
  const [located, setLocated] = useState<Record<number, FloodProneArea>>({});
  const [sheetHeight, setSheetHeight] = useState(0);
  const [snapRequest, setSnapRequest] = useState<{ snap: SheetSnap; nonce: number }>({ snap: "half", nonce: 0 });
  const items = useMemo(() => fetchedItems.map((item) => located[item.rowIndex] ?? item), [fetchedItems, located]);

  async function handleSelect(area: FloodProneArea) {
    setSelectedId(area.rowIndex);
    setLocateError(null);
    // On mobile, make sure the sheet isn't covering most of the map.
    setSnapRequest((r) => ({ snap: "half", nonce: r.nonce + 1 }));
    if (toMapMarker(located[area.rowIndex] ?? area)) return;

    setLocating(true);
    try {
      const res = await fetch(`/api/flood-prone-areas/${area.rowIndex}/locate`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setLocated((prev) => ({ ...prev, [area.rowIndex]: json.data }));
    } catch (err) {
      setLocateError(err instanceof Error ? err.message : "Could not locate this area.");
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    fetch("/api/flood-prone-areas/facets")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setFacets(json.data);
      })
      .catch(() => {
        /* facets are a progressive enhancement for filter dropdowns; failing silently is acceptable here */
      });
  }, []);

  const markers = useMemo(() => items.map(toMapMarker).filter((m): m is NonNullable<typeof m> => m !== null), [items]);
  const selectedMissing = selectedId !== null && !locating && !locateError && !markers.some((m) => m.id === selectedId);

  return (
    <AppShell title="Flood-Prone Areas" fill>
      <div className="flex h-full min-h-0 flex-col gap-2 md:gap-3">
        <AreaFilters value={filters} onChange={setFilters} facets={facets} />

        {/* Mobile: the map fills this region and stays put while the sheet slides over it. md+: map on top, list below. */}
        <div className="relative min-h-0 flex-1 md:flex md:flex-col md:gap-3">
          <div className="absolute inset-0 overflow-hidden rounded-lg border border-slate-200 md:static md:h-72 md:shrink-0">
            {markers.length > 0 ? (
              <FloodMap markers={markers} selectedId={selectedId} bottomInset={sheetHeight} />
            ) : (
              <div className="h-[55%] md:h-full">
                <MapUnavailable reason="Select a flood-prone area in the list to find it on the map." />
              </div>
            )}
            <div className="pointer-events-none absolute left-2 top-2 z-[1000] flex max-w-[80%] flex-col items-start gap-1 text-xs">
              {locating ? <p className="rounded-md bg-white/95 px-2.5 py-1 text-slate-600 shadow">Locating on map…</p> : null}
              {locateError ? <p className="rounded-md bg-white/95 px-2.5 py-1 text-red-600 shadow">{locateError}</p> : null}
              {selectedMissing ? (
                <p className="rounded-md bg-white/95 px-2.5 py-1 text-amber-700 shadow">No map location could be found for the selected area.</p>
              ) : null}
            </div>
          </div>

          <BottomSheet
            onHeightChange={setSheetHeight}
            snapRequest={snapRequest}
            title={
              loading
                ? "Loading…"
                : `${total.toLocaleString()} records${markers.length < items.length ? ` · ${markers.length.toLocaleString()} on map` : ""}`
            }
          >
            {loading ? <LoadingState label="Loading flood-prone areas…" /> : null}
            {error ? <ErrorState message={error} /> : null}
            {!loading && !error ? <AreaTable items={items} selectedId={selectedId} onSelect={handleSelect} /> : null}
          </BottomSheet>
        </div>
      </div>
    </AppShell>
  );
}
