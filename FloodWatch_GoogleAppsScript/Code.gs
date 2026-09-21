const SPREADSHEET_ID = '1KnQQnvU5NlFypK7k4zLJ9ni45eDvdHh2nPoUNkij5gc';
const MAIN_SHEET_GID = 0;
const RECYCLE_SHEET_NAME = 'Recycle Bin';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('FloodWatch | Flood Prone Areas')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getMainSheet_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheets().find(s => s.getSheetId() === MAIN_SHEET_GID);
  if (!sheet) throw new Error('The sheet with gid=0 could not be found.');
  return sheet;
}

function getRecycleSheet_(createIfMissing) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(RECYCLE_SHEET_NAME);
  if (!sheet && createIfMissing) sheet = ss.insertSheet(RECYCLE_SHEET_NAME);
  return sheet;
}

function normalizeHeader_(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
}

function findColumn_(headers, aliases) {
  const normalized = headers.map(normalizeHeader_);
  for (const alias of aliases) {
    const idx = normalized.indexOf(normalizeHeader_(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

function headerMap_(headers) {
  return {
    region: findColumn_(headers, ['Region', 'Region Name']),
    deo: findColumn_(headers, ['DEO', 'District Engineering Office']),
    province: findColumn_(headers, ['Province', 'Province Name']),
    muni: findColumn_(headers, ['Municipality/City', 'Municipality', 'Municipality City', 'City']),
    brgy: findColumn_(headers, ['Barangay', 'Brgy']),
    road: findColumn_(headers, ['Road Name', 'Road', 'National Road', 'Road/Street']),
    km: findColumn_(headers, ['KM Station Limit', 'KM Station', 'KM Limit', 'Station Limit', 'Limit']),
    links: findColumn_(headers, ['Links', 'Link']),
    lat: findColumn_(headers, ['Latitude', 'Lat']),
    lng: findColumn_(headers, ['Longitude', 'Lng', 'Long', 'Longtitude'])
  };
}

function valueAt_(row, index) {
  return index >= 0 && index < row.length ? row[index] : '';
}

/**
 * Normalize region labels coming from the sheet so filtering is consistent.
 * Handles common variants such as "REGION 1", "Region 01", "Region I - Ilocos",
 * and extra spaces/case differences.
 */
function normalizeRegionName_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const compact = raw.replace(/\s+/g, ' ').trim();
  const upper = compact.toUpperCase();

  const aliases = {
    'BARMM': 'BARMM',
    'BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO': 'BARMM',
    'CAR': 'CAR',
    'CORDILLERA ADMINISTRATIVE REGION': 'CAR',
    'CALABARZON': 'CALABARZON',
    'MIMAROPA': 'MIMAROPA',
    'NCR': 'NCR',
    'NATIONAL CAPITAL REGION': 'NCR',
    'NIR': 'NIR',
    'NEGROS ISLAND REGION': 'NIR',
    'NEGROS ISLANDS REGION': 'NIR'
  };
  if (aliases[upper]) return aliases[upper];

  // Match Region I-XIII written with Roman numerals, Arabic numerals,
  // leading zeroes, or followed by a descriptive name.
  const roman = {
    I:'I', II:'II', III:'III', IV:'IV', V:'V', VI:'VI',
    VII:'VII', VIII:'VIII', IX:'IX', X:'X', XI:'XI', XII:'XII', XIII:'XIII'
  };

  let m = upper.match(/^REGION\s*(\d{1,2})(?:\s*[-–—:]?.*)?$/);
  if (m) {
    const n = Number(m[1]);
    const romanByNumber = {1:'I',2:'II',3:'III',4:'IV',5:'V',6:'VI',7:'VII',8:'VIII',9:'IX',10:'X',11:'XI',12:'XII',13:'XIII'};
    if (romanByNumber[n]) return 'Region ' + romanByNumber[n];
  }

  // Explicitly list Roman numerals in descending order. This avoids
  // partial/ambiguous matches for VII and VIII.
  m = upper.match(/^REGION\s*(XIII|XII|XI|VIII|VII|VI|V|IV|III|II|I|X|IX)(?:\s*[-–—:]?.*)?$/);
  if (m && roman[m[1]]) return 'Region ' + roman[m[1]];

  return compact;
}

function numericOrBlank_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : '';
}

function rowToLocation_(row, rowNumber, map) {
  return {
    id: String(rowNumber),
    region: normalizeRegionName_(valueAt_(row, map.region)),
    province: String(valueAt_(row, map.province) || ''),
    muni: String(valueAt_(row, map.muni) || ''),
    brgy: String(valueAt_(row, map.brgy) || ''),
    road: String(valueAt_(row, map.road) || ''),
    km: String(valueAt_(row, map.km) || ''),
    lat: numericOrBlank_(valueAt_(row, map.lat)),
    lng: numericOrBlank_(valueAt_(row, map.lng))
  };
}

function findHeaderRow_(values) {
  for (let i = 0; i < Math.min(values.length, 20); i++) {
    const normalized = values[i].map(normalizeHeader_);
    const hasRegion = normalized.includes('region');
    const hasMunicipality = normalized.includes('municipalitycity') || normalized.includes('municipality') || normalized.includes('city');
    const hasBarangay = normalized.includes('barangay') || normalized.includes('brgy');
    const hasRoad = normalized.includes('roadname') || normalized.includes('road') || normalized.includes('nationalroad');
    const hasKm = normalized.includes('kmstationlimit') || normalized.includes('kmstation') || normalized.includes('kmlimit') || normalized.includes('stationlimit') || normalized.includes('limit');
    const hasDEO = normalized.includes('deo');
    const matches = [hasRegion, hasMunicipality, hasBarangay, hasRoad, hasKm, hasDEO].filter(Boolean).length;
    if (matches >= 3) return i;
  }
  return 0;
}

function getSheetRows_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return { headers: [], rows: [], map: headerMap_([]), headerRow: 1 };
  const headerIndex = findHeaderRow_(values);
  const headers = values[headerIndex].map(v => String(v || '').trim());
  return {
    headers,
    rows: values.slice(headerIndex + 1),
    map: headerMap_(headers),
    headerRow: headerIndex + 1
  };
}

function ensureLocationColumns_(sheet) {
  const data = getSheetRows_(sheet);
  const required = [
    ['Province', 'province'],
    ['Latitude', 'lat'],
    ['Longitude', 'lng']
  ];

  let headers = data.headers.slice();
  let map = headerMap_(headers);

  required.forEach(([header, key]) => {
    if (map[key] === -1) {
      const newColumn = headers.length + 1;
      sheet.getRange(data.headerRow, newColumn).setValue(header);
      headers.push(header);
      map = headerMap_(headers);
    }
  });

  return getSheetRows_(sheet);
}

function getDashboardData() {
  const main = getMainSheet_();
  const data = getSheetRows_(main);
  const locations = [];
  let currentRegion = '';

  data.rows.forEach((row, i) => {
    if (row.every(v => String(v || '').trim() === '')) return;

    const rawRegion = valueAt_(row, data.map.region);
    if (String(rawRegion || '').trim() !== '') {
      currentRegion = normalizeRegionName_(rawRegion);
    }

    const normalizedRow = row.slice();
    if (data.map.region >= 0) normalizedRow[data.map.region] = currentRegion;

    const actualSheetRow = data.headerRow + i + 1;
    locations.push(rowToLocation_(normalizedRow, actualSheetRow, data.map));
  });

  const recycleSheet = getRecycleSheet_(false);
  const recycle = recycleSheet ? getRecycleRows_(recycleSheet) : [];
  return { locations, recycle };
}

function getRecycleRows_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const map = headerMap_(headers);
  const deletedAtIndex = findColumn_(headers, ['Deleted At']);
  return values.slice(1).map((row, i) => {
    const location = rowToLocation_(row, i + 2, map);
    location.id = 'R:' + String(i + 2);
    location.deletedAt = valueAt_(row, deletedAtIndex);
    return location;
  }).filter(r => r.region || r.province || r.muni || r.brgy || r.road || r.km);
}

