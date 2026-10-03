import "server-only";
import { after } from "next/server";
import { getAllAreas } from "./areasCache";
import { getPendingLocationReviewCount, getReportStats } from "./api";
import { LOCATION_RESOLUTION_HIERARCHY } from "./constants";
import type { DashboardStats, LocationAccuracy, ReportSeverity } from "./types";

/**
 * Dashboard numbers, built from the SAME cached dataset snapshot the list page
 * uses (src/lib/areasCache.ts) instead of a separate Apps Script read — a full
 * sheet read + classification that cost seconds on every visit. Whichever
 * page loads first warms the snapshot for the other, and the sheet-derived
 * stats are then just a pass over ~1,763 rows in memory.
 *
 * Counts that live in Supabase (pending location reviews, unresolved
 * reports) are read in parallel with that, cached briefly, and refreshed in
 * the background once stale. If Supabase is unreachable they are `null`, not 0
 * (0 would wrongly claim "checked, none") and the sheet stats still load —
 * same rule as before.
 */

const FRESH_MS = 30 * 1000;
const STALE_MS = 10 * 60 * 1000;
const FAILED_RETRY_MS = 15 * 1000;

interface Counts {
  pendingLocationReviews: number | null;
  openReports: number | null;
  reportsBySeverity: Record<ReportSeverity, number>;
  at: number;
  ok: boolean;
}

const g = globalThis as unknown as { __dashboardCounts?: Counts; __dashboardCountsInflight?: Promise<Counts> };
const NO_SEVERITY: Record<ReportSeverity, number> = { low: 0, moderate: 0, severe: 0, critical: 0 };

async function loadCounts(): Promise<Counts> {
  const [pending, reports] = await Promise.allSettled([getPendingLocationReviewCount(), getReportStats()]);
  for (const result of [pending, reports]) {
    if (result.status === "rejected") console.warn("[dashboard] Supabase count unavailable:", result.reason instanceof Error ? result.reason.message : result.reason);
  }
  return {
    pendingLocationReviews: pending.status === "fulfilled" ? pending.value : null,
    openReports: reports.status === "fulfilled" ? reports.value.open : null,
    reportsBySeverity: reports.status === "fulfilled" ? reports.value.bySeverity : NO_SEVERITY,
    at: Date.now(),
    ok: pending.status === "fulfilled" && reports.status === "fulfilled",
  };
}

function refreshCounts(): Promise<Counts> {
  if (!g.__dashboardCountsInflight) {
    g.__dashboardCountsInflight = loadCounts()
      .then((counts) => (g.__dashboardCounts = counts))
      .finally(() => {
        g.__dashboardCountsInflight = undefined;
      });
  }
  return g.__dashboardCountsInflight;
}

async function getCounts(): Promise<Counts> {
  const current = g.__dashboardCounts;
  if (current) {
    const age = Date.now() - current.at;
    if (age < (current.ok ? FRESH_MS : FAILED_RETRY_MS)) return current;
    if (age < STALE_MS) {
      const run = () => refreshCounts().catch(() => undefined);
      try {
        after(run);
      } catch {
        void run();
      }
      return current;
    }
  }
  return refreshCounts();
}

function toSortedArray<K extends string>(map: Map<string, number>, key: K): Array<Record<K, string> & { count: number }> {
  return [...map.entries()].map(([name, count]) => ({ [key]: name, count }) as Record<K, string> & { count: number }).sort((a, b) => b.count - a.count);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [areas, counts] = await Promise.all([getAllAreas(), getCounts()]);

  const byRegion = new Map<string, number>();
  const byProvince = new Map<string, number>();
  const locationResolution = Object.fromEntries(LOCATION_RESOLUTION_HIERARCHY.map((tier) => [tier, 0])) as Record<LocationAccuracy, number>;

  for (const area of areas) {
    const region = area.region || "Unknown";
    const province = area.province || "Unknown";
    byRegion.set(region, (byRegion.get(region) ?? 0) + 1);
    byProvince.set(province, (byProvince.get(province) ?? 0) + 1);
    // Post-overlay accuracy, so these numbers match the badges in the list.
    locationResolution[area.location?.accuracy ?? "unresolved"]++;
  }

  return {
    totalFloodProneAreas: areas.length,
    byRegion: toSortedArray(byRegion, "region"),
    byProvince: toSortedArray(byProvince, "province"),
    locationResolution,
    openReports: counts.openReports,
    reportsBySeverity: counts.reportsBySeverity,
    pendingLocationReviews: counts.pendingLocationReviews,
  };
}
