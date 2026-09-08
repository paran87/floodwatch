import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReviewLoopResponse } from "./review-response";

test("successful review actions return HTTP 200 and success=true", () => {
  const response = buildReviewLoopResponse([
    { id: "imp-1", ok: true },
    { id: "imp-2", ok: true },
  ]);
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.error, undefined);
  assert.equal(response.body.results.length, 2);
});

test("a failed review action returns HTTP 422 and keeps the per-row error", () => {
  const response = buildReviewLoopResponse([
    { id: "imp-1", ok: false, error: "duplicate key value violates unique constraint \"flood_prone_areas_dedup_idx\"" },
  ]);
  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.error,
    "duplicate key value violates unique constraint \"flood_prone_areas_dedup_idx\"",
  );
  assert.equal(response.body.results[0]?.ok, false);
  assert.equal(response.body.results[0]?.error, response.body.error);
});

test("partial bulk failure is not HTTP 200 and preserves every row error", () => {
  const response = buildReviewLoopResponse([
    { id: "imp-1", ok: true },
    { id: "imp-2", ok: false, error: "City / municipality is required." },
  ]);
  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error, "City / municipality is required.");
  assert.deepEqual(
    response.body.results.map((row) => row.ok),
    [true, false],
  );
});