function ensureRecycleHeader_(mainHeaders, recycleSheet) {
  const wanted = mainHeaders.concat(['Deleted At']);
  const lastCol = recycleSheet.getLastColumn();
  const current = lastCol ? recycleSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] : [];
  if (current.length !== wanted.length || wanted.some((h, i) => String(current[i] || '') !== String(h || ''))) {
    recycleSheet.clearContents();
    recycleSheet.getRange(1, 1, 1, wanted.length).setValues([wanted]);
  }
  return wanted;
}

function setLocationIntoRow_(row, map, data) {
  const out = row.slice();
  while (out.length <= Math.max(map.region, map.province, map.muni, map.brgy, map.road, map.km, map.lat, map.lng)) out.push('');

  const set = (key, value) => {
    if (map[key] >= 0) out[map[key]] = value === undefined || value === null ? '' : value;
  };

  set('region', data.region || '');
  set('province', data.province || '');
  set('muni', data.muni || '');
  set('brgy', data.brgy || '');
  set('road', data.road || '');
  set('km', data.km || '');
  set('lat', data.lat === '' || data.lat === null || data.lat === undefined || Number(data.lat) === 0 ? '' : data.lat);
  set('lng', data.lng === '' || data.lng === null || data.lng === undefined || Number(data.lng) === 0 ? '' : data.lng);
  return out;
}

