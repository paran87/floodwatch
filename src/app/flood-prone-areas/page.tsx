"use client";

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { AreaFilters } from "@/components/flood-prone-areas/AreaFilters";
import { AreaTable, AreaTableSkeleton } from "@/components/flood-prone-areas/AreaTable";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExportButtons } from "@/components/flood-prone-areas/ExportButtons";
import { BottomSheet, type SheetSnap } from "@/components/flood-prone-areas/BottomSheet";
import { useFloodProneAreas } from "@/hooks/useFloodProneAreas";
import { toMapMarker } from "@/components/maps/types";
import { computeFacets, filterAreas } from "@/lib/areaFilter";
import { approximateFromNeighbours } from "@/lib/approximateLocation";
import type { FloodProneArea, FloodProneAreaFilters } from "@/lib/types";

// The map library needs WebGL and `window` — never render it during SSR.
const FloodMap = dynamic(() => import("@/components/maps/FloodMap").then((m) => m.FloodMap), {
  ssr: false,
  loading: () => <LoadingState label="Loading map…" />,
});

export default function FloodProneAreasPage() {
  const [filters, setFilters] = useState<FloodProneAreaFilters>({});
  const { items: allItems, loading, updating, error, reload } = useFloodProneAreas();
  // Filtering is local; deferring the filters keeps typing responsive while the list catches up.
  const deferredFilters = useDeferredValue(filters);
  const fetchedItems = useMemo(() => filterAreas(allItems, deferredFilters), [allItems, deferredFilters]);
  const total = fetchedItems.length;
  const facets = useMemo(() => (allItems.length > 0 ? computeFacets(allItems) : null), [allItems]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  // Areas geocoded on demand after selection, layered over the fetched rows.
  const [located, setLocated] = useState<Record<number, FloodProneArea>>({});
  const [sheetHeight, setSheetHeight] = useState(0);
  const [snapRequest, setSnapRequest] = useState<{ snap: SheetSnap; nonce: number }>({ snap: "half", nonce: 0 });
  const items = useMemo(() => fetchedItems.map((item) => located[item.rowIndex] ?? item), [fetchedItems, located]);

  // The precise lookup can take a moment. Meanwhile a temporary, clearly-labelled pin from already-located neighbours is shown.
  const [approx, setApprox] = useState<{ rowIndex: number; latitude: number; longitude: number; basis: "municipality" | "province"; title: string; subtitle: string } | null>(null);
  const locateAbort = useRef<AbortController | null>(null);

  const handleSelect = useCallback(
    async (area: FloodProneArea) => {
      setSelectedId(area.rowIndex);
      setLocateError(null);
      // On mobile, make sure the sheet isn't covering most of the map.
      setSnapRequest((r) => ({ snap: "half", nonce: r.nonce + 1 }));

      // Picking another row abandons the previous lookup, so the server doesn't queue this one behind it.
      locateAbort.current?.abort();
      if (toMapMarker(located[area.rowIndex] ?? area)) {
        setApprox(null);
        setLocating(false);
        return;
      }

      const near = approximateFromNeighbours(area, allItems);
      setApprox(
        near
          ? {
              rowIndex: area.rowIndex,
              ...near,
              title: area.roadNameWaterways || area.barangay,
              subtitle: [area.barangay, area.municipalityCity, area.province].filter(Boolean).join(", "),
            }
          : null,
      );

      const controller = new AbortController();
      locateAbort.current = controller;
      setLocating(true);
      try {
        const res = await fetch(`/api/flood-prone-areas/${area.rowIndex}/locate`, { method: "POST", signal: controller.signal });
        if (res.status === 204) return; // the server saw us move on
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setLocated((prev) => ({ ...prev, [area.rowIndex]: json.data }));
        setApprox(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setApprox(null);
        setLocateError(err instanceof Error ? err.message : "Could not locate this area.");
      } finally {
        if (locateAbort.current === controller) setLocating(false);
      }
    },
    [located, allItems],
  );

  const markers = useMemo(() => {
    const real = items.map(toMapMarker).filter((m): m is NonNullable<typeof m> => m !== null);
    if (!approx || approx.rowIndex !== selectedId || real.some((m) => m.id === approx.rowIndex)) return real;
    return [
      ...real,
      {
        id: approx.rowIndex,
        latitude: approx.latitude,
        longitude: approx.longitude,
        accuracy: approx.basis,
        isProposed: true,
        title: approx.title,
        subtitle: `${approx.subtitle} — approximate, locating precisely…`,
      },
    ];
  }, [items, approx, selectedId]);
  const filterSummary = useMemo(
    () =>
      [
        filters.search ? `Search: “${filters.search}”` : "",
        filters.region ? `Region: ${filters.region}` : "",
        filters.province ? `Province: ${filters.province}` : "",
        filters.municipalityCity ? `Municipality/City: ${filters.municipalityCity}` : "",
      ].filter(Boolean),
    [filters],
  );
  const selectedMissing = selectedId !== null && !locating && !locateError && !markers.some((m) => m.id === selectedId);

  return (
    <AppShell title="Flood-Prone Areas" fill>
      <div className="flex h-full min-h-0 flex-col gap-2 md:gap-3">
        <AreaFilters value={filters} onChange={setFilters} facets={facets} />

        {/* Mobile: the map fills this region and stays put while the sheet slides over it. md+: two panels, list on the left and map on the right. */}
        <div className="relative min-h-0 flex-1 md:flex md:flex-row md:gap-4">
          <div className="absolute inset-0 overflow-hidden rounded-xl border border-t-[3px] border-slate-200 border-t-brand-500 md:relative md:order-2 md:h-auto md:min-w-0 md:flex-1">
            {/* Always mounted so the map code and base tiles load in parallel with the data, not after it. */}
            <FloodMap markers={markers} selectedId={selectedId} bottomInset={sheetHeight} />
            <div className="pointer-events-none absolute left-14 top-2 z-[1000] flex max-w-[80%] flex-col items-start gap-1 text-xs">
              {!loading && !error && markers.length === 0 ? (
                <p className="rounded-md bg-white/95 px-2.5 py-1 text-slate-600 shadow">No area here is located yet — pick one in the list to find it on the map.</p>
              ) : null}
              {locating ? <p className="rounded-md bg-white/95 px-2.5 py-1 text-slate-600 shadow">{approx ? "Locating precisely…" : "Locating on map…"}</p> : null}
              {locateError ? <p className="rounded-md bg-white/95 px-2.5 py-1 text-red-600 shadow">{locateError}</p> : null}
              {selectedMissing ? (
                <p className="rounded-md bg-white/95 px-2.5 py-1 text-brand-600 shadow">No map location could be found for the selected area.</p>
              ) : null}
            </div>
            <ul className="pointer-events-none absolute bottom-3 left-3 z-[1000] hidden items-center gap-3 rounded-lg bg-white/95 px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider text-navy-800 shadow md:flex" aria-label="Map legend">
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-navy-700 bg-[#4f86e8]" aria-hidden /> Located
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-brand-600 bg-brand-500" aria-hidden /> Needs review
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-[3px] border-navy-950 bg-brand-500" aria-hidden /> Selected
              </li>
            </ul>
          </div>

          <BottomSheet
            actions={<ExportButtons items={items} filterSummary={filterSummary} disabled={loading || Boolean(error)} />}
            onHeightChange={setSheetHeight}
            snapRequest={snapRequest}
            title={
              loading
                ? "Loading…"
                : `${total.toLocaleString()} records${markers.length < items.length ? ` · ${markers.length.toLocaleString()} on map` : ""}${updating ? " · updating…" : ""}`
            }
          >
            {loading ? <AreaTableSkeleton /> : null}
            {error ? <ErrorState message={error} onRetry={reload} /> : null}
            {!loading && !error ? <AreaTable items={items} selectedId={selectedId} onSelect={handleSelect} resetKey={JSON.stringify(deferredFilters)} /> : null}
          </BottomSheet>
        </div>
      </div>
    </AppShell>
  );
}
