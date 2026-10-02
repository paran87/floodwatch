/**
 * Bootstrap.js — one-time administrative setup, reachable through the
 * public web app endpoint ONLY because `clasp run` (the Apps Script
 * Execution API) turned out to require the project be linked to a
 * custom GCP project — not available without IDE/browser access (see
 * CLAUDE.md "clasp workflow" for the full story). This is the fallback.
 *
 * Self-disabling: `action_bootstrapProperties_` refuses to run once
 * API_KEY is already set, so the moment setup succeeds once, this action
 * permanently stops doing anything — it cannot be used to silently
 * rotate the shared secret later. It is also the ONLY action in this
 * codebase that bypasses authenticateRequest_ (see Code.js), precisely
 * because there is no API_KEY yet to check on the very first call; that
 * bypass window closes forever after the first successful call.
 *
 * Never add another action that skips authenticateRequest_.
 */

function action_bootstrapProperties_(e) {
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty("API_KEY")) {
    throw AppError_("ALREADY_CONFIGURED", "Script Properties are already configured. This action is now permanently inert.");
  }

  const spreadsheetId = e.parameter.spreadsheetId;
  const apiKey = e.parameter.apiKey;
  const geocodingProvider = e.parameter.geocodingProvider || "none";

  if (!spreadsheetId || !apiKey) {
    throw AppError_("VALIDATION_FAILURE", "spreadsheetId and apiKey are required.");
  }

  props.setProperties({
    SPREADSHEET_ID: spreadsheetId,
    API_KEY: apiKey,
    GEOCODING_PROVIDER: geocodingProvider,
  });

  return { ok: true, propertiesSet: ["SPREADSHEET_ID", "API_KEY", "GEOCODING_PROVIDER"] };
}

/** Read-only check — never returns secret values, only whether they're set. */
function action_checkScriptProperties_(e) {
  const props = PropertiesService.getScriptProperties();
  return {
    SPREADSHEET_ID_set: Boolean(props.getProperty("SPREADSHEET_ID")),
    API_KEY_set: Boolean(props.getProperty("API_KEY")),
    GEOCODING_PROVIDER: props.getProperty("GEOCODING_PROVIDER") || null,
  };
}
