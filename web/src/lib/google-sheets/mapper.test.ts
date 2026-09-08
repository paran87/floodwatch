import assert from "node:assert/strict";
import { test } from "node:test";
import { mapHeaderToField, mapRowColumns } from "./mapper";

test("maps municipality column aliases", () => {
  assert.equal(mapHeaderToField("City/Municipality"), "city_municipality");
  assert.equal(mapHeaderToField("Municipality"), "city_municipality");
  assert.equal(mapHeaderToField("City"), "city_municipality");
  assert.equal(mapHeaderToField("Municipality/City"), "city_municipality");
});

test("maps barangay and road aliases", () => {
  assert.equal(mapHeaderToField("Brgy"), "barangay");
  assert.equal(mapHeaderToField("Barangay Name"), "barangay");
  assert.equal(mapHeaderToField("Road"), "road_name");
  assert.equal(mapHeaderToField("Road/Street"), "road_name");
  assert.equal(mapHeaderToField("Street"), "road_name");
});

test("maps a spreadsheet row into flood fields", () => {
  const result = mapRowColumns(
    ["Region", "DEO", "Municipality", "Brgy", "Road", "Latitude", "Longitude"],
    ["IV-B", "Occ. Mindoro", "San Jose", "Brgy. San Roque", "National Hwy.", "12.3521", "121.0672"],
  );
  assert.equal(result.mapped.region, "IV-B");
  assert.equal(result.mapped.deo, "Occ. Mindoro");
  assert.equal(result.mapped.city_municipality, "San Jose");
  assert.equal(result.mapped.barangay, "Brgy. San Roque");
  assert.equal(result.mapped.road_name, "National Hwy.");
  assert.equal(result.mapped.latitude, "12.3521");
  assert.equal(result.mapped.longitude, "121.0672");
});
