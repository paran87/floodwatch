import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { LOCATION_ACCURACY_LABELS, LOCATION_RESOLUTION_HIERARCHY } from "@/lib/constants";
import type { DashboardStats } from "@/lib/types";

export function LocationResolutionBreakdown({ stats }: { stats: DashboardStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Location Resolution</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-slate-100">
          {LOCATION_RESOLUTION_HIERARCHY.map((tier) => (
            <li key={tier} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-600">{LOCATION_ACCURACY_LABELS[tier]}</span>
              <span className="font-display text-lg font-bold text-navy-900">{(stats.locationResolution[tier] ?? 0).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
