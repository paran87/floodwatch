import { NextRequest, NextResponse } from "next/server";
import { runConfiguredImport } from "@/lib/import/run";

export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await runConfiguredImport({ force: false });
    return NextResponse.json(summary, { status: summary.success ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Scheduled sync failed." },
      { status: 500 },
    );
  }
}
