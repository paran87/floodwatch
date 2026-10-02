import Link from "next/link";
import { Table, Thead, Tbody, Th, Td } from "@/components/ui/Table";
import { StatusBadge } from "./StatusBadge";
import { SeverityBadge } from "./SeverityBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";
import type { FloodReport } from "@/lib/types";

export function ReportTable({ items }: { items: FloodReport[] }) {
  if (items.length === 0) {
    return <EmptyState title="No reports yet" description="Reports submitted by field users will show up here." />;
  }

  return (
    <Table>
      <Thead>
        <tr>
          <Th>Title</Th>
          <Th>Location</Th>
          <Th>Severity</Th>
          <Th>Status</Th>
          <Th>Reported</Th>
        </tr>
      </Thead>
      <Tbody>
        {items.map((report) => (
          <tr key={report.id} className="hover:bg-navy-50">
            <Td>
              <Link href={`/reports/${report.id}`} className="font-medium text-navy-700 hover:underline">
                {report.title}
              </Link>
            </Td>
            <Td>{[report.barangay, report.municipalityCity, report.province].filter(Boolean).join(", ") || "—"}</Td>
            <Td>
              <SeverityBadge severity={report.severity} />
            </Td>
            <Td>
              <StatusBadge status={report.status} />
            </Td>
            <Td>{formatDate(report.reportedAt)}</Td>
          </tr>
        ))}
      </Tbody>
    </Table>
  );
}
