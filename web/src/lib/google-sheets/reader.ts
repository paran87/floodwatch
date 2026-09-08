import { googleSheetsFetch } from "@/lib/google-sheets/client";
import { hashSourceRow } from "@/lib/google-sheets/hash";
import { mapHeaderToField, rowObject } from "@/lib/google-sheets/mapper";

export type SheetRow = {
  rowNumber: number;
  raw: Record<string, string>;
  hash: string;
};

export type SpreadsheetRead = {
  spreadsheetId: string;
  sheetName: string;
  headers: string[];
  headerRowNumber: number;
  rows: SheetRow[];
};

export const HEADER_SCAN_LIMIT = 20;

function encodeA1(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function cellsToHeaders(cells: unknown[]) {
  return cells.map((cell) => String(cell ?? "").trim());
}

export function countMappedHeaderFields(cells: unknown[]) {
  const mapped = new Set<string>();
  for (const cell of cells) {
    const field = mapHeaderToField(String(cell ?? "").trim());
    if (field) mapped.add(field);
  }
  return mapped.size;
}

export function detectHeaderRow(values: unknown[][], scanLimit = HEADER_SCAN_LIMIT) {
  const limit = Math.min(values.length, scanLimit);
  for (let index = 0; index < limit; index += 1) {
    const cells = values[index] ?? [];
    if (countMappedHeaderFields(cells) >= 2) {
      return {
        headerRowIndex: index,
        headerRowNumber: index + 1,
        headers: cellsToHeaders(cells),
      };
    }
  }

  throw new Error(
    `Could not detect a header row in the first ${scanLimit} rows. Expected a row with at least two known columns such as Region, DEO, Municipality, Barangay, or Road Name.`,
  );
}

export function rowsFromSheetValues(values: unknown[][]) {
  const detected = detectHeaderRow(values);
  const rows: SheetRow[] = [];

  for (let index = detected.headerRowIndex + 1; index < values.length; index += 1) {
    const cells = values[index] ?? [];
    const raw = rowObject(detected.headers, cells);
    const hasValue = Object.values(raw).some((value) => value.trim() !== "");
    if (!hasValue) continue;
    rows.push({
      rowNumber: index + 1,
      raw,
      hash: hashSourceRow(raw),
    });
  }

  return {
    headers: detected.headers,
    headerRowNumber: detected.headerRowNumber,
    rows,
  };
}

export async function readSpreadsheet(options: {
  credentialsJson: string;
  spreadsheetId: string;
  sheetName?: string;
}): Promise<SpreadsheetRead> {
  const { credentialsJson, spreadsheetId } = options;
  let sheetName = options.sheetName?.trim() || "";

  if (!sheetName) {
    const meta = (await googleSheetsFetch(
      credentialsJson,
      `spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    )) as { sheets?: Array<{ properties?: { title?: string } }> };
    sheetName = meta.sheets?.[0]?.properties?.title || "";
    if (!sheetName) throw new Error("The spreadsheet has no worksheets.");
  }

  const data = (await googleSheetsFetch(
    credentialsJson,
    `spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${encodeA1(sheetName)}!A1:ZZ`)}`,
  )) as { values?: unknown[][] };

  const parsed = rowsFromSheetValues(data.values ?? []);
  return {
    spreadsheetId,
    sheetName,
    headers: parsed.headers,
    headerRowNumber: parsed.headerRowNumber,
    rows: parsed.rows,
  };
}
