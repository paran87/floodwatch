"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { REPORT_SEVERITY_LABELS, REPORT_STATUS_LABELS } from "@/lib/constants";
import type { ReportFilters as ReportFiltersType } from "@/lib/types";

export function ReportFilters({ value, onChange }: { value: ReportFiltersType; onChange: (next: ReportFiltersType) => void }) {
  function set<K extends keyof ReportFiltersType>(key: K, next: ReportFiltersType[K]) {
    onChange({ ...value, [key]: next || undefined, page: 1 });
  }

  return (
    <div className="grid grid-cols-1 gap-2 rounded-xl border border-t-[3px] border-slate-200 border-t-navy-700 bg-white p-3 shadow-sm sm:grid-cols-3 sm:gap-3">
      <Input placeholder="Search by title…" value={value.search ?? ""} onChange={(e) => set("search", e.target.value)} />
      <Select value={value.status ?? ""} onChange={(e) => set("status", e.target.value as ReportFiltersType["status"])}>
        <option value="">All statuses</option>
        {Object.entries(REPORT_STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
      <Select value={value.severity ?? ""} onChange={(e) => set("severity", e.target.value as ReportFiltersType["severity"])}>
        <option value="">All severities</option>
        {Object.entries(REPORT_SEVERITY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
