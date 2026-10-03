"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { FloodProneAreaFilters } from "@/lib/types";

interface AreaFiltersProps {
  value: FloodProneAreaFilters;
  onChange: (next: FloodProneAreaFilters) => void;
  facets: { regions: string[]; provinces: string[]; municipalities: string[]; barangays: string[]; deos: string[] } | null;
}

export function AreaFilters({ value, onChange, facets }: AreaFiltersProps) {
  function set<K extends keyof FloodProneAreaFilters>(key: K, next: FloodProneAreaFilters[K]) {
    onChange({ ...value, [key]: next || undefined });
  }

  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-t-2 border-slate-200 border-t-navy-700 bg-white p-1 shadow-sm md:gap-2 md:rounded-xl md:border-t-[3px] md:p-2 lg:grid-cols-5">
      <Input
        placeholder="Search road, barangay, municipality…"
        value={value.search ?? ""}
        onChange={(e) => set("search", e.target.value)}
        className="col-span-3 px-1.5 py-1 text-[10px] md:px-2 md:py-1.5 md:text-xs lg:col-span-2"
      />
      <Select className="px-1.5 py-1 text-[10px] md:px-2 md:py-1.5 md:text-xs" value={value.region ?? ""} onChange={(e) => set("region", e.target.value)}>
        <option value="">All regions</option>
        {facets?.regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Select className="px-1.5 py-1 text-[10px] md:px-2 md:py-1.5 md:text-xs" value={value.province ?? ""} onChange={(e) => set("province", e.target.value)}>
        <option value="">All provinces</option>
        {facets?.provinces.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Select className="px-1.5 py-1 text-[10px] md:px-2 md:py-1.5 md:text-xs" value={value.municipalityCity ?? ""} onChange={(e) => set("municipalityCity", e.target.value)}>
        <option value="">All municipalities/cities</option>
        {facets?.municipalities.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
    </div>
  );
}
