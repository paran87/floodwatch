"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { AreaFilters } from "@/components/flood-prone-areas/AreaFilters";
import { AreaTable } from "@/components/flood-prone-areas/AreaTable";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/Button";
import { useFloodProneAreas } from "@/hooks/useFloodProneAreas";
import { toMapMarker } from "@/components/maps/types";
import { MapUnavailable } from "@/components/maps/MapUnavailable";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { FloodProneAreaFilters } from "@/lib/types";

// Leaflet touches `window` at import time — never render it during SSR.
const FloodMap = dynamic(() => import("@/components/maps/FloodMap").then((m) => m.FloodMap), {
  ssr: false,
  loading: () => <LoadingState label="Loading map…" />,
});

type Facets = { regions: string[]; provinces: string[]; municipalities: string[]; barangays: string[]; deos: string[] };

export default function FloodProneAreasPage() {
  const [filters, setFilters] = useState<FloodProneAreaFilters>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [facets, setFacets] = useState<Facets | null>(null);
  const { items, total, loading, error } = useFloodProneAreas(filters);

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

  const markers = items.map(toMapMarker).filter((m): m is NonNullable<typeof m> => m !== null);
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? DEFAULT_PAGE_SIZE)));

  return (
    <AppShell title="Flood-Prone Areas">
      <div className="space-y-4">
        <AreaFilters value={filters} onChange={setFilters} facets={facets} />

        <div className="h-80 overflow-hidden rounded-lg border border-slate-200">
          {markers.length > 0 ? (
            <FloodMap markers={markers} />
          ) : (
            <MapUnavailable reason="None of the records on this page have a resolved map location yet — most are waiting on geocoding, which hasn't been run on this dataset yet. They're still listed below." />
          )}
        </div>
        {markers.length > 0 && markers.length < items.length ? (
          <p className="text-xs text-slate-500">
            {items.length - markers.length} of {items.length} records on this page aren&apos;t shown on the map above — they&apos;re still listed below.
          </p>
        ) : null}

        {loading ? <LoadingState label="Loading flood-prone areas…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error ? (
          <>
            <AreaTable items={items} />
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {filters.page ?? 1} of {totalPages} — {total.toLocaleString()} records
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={(filters.page ?? 1) <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={(filters.page ?? 1) >= totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
