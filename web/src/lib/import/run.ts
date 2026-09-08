import { createAiClient } from "@/lib/ai/client";
import { readSpreadsheet } from "@/lib/google-sheets/reader";
import { getAiConfig, getGoogleSheetsConfig } from "@/lib/import/config";
import { runGoogleSheetImport, type ImportProcessorDeps } from "@/lib/import/processor";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function runConfiguredImport(options: { force?: boolean } = {}) {
  const sheets = getGoogleSheetsConfig();
  if (!sheets.spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured.");
  }
  if (!sheets.credentials) {
    throw new Error("GOOGLE_SHEETS_CREDENTIALS is not configured.");
  }

  const ai = getAiConfig();
  const deps: ImportProcessorDeps = {
    supabase: getSupabaseServerClient(),
    readSheet: () =>
      readSpreadsheet({
        credentialsJson: sheets.credentials,
        spreadsheetId: sheets.spreadsheetId,
        sheetName: sheets.sheetName,
      }),
    ai: createAiClient(ai),
    targetTable: sheets.targetTable,
    force: options.force,
    syncIntervalMinutes: sheets.syncIntervalMinutes,
  };

  return runGoogleSheetImport(deps);
}
