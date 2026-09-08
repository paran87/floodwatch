import { NextResponse } from "next/server";
import { getAiConfig, getGoogleSheetsConfig, maskId, syncIntervalMinutes } from "@/lib/import/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sheets = getGoogleSheetsConfig();
    const ai = getAiConfig();
    const supabase = getSupabaseServerClient();
    const latest = await supabase
      .from("google_sheet_import_batches")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      spreadsheetId: maskId(sheets.spreadsheetId),
      spreadsheetConfigured: Boolean(sheets.spreadsheetId),
      sheetName: sheets.sheetName || "(first worksheet)",
      targetTable: sheets.targetTable,
      syncIntervalMinutes: syncIntervalMinutes(),
      aiEnabled: Boolean(ai.apiKey),
      latestBatch: latest.data ?? null,
      error: latest.error && /relation|schema cache/i.test(latest.error.message)
        ? "Import tables are missing. Run web/supabase/migrations/20260907_google_sheet_imports.sql in the FloodWatch Supabase SQL editor."
        : latest.error?.message ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load import configuration." },
      { status: 500 },
    );
  }
}
