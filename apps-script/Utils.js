/**
 * Utils.js — reusable spreadsheet access helpers. Every feature file reads
 * the sheet through these functions; column positions are NEVER assumed —
 * everything is mapped by header name, so a reordered column (which must
 * never happen to existing columns anyway) would not silently corrupt data.
 */

/**
 * Reads the header row and all data rows of a sheet, returning each row as
 * a plain object keyed by trimmed header text, plus its 1-based sheet row
 * number and a 1-based "data row index" (position within the data rows,
 * independent of header rows) used as the stable synthetic id.
 */
function readSheetAsObjects_(sheet, headerRow, dataStartRow) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < dataStartRow) return { headers: [], rows: [] };

  const headers = sheet
    .getRange(headerRow, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) {
      return String(h || "").trim();
    });

  const numDataRows = lastRow - dataStartRow + 1;
  const values = sheet.getRange(dataStartRow, 1, numDataRows, lastCol).getValues();

  const rows = values.map(function (rowValues, i) {
    const obj = { sheetRow: dataStartRow + i, dataRowIndex: i + 1 };
    headers.forEach(function (header, colIndex) {
      if (header) obj[header] = rowValues[colIndex];
    });
    return obj;
  });

  return { headers: headers, rows: rows };
}

/** Carries the last non-blank value of `columnName` forward, matching the sheet's merged-cell display (used for "Region"). */
function forwardFillColumn_(rows, columnName) {
  let last = "";
  return rows.map(function (row) {
    const value = row[columnName];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      last = String(value).trim();
    } else {
      row[columnName] = last;
    }
    return row;
  });
}

function toTrimmedString_(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function toNullableNumber_(value) {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function containsIgnoreCase_(haystack, needle) {
  if (!needle) return true;
  return toTrimmedString_(haystack).toLowerCase().indexOf(String(needle).toLowerCase()) !== -1;
}

function paginate_(items, page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(200, Math.max(1, Number(pageSize) || 25));
  const start = (p - 1) * size;
  return items.slice(start, start + size);
}
