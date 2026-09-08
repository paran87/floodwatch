export function syncIntervalMinutes() {
  const raw = Number(process.env.GOOGLE_SHEETS_SYNC_INTERVAL_MINUTES ?? "5");
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

export function getGoogleSheetsConfig() {
  return {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || "",
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || "",
    targetTable: process.env.GOOGLE_SHEETS_TARGET_TABLE?.trim() || "flood_prone_areas",
    credentials: process.env.GOOGLE_SHEETS_CREDENTIALS?.trim() || "",
    syncIntervalMinutes: syncIntervalMinutes(),
  };
}

export function getAiConfig() {
  return {
    apiKey: process.env.AI_API_KEY?.trim() || "",
    baseUrl: (process.env.AI_API_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
  };
}

export function maskId(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
