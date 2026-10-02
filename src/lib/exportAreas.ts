import { LOCATION_ACCURACY_LABELS } from "./constants";
import type { FloodProneArea } from "./types";

/**
 * Client-side export of the flood-prone-areas list to CSV and PDF. Works from
 * the rows already on screen, so whatever filters are applied are what get
 * exported. Coordinates come only from the geocoding cache / review queue —
 * nothing is invented — and each row says how far to trust them.
 */

const COLUMNS = [
  "Region",
  "Province",
  "Municipality/City",
  "Barangay",
  "Road Name/Waterways",
  "KM Station Limit",
  "DEO",
  "Latitude",
  "Longitude",
  "Location accuracy",
  "Location status",
] as const;

function coordinates(area: FloodProneArea): { lat: number | null; lng: number | null; status: string } {
  const loc = area.location;
  if (loc?.latitude != null && loc.longitude != null) return { lat: loc.latitude, lng: loc.longitude, status: "Located" };
  if (loc?.proposedLatitude != null && loc.proposedLongitude != null) {
    return { lat: loc.proposedLatitude, lng: loc.proposedLongitude, status: "Approximate (needs review)" };
  }
  return { lat: null, lng: null, status: "Not located yet" };
}

const formatCoord = (n: number | null) => (n === null ? "" : n.toFixed(6));

/** One export row per area, as strings, in COLUMNS order. */
export function areaToRow(area: FloodProneArea): string[] {
  const { lat, lng, status } = coordinates(area);
  return [
    area.region,
    area.province,
    area.municipalityCity,
    area.barangay,
    area.roadNameWaterways,
    area.kmStationLimit,
    area.deo,
    formatCoord(lat),
    formatCoord(lng),
    area.location ? LOCATION_ACCURACY_LABELS[area.location.accuracy] : "",
    status,
  ];
}

/** RFC 4180 quoting, plus a leading apostrophe on text that a spreadsheet would run as a formula. */
function csvCell(value: string, isText: boolean): string {
  const safe = isText && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function areasToCsv(items: FloodProneArea[]): string {
  const numericColumns = new Set([7, 8]); // latitude / longitude: negatives are numbers, not formulas
  const lines = [COLUMNS.map((c) => csvCell(c, false)).join(",")];
  for (const area of items) {
    lines.push(areaToRow(area).map((cell, i) => csvCell(cell, !numericColumns.has(i))).join(","));
  }
  return lines.join("\r\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const today = () => new Date().toISOString().slice(0, 10);

export function downloadAreasCsv(items: FloodProneArea[]) {
  // BOM so Excel reads the file as UTF-8 (Filipino place names keep their ñ).
  download(new Blob(["﻿", areasToCsv(items)], { type: "text/csv;charset=utf-8" }), `flood-prone-areas-${today()}.csv`);
}

const NAVY: [number, number, number] = [11, 42, 107];
const ORANGE: [number, number, number] = [242, 106, 27];
const ZEBRA: [number, number, number] = [238, 243, 252];

/** `filterSummary` is a human-readable list such as ["Province: Cebu", "Search: “bridge”"]. */
export async function downloadAreasPdf(items: FloodProneArea[], filterSummary: string[]) {
  // Loaded on demand so the PDF libraries stay out of the page's initial bundle.
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title band on the first page.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setFillColor(...ORANGE);
  doc.rect(0, 24, pageWidth, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FLOODWATCH  |  FLOOD-PRONE AREAS", 12, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${items.length.toLocaleString("en-US")} record${items.length === 1 ? "" : "s"}  ·  Generated ${new Date().toLocaleString("en-PH")}`,
    12,
    19,
  );
  doc.setTextColor(60, 70, 90);
  doc.setFontSize(8.5);
  doc.text(`Filters: ${filterSummary.length > 0 ? filterSummary.join("  ·  ") : "none (all records)"}`, 12, 32);

  autoTable(doc, {
    startY: 36,
    margin: { top: 14, left: 12, right: 12, bottom: 14 },
    head: [["Region", "Province", "Municipality/City", "Barangay", "Road / Waterway", "KM Station", "DEO", "Latitude", "Longitude", "Location"]],
    body: items.map((area) => {
      const [region, province, municipality, barangay, road, km, deo, lat, lng, accuracy, status] = areaToRow(area);
      return [region, province, municipality, barangay, road, km, deo, lat, lng, status === "Located" ? accuracy : status === "Not located yet" ? status : `${accuracy}\n${status}`];
    }),
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.6, textColor: [30, 41, 59], overflow: "linebreak" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 5: { cellWidth: 34 }, 7: { cellWidth: 18, halign: "right" }, 8: { cellWidth: 18, halign: "right" }, 9: { cellWidth: 30 } },
    showHead: "everyPage",
  });

  // Page numbers need the final count, so they are drawn after the table is laid out.
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("FloodWatch · Flood-prone areas", 12, pageHeight - 6);
    doc.text(`Page ${page} of ${pages}`, pageWidth - 12, pageHeight - 6, { align: "right" });
  }

  doc.save(`flood-prone-areas-${today()}.pdf`);
}
