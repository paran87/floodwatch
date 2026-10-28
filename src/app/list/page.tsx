"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useFloodProneAreas } from "@/hooks/useFloodProneAreas";
import type { FloodProneArea } from "@/lib/types";

const COLUMNS: Array<{ label: string; cell: (a: FloodProneArea) => string }> = [
  { label: "Region", cell: (a) => a.region },
  { label: "Province", cell: (a) => a.province },
  { label: "Municipality/City", cell: (a) => a.municipalityCity },
  { label: "DEO", cell: (a) => a.deo },
  { label: "Barangay", cell: (a) => a.barangay },
  { label: "Road Name/Waterways", cell: (a) => a.roadNameWaterways },
  { label: "KM Station Limit", cell: (a) => a.kmStationLimit },
  { label: "Latitude", cell: (a) => (a.latitude ?? a.location?.latitude)?.toString() ?? "" },
  { label: "Longitude", cell: (a) => (a.longitude ?? a.location?.longitude)?.toString() ?? "" },
];

function searchText(a: FloodProneArea): string {
  return COLUMNS.map((c) => c.cell(a)).join("\u0001").toLowerCase();
}

/** Spreadsheet-style list: every record in one continuous, scrolling grid — no pagination. */
export default function ListPage() {
  const { items, loading, updating, error, reload } = useFloodProneAreas();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  const indexed = useMemo(() => items.map((area) => ({ area, text: searchText(area) })), [items]);
  const rows = useMemo(() => {
    const terms = deferred.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return indexed;
    return indexed.filter((r) => terms.every((t) => r.text.includes(t)));
  }, [indexed, deferred]);

  return (
    <AppShell title="List" fill>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search province, municipality, barangay, road…"
              aria-label="Search flood-prone areas"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {rows.length.toLocaleString()} of {items.length.toLocaleString()} records{updating ? " · updating…" : ""}
          </p>
        </div>

        {loading ? <LoadingState label="Loading flood-prone areas…" /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {!loading && !error ? (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-300 bg-white">
            <table className="w-max border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 w-12 border border-slate-300 bg-slate-100 px-2 py-1.5 text-right font-semibold text-slate-500">#</th>
                  {COLUMNS.map((c) => (
                    <th key={c.label} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-2 py-1.5 font-semibold text-navy-900">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ area }) => (
                  <tr key={area.rowIndex} className="odd:bg-white even:bg-slate-50/60 hover:bg-navy-50">
                    <td className="sticky left-0 border border-slate-200 bg-slate-100 px-2 py-1 text-right tabular-nums text-slate-500">{area.rowIndex}</td>
                    {COLUMNS.map((c) => (
                      <td key={c.label} className="max-w-[22rem] border border-slate-200 px-2 py-1 text-slate-800">
                        {c.cell(area)}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="px-3 py-8 text-center text-sm text-slate-500">
                      No records match “{deferred}”.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
