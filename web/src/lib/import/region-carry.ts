import {
  isFieldHeaderLiteral,
  mapHeaderToField,
  mapRowColumns,
  type FloodAreaField,
} from "@/lib/google-sheets/mapper";
import { isKnownRegionLabel, normalizeRegion } from "@/lib/import/normalizer";

const LOCATION_FIELDS: FloodAreaField[] = [
  "city_municipality",
  "barangay",
  "road_name",
  "deo",
];

const HEADER_LITERAL_THRESHOLD = 2;

function mappedFields(headers: string[], raw: Record<string, string>) {
  return mapRowColumns(
    headers,
    headers.map((header) => raw[header] ?? ""),
  );
}

function loneNonEmptyValue(raw: Record<string, string>) {
  const values = Object.values(raw)
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length === 1 ? values[0] : null;
}

function headerLiteralCount(headers: string[], raw: Record<string, string>) {
  let count = 0;
  for (const header of headers) {
    const value = (raw[header] ?? "").trim();
    if (!value) continue;
    const field = mapHeaderToField(header);
    if (field && LOCATION_FIELDS.includes(field) && isFieldHeaderLiteral(field, value)) {
      count += 1;
    }
  }
  return count;
}

export function regionBannerValue(headers: string[], raw: Record<string, string>) {
  const mapped = mappedFields(headers, raw);
  const fromColumn = mapped.mapped.region?.trim() || "";
  const lone = loneNonEmptyValue(raw);
  const candidate = fromColumn || (lone && isKnownRegionLabel(lone) ? lone : "");
  if (!candidate || !isKnownRegionLabel(candidate)) return null;
  return normalizeRegion(candidate);
}

export function isRegionBannerRow(headers: string[], raw: Record<string, string>) {
  if (isRepeatedSectionHeaderRow(headers, raw)) return false;
  const lone = loneNonEmptyValue(raw);
  if (lone && isKnownRegionLabel(lone)) return true;

  const mapped = mappedFields(headers, raw);
  const hasLocation = LOCATION_FIELDS.some((field) => Boolean(mapped.mapped[field]));
  if (hasLocation) return false;
  return regionBannerValue(headers, raw) != null;
}

export function isRepeatedSectionHeaderRow(headers: string[], raw: Record<string, string>) {
  return headerLiteralCount(headers, raw) >= HEADER_LITERAL_THRESHOLD;
}

export function sectionHeaderRegion(headers: string[], raw: Record<string, string>) {
  const mapped = mappedFields(headers, raw);
  const fromColumn = mapped.mapped.region?.trim() || "";
  if (!fromColumn || !isKnownRegionLabel(fromColumn)) return null;
  return normalizeRegion(fromColumn);
}

export function isRegionSectionRow(headers: string[], raw: Record<string, string>) {
  return isRepeatedSectionHeaderRow(headers, raw) || isRegionBannerRow(headers, raw);
}

export function currentSectionRegion(headers: string[], raw: Record<string, string>) {
  return sectionHeaderRegion(headers, raw) ?? regionBannerValue(headers, raw);
}

export function withInheritedRegion(
  headers: string[],
  raw: Record<string, string>,
  inheritedRegion: string | null,
) {
  const mapped = mappedFields(headers, raw);
  const next = { ...mapped.mapped };
  if (!next.region && inheritedRegion) {
    next.region = inheritedRegion;
    return { mapped: next, inherited: true, unmappedHeaders: mapped.unmappedHeaders };
  }
  return { mapped: next, inherited: false, unmappedHeaders: mapped.unmappedHeaders };
}
