import { Badge } from "@/components/ui/Badge";
import { REPORT_SEVERITY_LABELS } from "@/lib/constants";
import type { ReportSeverity } from "@/lib/types";

const toneBySeverity: Record<ReportSeverity, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  moderate: "warning",
  severe: "warning",
  critical: "danger",
};

export function SeverityBadge({ severity }: { severity: ReportSeverity }) {
  return <Badge tone={toneBySeverity[severity]}>{REPORT_SEVERITY_LABELS[severity]}</Badge>;
}
