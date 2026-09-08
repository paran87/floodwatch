import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyFloodInput } from "../google-sheets/mapper";
import { validateFloodRecord } from "./validator";

test("missing municipality is a validation error", () => {
  const record = emptyFloodInput();
  const errors = validateFloodRecord(record);
  assert.equal(errors.some((item) => item.field === "city_municipality"), true);
});

test("invalid latitude is rejected", () => {
  const record = emptyFloodInput();
  record.city_municipality = "San Jose";
  record.latitude = 120;
  const errors = validateFloodRecord(record);
  assert.equal(errors.some((item) => item.field === "latitude"), true);
});

test("invalid longitude is rejected", () => {
  const record = emptyFloodInput();
  record.city_municipality = "San Jose";
  record.longitude = -200;
  const errors = validateFloodRecord(record);
  assert.equal(errors.some((item) => item.field === "longitude"), true);
});

test("valid coordinates pass", () => {
  const record = emptyFloodInput();
  record.city_municipality = "San Jose";
  record.latitude = 12.3521;
  record.longitude = 121.0672;
  assert.deepEqual(validateFloodRecord(record), []);
});
