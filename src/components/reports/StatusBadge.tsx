import { Badge } from "@/components/ui/Badge";
import { REPORT_STATUS_LABELS } from "@/lib/constants";
import type { ReportStatus } from "@/lib/types";

const toneByStatus: Record<ReportStatus, "info" | "warning" | "success" | "neutral"> = {
  open: "info",
  investigating: "warning",
  resolved: "success",
  dismissed: "neutral",
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={toneByStatus[status]}>{REPORT_STATUS_LABELS[status]}</Badge>;
}
