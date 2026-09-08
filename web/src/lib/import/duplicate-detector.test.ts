import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyDuplicate, findDuplicate, scoreCandidate } from "./duplicate-detector";
import { normalizeMappedFields } from "./normalizer";
import type { FloodProneArea } from "../types";

function area(overrides: Partial<FloodProneArea>): FloodProneArea {
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

test("exact region/deo/city/barangay/road match is a duplicate", () => {
  const existing = area({});
  const imported = {
    ...existing,
    name: existing.name,
    location_source: "Google Sheet",
  };
  const match = findDuplicate(imported, [existing]);
  assert.ok(match);
  assert.equal(match?.type, "exact");
  assert.equal(classifyDuplicate(match!.confidence, match!.type), "duplicate");
});

test("Brgy vs Barangay formatting is a normalized duplicate", () => {
  const existing = area({ barangay: "Barangay San Roque", region: "MIMAROPA" });
  const { record } = normalizeMappedFields({
    region: "IV-B",
    deo: "Occidental Mindoro DEO",
    city_municipality: "San Jose",
    barangay: "Brgy. San Roque",
    road_name: "National Highway",
  });
  const match = findDuplicate(record, [existing]);
  assert.ok(match);
  assert.equal(match?.type === "normalized" || match?.type === "exact" || (match?.confidence ?? 0) >= 0.9, true);
});

test("road abbreviation increases duplicate confidence", () => {
  const existing = area({});
  const { record } = normalizeMappedFields({
    region: "MIMAROPA",
    deo: "Occidental Mindoro DEO",
    city_municipality: "San Jose",
    barangay: "San Roque",
    road_name: "National Hwy.",
    latitude: "12.3521",
    longitude: "121.0672",
  });
  const scored = scoreCandidate(record, existing);
  assert.ok(scored.fieldScores.road_name >= 0.9);
  assert.ok(scored.confidence >= 0.9);
});

test("nearby coordinates increase duplicate confidence", () => {
  const existing = area({ latitude: 12.352, longitude: 121.0673 });
  const { record } = normalizeMappedFields({
    region: "MIMAROPA",
    deo: "Occidental Mindoro DEO",
    city_municipality: "San Jose",
    barangay: "San Roque",
    road_name: "National Highway",
    latitude: "12.3521",
    longitude: "121.0672",
  });
  const close = scoreCandidate(record, existing);
  const farExisting = area({
    id: "far",
    latitude: 14.6,
    longitude: 121.0,
    city_municipality: "Calapan",
    barangay: "Ibaba",
    road_name: "Another Road",
  });
  const far = scoreCandidate(record, farExisting);
  assert.ok(close.confidence > far.confidence);
  assert.ok(close.fieldScores.coordinates > 0.8);
});

test("similar names in different locations are not automatic duplicates", () => {
  const existing = area({
    city_municipality: "Calapan",
    barangay: "San Roque",
    road_name: "National Highway",
    latitude: 13.412,
    longitude: 121.18,
  });
  const { record } = normalizeMappedFields({
    region: "MIMAROPA",
    deo: "Oriental Mindoro DEO",
    city_municipality: "San Jose",
    barangay: "San Roque",
    road_name: "National Highway",
    latitude: "12.3521",
    longitude: "121.0672",
  });
  const match = findDuplicate(record, [existing]);
  if (match) {
    assert.notEqual(classifyDuplicate(match.confidence, match.type), "duplicate");
  }
});
