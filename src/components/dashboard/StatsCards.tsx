import { Card, CardBody } from "@/components/ui/Card";
import type { DashboardStats } from "@/lib/types";

export function StatsCards({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Flood-Prone Areas", value: stats.totalFloodProneAreas },
    { label: "Open Reports", value: stats.openReports },
    { label: "Pending Location Reviews", value: stats.pendingLocationReviews },
    { label: "Regions Covered", value: stats.byRegion.length },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value.toLocaleString()}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
