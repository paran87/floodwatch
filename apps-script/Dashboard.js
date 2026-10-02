/**
 * Dashboard.js — aggregate statistics derived from the live sheet. Nothing
 * here is hard-coded; every number is computed from the current data on
 * each request (see CLAUDE.md on why we don't cache this in Apps Script).
 */

function action_getDashboardStats_(e) {
  const rows = loadFloodProneAreaRows_();

  const byRegion = {};
  const byProvince = {};
  rows.forEach(function (row) {
    const region = toTrimmedString_(row["Region"]) || "Unknown";
    const province = toTrimmedString_(row["Province"]) || "Unknown";
    byRegion[region] = (byRegion[region] || 0) + 1;
    byProvince[province] = (byProvince[province] || 0) + 1;
  });

  function toSortedArray(map, key) {
    return Object.keys(map)
      .map(function (k) {
        const entry = {};
        entry[key] = k;
        entry.count = map[k];
        return entry;
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
  }

  return {
    totalFloodProneAreas: rows.length,
    byRegion: toSortedArray(byRegion, "region"),
    byProvince: toSortedArray(byProvince, "province"),
    locationResolution: summarizeLocationAccuracy_(rows),
    // openReports / reportsBySeverity / pendingLocationReviews live in
    // Supabase — the Next.js /api/dashboard route merges those in
    // (see src/app/api/dashboard/route.ts). Apps Script has no visibility
    // into Supabase by design.
    openReports: 0,
    reportsBySeverity: { low: 0, moderate: 0, severe: 0, critical: 0 },
    pendingLocationReviews: 0,
  };
}
