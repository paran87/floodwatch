/**
 * LocationResolver.js — turns a flood-prone-area record's available
 * location fields into a classified, non-fabricated location result.
 *
 * Hierarchy (strongest to weakest), per project spec:
 *   1. existing latitude + longitude
 *   2. exact address/location description
 *   3. road + barangay + municipality + province
 *   4. barangay + municipality + province
 *   5. municipality + province
 *   6. province
 *   7. region
 *   8. insufficient information
 *
 * This module NEVER calls an external geocoding API itself — it decides
 * WHAT query to send and WHAT confidence that result could ever have, and
 * hands off to a provider behind callGeocodingProvider_() so the provider
 * can be swapped later without touching callers (Locations.js, Dashboard.js).
 * No provider is wired up yet (GEOCODING_PROVIDER script property is
 * expected to be "none" until the team evaluates coverage/cost/rate limits
 * for ~1,763 Philippine records — see section 29 of CLAUDE.md).
 */

/**
 * @param {Object} record - a row object from readSheetAsObjects_, already
 *   forward-filled on "Region".
 * @return {{accuracy: string, source: string, geocodingQuery: (string|null), needsReview: boolean, reviewReason: (string|null)}}
 */
function classifyLocation_(record) {
  const region = toTrimmedString_(record["Region"]);
  const province = toTrimmedString_(record["Province"]);
  const municipality = toTrimmedString_(record["Municipality/City"]);
  const barangay = toTrimmedString_(record["Barangay"]);
  const road = toTrimmedString_(record["Road Name/Waterways"]);
  const kmStationLimit = toTrimmedString_(record["KM Station Limit"]);
  const lat = toNullableNumber_(record["Latitude "] !== undefined ? record["Latitude "] : record["Latitude"]);
  const lng = toNullableNumber_(record["Longitude"]);

  // Tier 1: existing coordinates already in the sheet. Never overwritten, never "corrected".
  if (lat !== null && lng !== null) {
    return { accuracy: "exact", source: "existing_coordinates", geocodingQuery: null, needsReview: false, reviewReason: null };
  }

  // Known data quirk: a few records have a "lat, lng" pair mistakenly typed
  // into the KM Station Limit column. We surface it for manual review
  // instead of silently trusting a value that lives in the wrong column.
  const strayCoordinate = parseStrayCoordinate_(kmStationLimit);
  if (strayCoordinate) {
    return {
      accuracy: "exact",
      source: "approximate",
      geocodingQuery: null,
      needsReview: true,
      reviewReason:
        'A coordinate-like value ("' + kmStationLimit + '") was found in the "KM Station Limit" column instead of Latitude/Longitude. Needs manual confirmation before use.',
      proposedLatitude: strayCoordinate.lat,
      proposedLongitude: strayCoordinate.lng,
    };
  }

  const queryParts = [];
  let accuracy = "unresolved";

  if (road && barangay && municipality && province) {
    queryParts.push(road, barangay, municipality, province);
    accuracy = "road";
  } else if (barangay && municipality && province) {
    queryParts.push(barangay, municipality, province);
    accuracy = "barangay";
  } else if (municipality && province) {
    queryParts.push(municipality, province);
    accuracy = "municipality";
  } else if (province) {
    queryParts.push(province);
    accuracy = "province";
  } else if (region) {
    queryParts.push(region);
    accuracy = "region";
  }

  if (accuracy === "unresolved") {
    return { accuracy: "unresolved", source: "unresolved", geocodingQuery: null, needsReview: false, reviewReason: null };
  }

  queryParts.push("Philippines");
  return {
    accuracy: accuracy,
    source: "geocoded",
    geocodingQuery: queryParts.join(", "),
    needsReview: accuracy === "municipality" || accuracy === "province" || accuracy === "region",
    reviewReason:
      accuracy === "municipality" || accuracy === "province" || accuracy === "region"
        ? "Only " + accuracy + "-level information is available; a geocoded point here would be approximate, not exact."
        : null,
  };
}

function parseStrayCoordinate_(text) {
  const match = /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/.exec(text);
  if (!match) return null;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

/**
 * Provider seam. Throws NOT_IMPLEMENTED while GEOCODING_PROVIDER is "none"
 * (the default) — Locations.js must catch this and leave the record
 * unresolved rather than fabricating a point.
 */
function callGeocodingProvider_(query) {
  const provider = getOptionalScriptProperty_("GEOCODING_PROVIDER", "none");
  if (provider === "none") {
    throw AppError_("GEOCODING_NOT_CONFIGURED", "No geocoding provider is configured yet (GEOCODING_PROVIDER=none).");
  }
  throw AppError_("GEOCODING_NOT_IMPLEMENTED", 'Geocoding provider "' + provider + '" is not implemented yet.');
}
