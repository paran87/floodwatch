"use client";

import { AppShell } from "@/components/layout/AppShell";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RegionBreakdown } from "@/components/dashboard/RegionBreakdown";
import { LocationResolutionBreakdown } from "@/components/dashboard/LocationResolutionBreakdown";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useDashboardStats } from "@/hooks/useDashboardStats";

export default function DashboardPage() {
  const { stats, loading, updating, error } = useDashboardStats();

  return (
    <AppShell title="Dashboard">
      {loading ? <DashboardSkeleton /> : null}
      {error ? <ErrorState message={error} /> : null}
      {stats ? (
        <div className="space-y-6">
          {updating ? (
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-navy-700" role="status">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-navy-100 border-t-brand-500" aria-hidden />
              Updating…
            </p>
          ) : null}
          <StatsCards stats={stats} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RegionBreakdown stats={stats} />
            <LocationResolutionBreakdown stats={stats} />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
