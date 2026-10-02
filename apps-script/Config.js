/**
 * Config.js — Script Properties access. Nothing in this file hard-codes the
 * spreadsheet ID or any secret; everything comes from
 * File > Project Settings > Script Properties, so they never appear in
 * source control.
 *
 * Required Script Properties:
 *   SPREADSHEET_ID     — the "Flood Prone Areas" spreadsheet's file ID.
 *   API_KEY            — shared secret the Next.js server sends as
 *                         X-Api-Key on every request (see src/lib/apps-script.ts).
 *   GEOCODING_PROVIDER  — e.g. "none" | "google" | "nominatim" (see LocationResolver.js).
 *   GEOCODING_API_KEY  — provider API key, if the provider requires one. Never
 *                         logged, never returned in any response.
 */

function getScriptProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new AppError_("CONFIG_MISSING", "Missing Script Property: " + key);
  }
  return value;
}

function getOptionalScriptProperty_(key, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value === null || value === "" ? fallback : value;
}

/** Opens the existing "Flood Prone Areas" spreadsheet. Never creates a new one. */
function getSpreadsheet_() {
  const id = getScriptProperty_("SPREADSHEET_ID");
  return SpreadsheetApp.openById(id);
}

function getSheet_(sheetName) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new AppError_("SHEET_NOT_FOUND", 'Sheet tab "' + sheetName + '" was not found. Known tabs: FLOOD PRONE.');
  }
  return sheet;
}

const SHEET_TAB_NAME = "FLOOD PRONE";
const SHEET_HEADER_ROW = 2;
const SHEET_DATA_START_ROW = 3;
