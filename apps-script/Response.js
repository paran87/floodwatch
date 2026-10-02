/**
 * Response.js — one consistent API envelope for every action, matching
 * src/lib/types.ts ApiResponse<T> on the Next.js side exactly.
 */

function AppError_(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function successResponse_(data) {
  return jsonOutput_({ success: true, data: data });
}

/** Never includes a stack trace — only a stable error code and a safe message. */
function errorResponse_(error) {
  const code = error && error.code ? error.code : "INTERNAL_ERROR";
  const message = error && error.message ? error.message : "Something went wrong.";
  Logger.log("[FloodWatch API error] " + code + ": " + message);
  return jsonOutput_({ success: false, message: message, code: code });
}
