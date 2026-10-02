"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportTable } from "@/components/reports/ReportTable";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useReports } from "@/hooks/useReports";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { ReportFilters as ReportFiltersType } from "@/lib/types";

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFiltersType>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const { items, total, loading, error } = useReports(filters);

  return (
    <AppShell title="Reports">
      <div className="space-y-4">
        <ReportFilters value={filters} onChange={setFilters} />
        {loading ? <LoadingState label="Loading reports…" /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error ? (
          <>
            <ReportTable items={items} />
            <p className="text-sm text-slate-500">{total.toLocaleString()} total reports</p>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
