import { Badge } from "@/components/ui/Badge";
import { LOCATION_ACCURACY_LABELS } from "@/lib/constants";
import type { LocationAccuracy } from "@/lib/types";

const toneByAccuracy: Record<LocationAccuracy, "success" | "info" | "warning" | "neutral"> = {
  exact: "success",
  address: "success",
  road: "info",
  barangay: "info",
  municipality: "warning",
  province: "warning",
  region: "warning",
  unresolved: "neutral",
};

export function LocationBadge({ accuracy }: { accuracy: LocationAccuracy }) {
  return <Badge tone={toneByAccuracy[accuracy]} className="px-1.5 text-[9px] md:px-2 md:text-[10px]">{LOCATION_ACCURACY_LABELS[accuracy]}</Badge>;
}
