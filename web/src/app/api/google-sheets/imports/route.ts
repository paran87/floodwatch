import { NextRequest, NextResponse } from "next/server";
import type { FloodProneArea } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status") || "all";
  const batchId = params.get("batch_id");
  const query = (params.get("q") || "").trim();
  const page = Math.max(Number(params.get("page") ?? "1"), 1);
  const pageSize = Math.min(Math.max(Number(params.get("page_size") ?? "25"), 1), 100);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = getSupabaseServerClient();
    let requestQuery = supabase
      .from("google_sheet_imports")
      .select("*", { count: "exact" })
      .order("source_row_number", { ascending: true })
      .range(from, to);

    if (batchId) requestQuery = requestQuery.eq("batch_id", batchId);
    if (status !== "all") requestQuery = requestQuery.eq("status", status);

    if (query) {
      const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
      requestQuery = requestQuery.or(
        [
          `normalized_data->>city_municipality.ilike.${pattern}`,
          `normalized_data->>barangay.ilike.${pattern}`,
          `normalized_data->>road_name.ilike.${pattern}`,
          `normalized_data->>deo.ilike.${pattern}`,
          `normalized_data->>region.ilike.${pattern}`,
        ].join(","),
      );
    }

    const { data, error, count } = await requestQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const matchedIds = [...new Set((data ?? []).map((row) => row.matched_record_id).filter(Boolean))];
    let matched: Record<string, FloodProneArea> = {};
    if (matchedIds.length > 0) {
      const existing = await supabase.from("flood_prone_areas").select("*").in("id", matchedIds);
      if (!existing.error) {
        matched = Object.fromEntries(((existing.data ?? []) as FloodProneArea[]).map((row) => [row.id, row]));
      }
    }

    return NextResponse.json({
      imports: (data ?? []).map((row) => ({
        ...row,
        matched_record: row.matched_record_id ? matched[row.matched_record_id] ?? null : null,
      })),
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load import rows." },
      { status: 500 },
    );
  }
}
