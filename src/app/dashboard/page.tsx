"use client";

import { AppShell } from "@/components/layout/AppShell";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RegionBreakdown } from "@/components/dashboard/RegionBreakdown";
import { LocationResolutionBreakdown } from "@/components/dashboard/LocationResolutionBreakdown";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useDashboardStats } from "@/hooks/useDashboardStats";

export default function DashboardPage() {
  const { stats, loading, error } = useDashboardStats();

  return (
    <AppShell title="Dashboard">
      {loading ? <LoadingState label="Loading dashboard statistics…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {stats ? (
        <div className="space-y-6">
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
