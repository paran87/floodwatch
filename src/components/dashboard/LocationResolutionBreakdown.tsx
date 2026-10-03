import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { LOCATION_ACCURACY_LABELS, LOCATION_RESOLUTION_HIERARCHY } from "@/lib/constants";
import type { DashboardStats } from "@/lib/types";

export function LocationResolutionBreakdown({ stats }: { stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader className="px-2 py-1 md:px-4 md:py-3">
        <CardTitle className="text-xs md:text-lg">Location Resolution</CardTitle>
      </CardHeader>
      <CardBody className="px-2 py-0.5 md:px-4 md:py-3">
        <ul className="divide-y divide-slate-100">
          {LOCATION_RESOLUTION_HIERARCHY.map((tier) => (
            <li key={tier} className="flex items-center justify-between py-0.5 text-[10px] md:py-2 md:text-sm">
              <span className="text-slate-600">{LOCATION_ACCURACY_LABELS[tier]}</span>
              <span className="font-display text-sm font-bold text-navy-900 md:text-lg">{(stats.locationResolution[tier] ?? 0).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
