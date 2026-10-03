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
    <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-t-brand-500">
          <CardBody className="px-2 py-1.5 md:px-4 md:py-3">
            <p className="font-mono text-[8px] font-medium uppercase leading-tight tracking-wider md:leading-normal text-navy-700 md:text-[11px]">{card.label}</p>
            <p className="mt-0.5 font-display text-2xl font-bold leading-none text-brand-500 md:mt-1 md:text-5xl">{card.value === null ? "—" : card.value.toLocaleString()}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
