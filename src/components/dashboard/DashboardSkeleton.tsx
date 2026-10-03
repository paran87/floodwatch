import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/** Same layout as the real dashboard, so nothing jumps when the numbers arrive. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-2 md:space-y-6" aria-busy="true" aria-label="Loading dashboard statistics">
      <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="border-t-brand-500">
            <CardBody className="px-2 py-1.5 md:px-4 md:py-3">
              <div className="h-2 w-2/3 animate-pulse rounded bg-navy-100 md:h-3" />
              <div className="mt-1.5 h-6 w-1/2 animate-pulse rounded bg-brand-100 md:mt-3 md:h-10" />
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 md:gap-6 lg:grid-cols-2">
        {[7, 8].map((rows) => (
          <Card key={rows}>
            <CardHeader>
              <div className="h-5 w-1/2 animate-pulse rounded bg-navy-100" />
            </CardHeader>
            <CardBody className="space-y-3">
              {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="h-3 animate-pulse rounded bg-navy-50" style={{ width: `${90 - i * 6}%` }} />
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