function saveLocation(data, id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getMainSheet_();
    const sheetData = ensureLocationColumns_(sheet);
    if (!sheetData.headers.length) throw new Error('The Google Sheet must have a header row.');

    let rowValues;
    if (id !== '' && id !== null && id !== undefined) {
      const rowNumber = Number(id);
      if (!Number.isInteger(rowNumber) || rowNumber < sheetData.headerRow + 1 || rowNumber > sheet.getLastRow()) {
        throw new Error('The selected location no longer exists. Please refresh and try again.');
      }
      rowValues = sheet.getRange(rowNumber, 1, 1, sheetData.headers.length).getValues()[0];
    } else {
      rowValues = new Array(sheetData.headers.length).fill('');
    }

    const updated = setLocationIntoRow_(rowValues, sheetData.map, data);
    if (id !== '' && id !== null && id !== undefined) {
      sheet.getRange(Number(id), 1, 1, updated.length).setValues([updated]);
    } else {
      sheet.appendRow(updated);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

function moveToRecycleBin(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rowNumber = Number(id);
    const main = getMainSheet_();
    const data = ensureLocationColumns_(main);
    if (!Number.isInteger(rowNumber) || rowNumber < data.headerRow + 1 || rowNumber > main.getLastRow()) throw new Error('Invalid location id.');

    const row = main.getRange(rowNumber, 1, 1, data.headers.length).getValues()[0];
    const recycle = getRecycleSheet_(true);
    const headers = ensureRecycleHeader_(data.headers, recycle);
    recycle.getRange(recycle.getLastRow() + 1, 1, 1, headers.length).setValues([row.concat([new Date()])]);
    main.deleteRow(rowNumber);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function restoreLocation(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const recycle = getRecycleSheet_(false);
    if (!recycle) throw new Error('Recycle Bin is empty.');
    const rowNumber = Number(String(id).replace(/^R:/, ''));
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > recycle.getLastRow()) throw new Error('Invalid recycle-bin id.');

    const row = recycle.getRange(rowNumber, 1, 1, recycle.getLastColumn()).getValues()[0];
    const main = getMainSheet_();
    const mainData = ensureLocationColumns_(main);
    const restoreRow = row.slice(0, mainData.headers.length);
    while (restoreRow.length < mainData.headers.length) restoreRow.push('');
    main.appendRow(restoreRow);
    recycle.deleteRow(rowNumber);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function geocodeLocation(data) {
  const parts = [];
  if (data.road) parts.push(String(data.road));
  if (data.brgy) parts.push(String(data.brgy));
  if (data.muni) parts.push(String(data.muni));
  if (data.province) parts.push(String(data.province));
  if (data.region && data.region !== 'NCR') parts.push(String(data.region));
  parts.push('Philippines');

  const query = parts.filter(Boolean).join(', ');
  if (!query || query === 'Philippines') throw new Error('Not enough location information to locate this area.');

  const result = Maps.newGeocoder()
    .setLanguage('en')
    .setRegion('ph')
    .geocode(query);

  if (!result || result.status !== 'OK' || !result.results || !result.results.length) {
    throw new Error('The area could not be located from the available address data.');
  }

  const best = result.results[0];
  const location = best.geometry && best.geometry.location;
  if (!location) throw new Error('The geocoder returned no coordinates.');

  return {
    lat: Number(location.lat),
    lng: Number(location.lng),
    address: best.formatted_address || query
  };
}

function testSheetConnection() {
  const sheet = getMainSheet_();
  Logger.log('Spreadsheet: ' + sheet.getParent().getName());
  Logger.log('Sheet name: ' + sheet.getName());
  Logger.log('Rows: ' + sheet.getLastRow());
  Logger.log('Columns: ' + sheet.getLastColumn());
  Logger.log(sheet.getDataRange().getDisplayValues());
}

function testDashboardData() {
  const result = getDashboardData();
  Logger.log('Locations count: ' + result.locations.length);
  Logger.log('Recycle count: ' + result.recycle.length);
  if (result.locations.length) Logger.log(JSON.stringify(result.locations[0]));
}
