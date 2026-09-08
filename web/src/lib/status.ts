import { statusTone } from "@/lib/format";

export function statusLabel(status: string) {
  const key = status.toLowerCase();
  if (key.includes("high") || key.includes("critical") || key === "flood-prone") return "Critical";
  if (key.includes("moderate")) return "Moderate";
  if (key.includes("mitigat") || key.includes("low")) return "Low";
  if (key.includes("monitor")) return "Low";
  return status;
}

export function statusPillClass(status: string) {
  const tone = statusTone(status);
  if (tone === "critical" || tone === "flood") {
    return "status-pill status-pill-critical";
  }
  if (tone === "warn") {
    return "status-pill status-pill-moderate";
  }
  return "status-pill status-pill-low";
}
