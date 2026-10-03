import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DashboardStats } from "@/lib/types";

export function RegionBreakdown({ stats }: { stats: DashboardStats }) {
  const max = Math.max(1, ...stats.byRegion.map((r) => r.count));

  return (
    <Card>
      <CardHeader className="px-2 py-1 md:px-4 md:py-3">
        <CardTitle className="text-xs md:text-lg">Flood-Prone Areas by Region</CardTitle>
      </CardHeader>
      <CardBody className="space-y-0.5 px-2 py-1 md:space-y-2 md:px-4 md:py-3">
        {stats.byRegion.map((row) => (
          <div key={row.region} className="flex items-center gap-2 text-[10px] md:gap-3 md:text-sm">
            <span className="w-20 shrink-0 truncate text-slate-600 md:w-28">{row.region}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-50 md:h-2">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right font-medium text-slate-900 md:w-10">{row.count}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
