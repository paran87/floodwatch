/**
 * Locations.js — applies LocationResolver's classification to sheet rows.
 *
 * Apps Script does not persist resolved locations anywhere — it only
 * classifies, on each request, from the live sheet data. Persisted caching
 * (location_cache) and the manual-verification review queue
 * (location_review_queue) live in Supabase and are written by the Next.js
 * server (src/lib/api.ts), which already received this classification in
 * each flood-prone-area API response and decides what to cache/queue.
 */

function attachLocation_(row) {
  const classification = classifyLocation_(row);
  return {
    rowIndex: row.dataRowIndex,
    latitude: toNullableNumber_(row["Latitude "] !== undefined ? row["Latitude "] : row["Latitude"]),
    longitude: toNullableNumber_(row["Longitude"]),
    accuracy: classification.accuracy,
    source: classification.source,
    geocodingQuery: classification.geocodingQuery,
    geocodingStatus: classification.source === "existing_coordinates" ? "resolved" : classification.geocodingQuery ? "pending" : "not_attempted",
    needsReview: classification.needsReview,
    reviewReason: classification.reviewReason || null,
    proposedLatitude: classification.proposedLatitude || null,
    proposedLongitude: classification.proposedLongitude || null,
  };
}

function summarizeLocationAccuracy_(rows) {
  const counts = { exact: 0, address: 0, road: 0, barangay: 0, municipality: 0, province: 0, region: 0, unresolved: 0 };
  rows.forEach(function (row) {
    const classification = classifyLocation_(row);
    counts[classification.accuracy] = (counts[classification.accuracy] || 0) + 1;
  });
  return counts;
}
