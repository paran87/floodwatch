import assert from "node:assert/strict";
import { test } from "node:test";
import { hashSourceRow } from "./hash";

test("same row content produces the same hash", () => {
  const a = hashSourceRow({ Region: "IV-B", Barangay: "San Roque" });
  const b = hashSourceRow({ Barangay: "San Roque", Region: "IV-B" });
  assert.equal(a, b);
});

test("changed row content produces a different hash", () => {
  const a = hashSourceRow({ Region: "IV-B", Barangay: "San Roque" });
  const b = hashSourceRow({ Region: "IV-B", Barangay: "San Pedro" });
  assert.notEqual(a, b);
});
