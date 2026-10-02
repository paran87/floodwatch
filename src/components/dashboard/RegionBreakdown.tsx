import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DashboardStats } from "@/lib/types";

export function RegionBreakdown({ stats }: { stats: DashboardStats }) {
  const max = Math.max(1, ...stats.byRegion.map((r) => r.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flood-Prone Areas by Region</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        {stats.byRegion.map((row) => (
          <div key={row.region} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-slate-600">{row.region}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-slate-900">{row.count}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
