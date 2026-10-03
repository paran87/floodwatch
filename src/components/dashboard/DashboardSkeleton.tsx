import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/** Same layout as the real dashboard, so nothing jumps when the numbers arrive. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard statistics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="border-t-brand-500">
            <CardBody>
              <div className="h-3 w-2/3 animate-pulse rounded bg-navy-100" />
              <div className="mt-3 h-10 w-1/2 animate-pulse rounded bg-brand-100" />
            </CardBody>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
