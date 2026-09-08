import assert from "node:assert/strict";
import { test } from "node:test";
import { isReviewSuccess, reviewFailureMessage } from "./review-error";

test("success toast is allowed only when HTTP is OK and success is true", () => {
  assert.equal(isReviewSuccess(true, { success: true }), true);
  assert.equal(isReviewSuccess(true, { success: false, error: "Insert failed." }), false);
  assert.equal(isReviewSuccess(true, {}), false);
  assert.equal(isReviewSuccess(false, { success: true }), false);
});

test("HTTP 422 with success=false is never treated as an approval success", () => {
  assert.equal(
    isReviewSuccess(false, {
      success: false,
      error: "new row violates row-level security policy",
    }),
    false,
  );
});

test("the UI shows the backend error instead of a generic success copy", () => {
  const message = reviewFailureMessage({
    success: false,
    error: "duplicate key value violates unique constraint \"flood_prone_areas_dedup_idx\"",
    results: [
      {
        id: "imp-1",
        ok: false,
        error: "duplicate key value violates unique constraint \"flood_prone_areas_dedup_idx\"",
      },
    ],
  });
  assert.equal(
    message,
    "duplicate key value violates unique constraint \"flood_prone_areas_dedup_idx\"",
  );
  assert.doesNotMatch(message, /Approved into FloodWatch/i);
});

test("per-row errors are kept when the top-level message differs", () => {
  const message = reviewFailureMessage({
    success: false,
    error: "City / municipality is required.",
    results: [
      { id: "imp-1", ok: true },
      { id: "imp-2", ok: false, error: "Latitude must be between -90 and 90." },
    ],
  });
  assert.match(message, /City \/ municipality is required/);
  assert.match(message, /Latitude must be between -90 and 90/);
});

test("missing API error text still fails visibly", () => {
  assert.equal(reviewFailureMessage({ success: false }), "Action failed.");
});
