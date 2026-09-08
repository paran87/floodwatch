import type { FloodProneArea } from "@/lib/types";

export function displayName(area: Pick<FloodProneArea, "name" | "road_name" | "barangay" | "city_municipality">) {
  return area.name || area.road_name || area.barangay || area.city_municipality;
}

export function formatBarangay(barangay: string | null | undefined) {
  if (!barangay) return null;
  return /^(brgy\.?|barangay)\b/i.test(barangay) ? barangay : `Brgy. ${barangay}`;
}

export function relativeTime(value: string) {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 14) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function formatPeso(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes("high") || key.includes("critical")) return "critical";
  if (key.includes("moderate")) return "warn";
  if (key.includes("mitigat")) return "good";
  if (key.includes("monitor")) return "info";
  return "flood";
}

function foldSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchesQuery(area: FloodProneArea, query: string) {
  const tokens = foldSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = foldSearchText(
    [
      area.name,
      area.address,
      area.barangay,
      formatBarangay(area.barangay),
      area.city_municipality,
      area.road_name,
      area.region,
      area.deo,
      area.flood_status,
      area.flood_status.toLowerCase() === "flood-prone" ? "critical" : "",
      area.description,
      displayName(area),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return tokens.every((token) => haystack.includes(token));
}
