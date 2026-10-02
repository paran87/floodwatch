/**
 * FloodProneAreas.js — read access to the "Flood Prone Areas" sheet.
 * Read-only for now: write/update actions are intentionally not exposed
 * yet (see CLAUDE.md "Production Safety" and spec section 31/38) — add
 * them only after the initial inspection report has been reviewed and
 * approved.
 */

function loadFloodProneAreaRows_() {
  const sheet = getSheet_(SHEET_TAB_NAME);
  const result = readSheetAsObjects_(sheet, SHEET_HEADER_ROW, SHEET_DATA_START_ROW);
  return forwardFillColumn_(result.rows, "Region");
}

function serializeRow_(row) {
  return {
    rowIndex: row.dataRowIndex,
    region: toTrimmedString_(row["Region"]),
    province: toTrimmedString_(row["Province"]),
    municipalityCity: toTrimmedString_(row["Municipality/City"]),
    deo: toTrimmedString_(row["DEO"]),
    barangay: toTrimmedString_(row["Barangay"]),
    roadNameWaterways: toTrimmedString_(row["Road Name/Waterways"]),
    kmStationLimit: toTrimmedString_(row["KM Station Limit"]),
    latitude: toNullableNumber_(row["Latitude "] !== undefined ? row["Latitude "] : row["Latitude"]),
    longitude: toNullableNumber_(row["Longitude"]),
    location: attachLocation_(row),
  };
}

function action_getFloodProneAreas_(e) {
  const rows = loadFloodProneAreaRows_();

  const search = e.parameter.search;
  const region = e.parameter.region;
  const province = e.parameter.province;
  const municipalityCity = e.parameter.municipalityCity;
  const barangay = e.parameter.barangay;
  const deo = e.parameter.deo;
  const accuracyFilter = e.parameter.accuracy;

  let filtered = rows.filter(function (row) {
    if (region && toTrimmedString_(row["Region"]) !== region) return false;
    if (province && toTrimmedString_(row["Province"]) !== province) return false;
    if (municipalityCity && toTrimmedString_(row["Municipality/City"]) !== municipalityCity) return false;
    if (barangay && toTrimmedString_(row["Barangay"]) !== barangay) return false;
    if (deo && toTrimmedString_(row["DEO"]) !== deo) return false;
    if (
      search &&
      !(
        containsIgnoreCase_(row["Province"], search) ||
        containsIgnoreCase_(row["Municipality/City"], search) ||
        containsIgnoreCase_(row["Barangay"], search) ||
        containsIgnoreCase_(row["Road Name/Waterways"], search) ||
        containsIgnoreCase_(row["DEO"], search)
      )
    ) {
      return false;
    }
    return true;
  });

  const serialized = filtered.map(serializeRow_);
  const finalFiltered = accuracyFilter ? serialized.filter(function (r) { return r.location.accuracy === accuracyFilter; }) : serialized;

  const page = paginate_(finalFiltered, e.parameter.page, e.parameter.pageSize);
  return { items: page, total: finalFiltered.length };
}

function action_getFloodProneArea_(e) {
  const rowIndex = Number(e.parameter.rowIndex);
  if (!rowIndex) throw AppError_("VALIDATION_FAILURE", "rowIndex is required.");

  const rows = loadFloodProneAreaRows_();
  const match = rows.filter(function (row) {
    return row.dataRowIndex === rowIndex;
  })[0];
  if (!match) throw AppError_("NOT_FOUND", "No flood-prone area at row " + rowIndex + ".");

  return serializeRow_(match);
}

function action_getFloodProneAreaFacets_(e) {
  const rows = loadFloodProneAreaRows_();
  function uniqueSorted(columnName) {
    const set = {};
    rows.forEach(function (row) {
      const value = toTrimmedString_(row[columnName]);
      if (value) set[value] = true;
    });
    return Object.keys(set).sort();
  }
  return {
    regions: uniqueSorted("Region"),
    provinces: uniqueSorted("Province"),
    municipalities: uniqueSorted("Municipality/City"),
    barangays: uniqueSorted("Barangay"),
    deos: uniqueSorted("DEO"),
  };
}
