import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260907_google_sheet_imports.sql"),
    "utf8",
  );
  return new NextResponse(sql, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
