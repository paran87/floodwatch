import assert from "node:assert/strict";
import { test } from "node:test";
import { processSheetRows } from "./processor";
import type { FloodProneArea } from "../types";

const headers = ["Region", "DEO", "Municipality", "Barangay", "Road Name", "Latitude", "Longitude"];

function area(overrides: Partial<FloodProneArea> = {}): FloodProneArea {
  return {
    id: "existing-1",
    name: "National Highway",
    address: null,
    barangay: "San Roque",
    city_municipality: "San Jose",
    road_name: "National Highway",
    road_length: null,
    latitude: 12.352,
    longitude: 121.0673,
    flood_status: "Flood-prone",
    description: null,
    geometry: null,
    region: "MIMAROPA",
    deo: "Occidental Mindoro DEO",
    location_source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("idempotent import skips unchanged hashes", async () => {
  const raw = {
    Region: "IV-B",
    DEO: "Occ. Mindoro",
    Municipality: "San Jose",
    Barangay: "Brgy. San Roque",
    "Road Name": "National Hwy.",
    Latitude: "12.3521",
    Longitude: "121.0672",
  };
  const first = await processSheetRows({
    headers,
    rows: [{ rowNumber: 2, raw }],
    existingAreas: [area()],
    previousImports: [],
  });
  assert.equal(first.processed.length, 1);
  const second = await processSheetRows({
    headers,
    rows: [{ rowNumber: 2, raw }],
    existingAreas: [area()],
    previousImports: [
      {
        id: "imp-1",
        source_row_number: 2,
        source_row_hash: first.processed[0].sourceRowHash,
        status: "possible_duplicate",
      },
    ],
  });
  assert.equal(second.processed.length, 0);
  assert.equal(second.skippedUnchanged, 1);
});

test("changed spreadsheet rows are reprocessed", async () => {
  const firstRaw = {
    Region: "IV-B",
    DEO: "Occ. Mindoro",
    Municipality: "San Jose",
    Barangay: "Brgy. San Roque",
    "Road Name": "National Hwy.",
    Latitude: "12.3521",
    Longitude: "121.0672",
  };
  const first = await processSheetRows({
    headers,
    rows: [{ rowNumber: 2, raw: firstRaw }],
    existingAreas: [],
    previousImports: [],
  });
  const second = await processSheetRows({
    headers,
    rows: [{ rowNumber: 2, raw: { ...firstRaw, Barangay: "Brgy. San Pedro" } }],
    existingAreas: [],
    previousImports: [
      {
        id: "imp-1",
        source_row_number: 2,
        source_row_hash: first.processed[0].sourceRowHash,
        status: "new",
      },
    ],
  });
  assert.equal(second.processed.length, 1);
  assert.equal(second.processed[0].normalizedData?.barangay, "San Pedro");
});

test("missing municipality becomes a row-level error and does not stop the batch", async () => {
  const result = await processSheetRows({
    headers,
    rows: [
      {
        rowNumber: 2,
        raw: {
          Region: "IV-B",
          DEO: "Occ. Mindoro",
          Municipality: "",
          Barangay: "San Roque",
          "Road Name": "National Hwy.",
          Latitude: "12.3521",
          Longitude: "121.0672",
        },
      },
      {
        rowNumber: 3,
        raw: {
          Region: "IV-B",
          DEO: "Occ. Mindoro",
          Municipality: "Magsaysay",
          Barangay: "Poblacion",
          "Road Name": "Market Road",
          Latitude: "",
          Longitude: "",
        },
      },
    ],
    existingAreas: [],
    previousImports: [],
  });
  assert.equal(result.processed.length, 2);
  assert.equal(result.processed[0].status, "error");
  assert.equal(result.processed[1].status, "new");
});

test("carries region banners to later location rows and does not import banners", async () => {
  const result = await processSheetRows({
    headers,
    rows: [
      {
        rowNumber: 4,
        raw: {
          Region: "Region VIII",
          DEO: "",
          Municipality: "",
          Barangay: "",
          "Road Name": "",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 5,
        raw: {
          Region: "",
          DEO: "Biliran DEO",
          Municipality: "Naval",
          Barangay: "Agpangi",
          "Road Name": "Biliran Circumferential Road",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 6,
        raw: {
          Region: "REGION XI",
          DEO: "",
          Municipality: "",
          Barangay: "",
          "Road Name": "",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 7,
        raw: {
          Region: "",
          DEO: "Davao City DEO",
          Municipality: "Davao City",
          Barangay: "Poblacion",
          "Road Name": "Quirino Avenue",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 8,
        raw: {
          Region: "NEGROS ISLAND REGION",
          DEO: "",
          Municipality: "",
          Barangay: "",
          "Road Name": "",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 9,
        raw: {
          Region: "",
          DEO: "Bacolod City DEO",
          Municipality: "Bacolod City",
          Barangay: "Singcang",
          "Road Name": "Lacson Street",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 10,
        raw: {
          Region: "BARMM",
          DEO: "",
          Municipality: "",
          Barangay: "",
          "Road Name": "",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 11,
        raw: {
          Region: "",
          DEO: "Maguindanao 1st DEO",
          Municipality: "Cotabato City",
          Barangay: "Poblacion",
          "Road Name": "Sinsuat Avenue",
          Latitude: "",
          Longitude: "",
        },
      },
    ],
    existingAreas: [],
    previousImports: [],
  });

  assert.equal(result.processed.length, 4);
  assert.deepEqual(
    result.processed.map((row) => row.sourceRowNumber),
    [5, 7, 9, 11],
  );
  assert.equal(result.processed[0].normalizedData?.region, "Region VIII");
  assert.equal(result.processed[1].normalizedData?.region, "Region XI");
  assert.equal(result.processed[2].normalizedData?.region, "NEGROS ISLAND REGION");
  assert.equal(result.processed[3].normalizedData?.region, "BARMM");
  assert.equal(result.processed[0].rawData.Region, "");
  assert.equal(result.processed[3].rawData.Region, "");
  assert.ok(result.processed[0].warnings.some((warning) => /Region inherited from section header \(Region VIII\)/.test(warning)));
});

test("inherited region is used by duplicate detection", async () => {
  const visayas = area({
    id: "viii",
    region: "Region VIII",
    city_municipality: "Naval",
    barangay: "Agpangi",
    road_name: "Biliran Circumferential Road",
    deo: "Biliran DEO",
    latitude: null,
    longitude: null,
  });
  const bangsamoro = area({
    id: "barmm",
    region: "BARMM",
    city_municipality: "Naval",
    barangay: "Agpangi",
    road_name: "Biliran Circumferential Road",
    deo: "Biliran DEO",
    latitude: null,
    longitude: null,
  });
  const result = await processSheetRows({
    headers,
    rows: [
      {
        rowNumber: 4,
        raw: {
          Region: "Region VIII",
          DEO: "",
          Municipality: "",
          Barangay: "",
          "Road Name": "",
          Latitude: "",
          Longitude: "",
        },
      },
      {
        rowNumber: 5,
        raw: {
          Region: "",
          DEO: "Biliran DEO",
          Municipality: "Naval",
          Barangay: "Agpangi",
          "Road Name": "Biliran Circumferential Road",
          Latitude: "",
          Longitude: "",
        },
      },
    ],
    existingAreas: [bangsamoro, visayas],
    previousImports: [],
  });

  assert.equal(result.processed.length, 1);
  assert.equal(result.processed[0].normalizedData?.region, "Region VIII");
  assert.equal(result.processed[0].status, "duplicate");
  assert.equal(result.processed[0].matchedRecordId, "viii");
});

test("repeated section-header rows are skipped and later locations inherit the region", async () => {
  const sheetHeaders = ["DEO", "Links", "Region", "Barangay", "Road Name", "Municipality/City"];
  const headerRow = (region: string) => ({
    DEO: "DEO",
    Links: "Links",
    Region: region,
    Barangay: "Barangay",
    "Road Name": "Road Name",
    "Municipality/City": "Municipality/City",
  });
  const result = await processSheetRows({
    headers: sheetHeaders,
    headerRowNumber: 3,
    rows: [
      { rowNumber: 309, raw: headerRow("REGION IV-A") },
      {
        rowNumber: 310,
        raw: {
          DEO: "Quezon 1st DEO",
          Links: "",
          Region: "",
          Barangay: "Poblacion",
          "Road Name": "Maharlika Highway",
          "Municipality/City": "Lucena City",
        },
      },
      { rowNumber: 384, raw: headerRow("Region V") },
      { rowNumber: 416, raw: headerRow("Region VII") },
      { rowNumber: 484, raw: headerRow("Region VIII") },
      {
        rowNumber: 485,
        raw: {
          DEO: "Biliran DEO",
          Links: "REGION VIII",
          Region: "",
          Barangay: "Bato",
          "Road Name": "Biliran Circumferential Road",
          "Municipality/City": "Biliran",
        },
      },
      {
        rowNumber: 486,
        raw: {
          DEO: "Biliran DEO",
          Links: "",
          Region: "",
          Barangay: "Agpangi",
          "Road Name": "Biliran Circumferential Road",
          "Municipality/City": "Naval",
        },
      },
      { rowNumber: 511, raw: headerRow("Region IX") },
      { rowNumber: 547, raw: headerRow("Region X") },
      {
        rowNumber: 548,
        raw: {
          DEO: "Bukidnon 1st DEO",
          Links: "Region X",
          Region: "",
          Barangay: "Poblacion",
          "Road Name": "Jct Sayre H-Way- Impasugong- Patulangan By-Pass Road",
          "Municipality/City": "Impasugong,",
        },
      },
      { rowNumber: 642, raw: headerRow("REGION XI") },
      {
        rowNumber: 643,
        raw: {
          DEO: "Davao City DEO",
          Links: "REGION XI",
          Region: "",
          Barangay: "",
          "Road Name": "Along Davao River",
          "Municipality/City": "Davao City",
        },
      },
      { rowNumber: 737, raw: headerRow("NEGROS ISLAND REGION") },
      {
        rowNumber: 738,
        raw: {
          DEO: "Bacolod DEO",
          Links: "NIR",
          Region: "",
          Barangay: "Bata",
          "Road Name": "Bacolod North Road (S00078nr)",
          "Municipality/City": "Bacolod City",
        },
      },
      { rowNumber: 818, raw: headerRow("") },
      {
        rowNumber: 819,
        raw: {
          DEO: "Lanao del Sur 1st",
          Links: "",
          Region: "BARMM",
          Barangay: "Buadi Sacayo",
          "Road Name": "MARAWI-CADRE",
          "Municipality/City": "Marawi City",
        },
      },
      {
        rowNumber: 820,
        raw: {
          DEO: "Lanao del Sur 1st",
          Links: "",
          Region: "",
          Barangay: "Buadi Sacayo",
          "Road Name": "Marawi-Bacung National Road",
          "Municipality/City": "Marawi City",
        },
      },
      { rowNumber: 821, raw: headerRow("BARMM") },
      {
        rowNumber: 822,
        raw: {
          DEO: "Maguindanao 1st DEO",
          Links: "",
          Region: "",
          Barangay: "Poblacion",
          "Road Name": "Sinsuat Avenue",
          "Municipality/City": "Cotabato City",
        },
      },
      { rowNumber: 841, raw: headerRow("Region XIII") },
      { rowNumber: 909, raw: headerRow("MIMAROPA") },
      {
        rowNumber: 910,
        raw: {
          DEO: "Marinduque",
          Links: "MIMAROPA",
          Region: "",
          Barangay: "Tampus",
          "Road Name": "Marinduque Circumferential Road",
          "Municipality/City": "Boac",
        },
      },
    ],
    existingAreas: [],
    previousImports: [],
  });

  assert.deepEqual(
    result.processed.map((row) => row.sourceRowNumber),
    [310, 485, 486, 548, 643, 738, 819, 820, 822, 910],
  );
  assert.equal(result.processed.some((row) => row.sourceRowNumber === 484), false);
  assert.equal(result.processed[0].normalizedData?.region, "CALABARZON");
  assert.equal(result.processed[1].normalizedData?.region, "Region VIII");
  assert.equal(result.processed[1].normalizedData?.city_municipality, "Biliran");
  assert.equal(result.processed[1].rawData.Region, "");
  assert.equal(result.processed[2].normalizedData?.region, "Region VIII");
  assert.equal(result.processed[3].normalizedData?.region, "Region X");
  assert.equal(result.processed[4].normalizedData?.region, "Region XI");
  assert.equal(result.processed[5].normalizedData?.region, "NEGROS ISLAND REGION");
  assert.equal(result.processed[6].normalizedData?.region, "BARMM");
  assert.equal(result.processed[6].rawData.Region, "BARMM");
  assert.equal(result.processed[7].normalizedData?.region, "BARMM");
  assert.equal(result.processed[8].normalizedData?.region, "BARMM");
  assert.equal(result.processed[9].normalizedData?.region, "MIMAROPA");
  assert.ok(
    result.processed[1].warnings.some((warning) =>
      /Region inherited from section header \(Region VIII\)/.test(warning),
    ),
  );
});

test("explicit Region on a location row overrides the inherited section region", async () => {
  const sheetHeaders = ["DEO", "Links", "Region", "Barangay", "Road Name", "Municipality/City"];
  const result = await processSheetRows({
    headers: sheetHeaders,
    rows: [
      {
        rowNumber: 484,
        raw: {
          DEO: "DEO",
          Links: "Links",
          Region: "Region VIII",
          Barangay: "Barangay",
          "Road Name": "Road Name",
          "Municipality/City": "Municipality/City",
        },
      },
      {
        rowNumber: 819,
        raw: {
          DEO: "Lanao del Sur 1st",
          Links: "",
          Region: "BARMM",
          Barangay: "Buadi Sacayo",
          "Road Name": "MARAWI-CADRE",
          "Municipality/City": "Marawi City",
        },
      },
    ],
    existingAreas: [],
    previousImports: [],
  });
  assert.equal(result.processed.length, 1);
  assert.equal(result.processed[0].sourceRowNumber, 819);
  assert.equal(result.processed[0].normalizedData?.region, "BARMM");
  assert.equal(result.processed[0].rawData.Region, "BARMM");
});

test("repeated section-header inheritance is used by duplicate detection", async () => {
  const sheetHeaders = ["DEO", "Links", "Region", "Barangay", "Road Name", "Municipality/City"];
  const visayas = area({
    id: "viii",
    region: "Region VIII",
    city_municipality: "Naval",
    barangay: "Agpangi",
    road_name: "Biliran Circumferential Road",
    deo: "Biliran DEO",
    latitude: null,
    longitude: null,
  });
  const bangsamoro = area({
    id: "barmm",
    region: "BARMM",
    city_municipality: "Naval",
    barangay: "Agpangi",
    road_name: "Biliran Circumferential Road",
    deo: "Biliran DEO",
    latitude: null,
    longitude: null,
  });
  const result = await processSheetRows({
    headers: sheetHeaders,
    rows: [
      {
        rowNumber: 484,
        raw: {
          DEO: "DEO",
          Links: "Links",
          Region: "Region VIII",
          Barangay: "Barangay",
          "Road Name": "Road Name",
          "Municipality/City": "Municipality/City",
        },
      },
      {
        rowNumber: 486,
        raw: {
          DEO: "Biliran DEO",
          Links: "",
          Region: "",
          Barangay: "Agpangi",
          "Road Name": "Biliran Circumferential Road",
          "Municipality/City": "Naval",
        },
      },
    ],
    existingAreas: [bangsamoro, visayas],
    previousImports: [],
  });
  assert.equal(result.processed.length, 1);
  assert.equal(result.processed[0].normalizedData?.region, "Region VIII");
  assert.equal(result.processed[0].status, "duplicate");
  assert.equal(result.processed[0].matchedRecordId, "viii");
});

test("AI failure falls back to deterministic processing", async () => {
  const ai = {
    completeJson: async () => {
      throw new Error("AI unavailable");
    },
  };
  const result = await processSheetRows({
    headers: [...headers, "Mystery"],
    rows: [
      {
        rowNumber: 2,
        raw: {
          Region: "IV-B",
          DEO: "Occ. Mindoro",
          Municipality: "San Jose",
          Barangay: "Poblacion",
          "Road Name": "Unique Road",
          Latitude: "",
          Longitude: "",
          Mystery: "left over",
        },
      },
    ],
    existingAreas: [],
    previousImports: [],
    ai,
  });
  assert.equal(result.processed[0].status, "new");
  assert.equal(result.processed[0].normalizedData?.city_municipality, "San Jose");
  assert.ok(result.processed[0].warnings.some((warning) => /AI normalization failed/i.test(warning)));
});
