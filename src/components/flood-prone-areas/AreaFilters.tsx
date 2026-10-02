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
    onChange({ ...value, [key]: next || undefined, page: 1 });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input
        placeholder="Search road, barangay, municipality…"
        value={value.search ?? ""}
        onChange={(e) => set("search", e.target.value)}
        className="lg:col-span-2"
      />
      <Select value={value.region ?? ""} onChange={(e) => set("region", e.target.value)}>
        <option value="">All regions</option>
        {facets?.regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Select value={value.province ?? ""} onChange={(e) => set("province", e.target.value)}>
        <option value="">All provinces</option>
        {facets?.provinces.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Select value={value.municipalityCity ?? ""} onChange={(e) => set("municipalityCity", e.target.value)}>
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
