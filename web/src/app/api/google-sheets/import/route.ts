import { NextRequest, NextResponse } from "next/server";
import { runConfiguredImport } from "@/lib/import/run";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const summary = await runConfiguredImport({ force: body.force !== false });
    return NextResponse.json(summary, { status: summary.success ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Import failed." },
      { status: 500 },
    );
  }
}
