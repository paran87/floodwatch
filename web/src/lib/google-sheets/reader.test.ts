import assert from "node:assert/strict";
import { test } from "node:test";
import { detectHeaderRow, rowsFromSheetValues } from "./reader";

test("detects headers on row 1", () => {
  const values = [
    ["Region", "Municipality", "Barangay", "Road Name"],
    ["NCR", "Manila City", "Sampaloc", "España Blvd."],
  ];
  const detected = detectHeaderRow(values);
  assert.equal(detected.headerRowNumber, 1);
  assert.deepEqual(detected.headers, ["Region", "Municipality", "Barangay", "Road Name"]);

  const parsed = rowsFromSheetValues(values);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].rowNumber, 2);
  assert.equal(parsed.rows[0].raw.Region, "NCR");
  assert.equal(parsed.rows[0].raw.Municipality, "Manila City");
  assert.equal(parsed.rows[0].raw.Barangay, "Sampaloc");
  assert.equal(parsed.rows[0].raw["Road Name"], "España Blvd.");
});

test("skips title rows before the real headers", () => {
  const values = [
    ["DPWH Flood Inventory"],
    ["Region", "DEO", "City/Municipality"],
    ["MIMAROPA", "Occidental Mindoro DEO", "San Jose"],
  ];
  const parsed = rowsFromSheetValues(values);
  assert.equal(parsed.headerRowNumber, 2);
  assert.deepEqual(parsed.headers, ["Region", "DEO", "City/Municipality"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].rowNumber, 3);
  assert.equal(parsed.rows[0].raw.Region, "MIMAROPA");
  assert.equal(parsed.rows[0].raw.DEO, "Occidental Mindoro DEO");
  assert.equal(parsed.rows[0].raw["City/Municipality"], "San Jose");
});

test("detects FLOOD PRONE headers on row 3 after a title", () => {
  const values = [
    ["FLOOD PRONE AREAS"],
    [],
    ["Region", "DEO", "City/Municipality", "Barangay", "Road Name"],
    ["NCR", "North Manila DEO", "Manila City", "Sampaloc", "España Blvd."],
    ["", "", "", "", ""],
    ["NCR", "North Manila DEO", "Manila City", "Sta. Mesa", "Ramon Magsaysay Blvd."],
  ];
  const parsed = rowsFromSheetValues(values);
  assert.equal(parsed.headerRowNumber, 3);
  assert.deepEqual(parsed.headers, ["Region", "DEO", "City/Municipality", "Barangay", "Road Name"]);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].rowNumber, 4);
  assert.equal(parsed.rows[0].raw.Region, "NCR");
  assert.equal(parsed.rows[0].raw["City/Municipality"], "Manila City");
  assert.equal(parsed.rows[0].raw.Barangay, "Sampaloc");
  assert.equal(parsed.rows[1].rowNumber, 6);
  assert.equal(parsed.rows[1].raw.Barangay, "Sta. Mesa");
});

test("fails when no recognizable header row exists", () => {
  const values = [
    ["FLOOD PRONE AREAS"],
    ["NCR"],
    ["Region I"],
    ["Some notes about flooding"],
  ];
  assert.throws(
    () => detectHeaderRow(values),
    /Could not detect a header row in the first 20 rows/,
  );
});
