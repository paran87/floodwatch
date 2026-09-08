import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "25"), 100);
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("google_sheet_import_batches")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ batches: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load import history." },
      { status: 500 },
    );
  }
}
