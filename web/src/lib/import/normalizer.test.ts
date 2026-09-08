import assert from "node:assert/strict";
import { test } from "node:test";
import { comparisonKey, foldCompare, normalizeMappedFields, normalizeRegion } from "./normalizer";

test("normalizes barangay prefixes to a comparable form", () => {
  assert.equal(foldCompare("Brgy. San Roque"), foldCompare("Barangay San Roque"));
  assert.equal(foldCompare("Barangay San Roque"), foldCompare("San Roque"));
});

test("expands road abbreviations", () => {
  assert.equal(foldCompare("National Hwy."), foldCompare("National Highway"));
  assert.equal(foldCompare("Rizal St."), foldCompare("Rizal Street"));
});

test("maps region IV-B to MIMAROPA", () => {
  assert.equal(normalizeRegion("IV-B"), "MIMAROPA");
  assert.equal(normalizeRegion("Region IV-B"), "MIMAROPA");
});

test("maps BARMM and Negros Island Region aliases", () => {
  assert.equal(normalizeRegion("BARMM"), "BARMM");
  assert.equal(normalizeRegion("NEGROS ISLAND REGION"), "NEGROS ISLAND REGION");
  assert.equal(normalizeRegion("NIR"), "NEGROS ISLAND REGION");
});

test("normalizes a messy Occidental Mindoro row without inventing coordinates", () => {
  const { record } = normalizeMappedFields({
    region: "IV-B",
    deo: "Occ. Mindoro",
    city_municipality: "San Jose, Occidental Mindoro",
    barangay: "Brgy. San Roque",
    road_name: "National Hwy.",
    latitude: "12.3521",
    longitude: "121.0672",
  });
  assert.equal(record.region, "MIMAROPA");
  assert.equal(record.deo, "Occidental Mindoro DEO");
  assert.equal(record.city_municipality, "San Jose");
  assert.equal(record.barangay, "San Roque");
  assert.equal(record.road_name, "National Highway");
  assert.equal(record.latitude, 12.3521);
  assert.equal(record.longitude, 121.0672);
  assert.equal(record.flood_status, "Flood-prone");
  assert.equal(record.location_source, "Google Sheet");
});

test("comparison keys treat formatted duplicates as the same place", () => {
  const left = comparisonKey({
    region: "IV-B",
    deo: "Occ. Mindoro",
    city_municipality: "San Jose",
    barangay: "Brgy. San Roque",
    road_name: "National Hwy.",
  });
  const right = comparisonKey({
    region: "MIMAROPA",
    deo: "Occidental Mindoro DEO",
    city_municipality: "San Jose",
    barangay: "Barangay San Roque",
    road_name: "National Highway",
  });
  assert.equal(left, right);
});
