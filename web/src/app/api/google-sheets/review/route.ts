import { NextRequest, NextResponse } from "next/server";
import {
  approveImport,
  mergeImport,
  rejectImport,
  skipImport,
} from "@/lib/import/actions";
import { buildReviewLoopResponse } from "@/lib/import/review-response";
import type { GoogleSheetImport, MergeFieldSelection } from "@/lib/import/types";
import type { FloodProneArea, FloodProneAreaInput } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ReviewBody = {
  action: "approve" | "merge" | "reject" | "skip";
  import_id?: string;
  import_ids?: string[];
  existing_record_id?: string;
  field_choices?: MergeFieldSelection[];
  reason?: string;
  performed_by?: string;
};

async function loadImport(id: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("google_sheet_imports").select("*").eq("id", id).single();
  if (error || !data) throw new Error(error?.message || "Import row not found.");
  return data as GoogleSheetImport;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReviewBody;
    const performedBy = body.performed_by?.trim() || "admin";
    const supabase = getSupabaseServerClient();
    const ids = body.import_ids?.length ? body.import_ids : body.import_id ? [body.import_id] : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No import rows selected." }, { status: 400 });
    }

    if (body.action === "merge") {
      if (ids.length !== 1) {
        return NextResponse.json({ error: "Merge one row at a time." }, { status: 400 });
      }
      const importRow = await loadImport(ids[0]);
      const existingId = body.existing_record_id || importRow.matched_record_id;
      if (!existingId) {
        return NextResponse.json({ error: "No matching FloodWatch record to merge." }, { status: 400 });
      }
      const existing = await supabase.from("flood_prone_areas").select("*").eq("id", existingId).single();
      if (existing.error || !existing.data) {
        return NextResponse.json({ error: "The matched FloodWatch record no longer exists." }, { status: 404 });
      }
      const result = await mergeImport(
        supabase,
        {
          id: importRow.id,
          batch_id: importRow.batch_id,
          normalized_data: importRow.normalized_data as FloodProneAreaInput | null,
          matched_record_id: importRow.matched_record_id,
          status: importRow.status,
        },
        existing.data as FloodProneArea,
        body.field_choices ?? [],
        performedBy,
        body.reason,
      );
      return NextResponse.json({ success: true, action: "merged", record_id: result.id });
    }

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of ids) {
      try {
        const importRow = await loadImport(id);
        if (body.action === "approve") {
          if (ids.length > 1 && importRow.status !== "new") {
            throw new Error("Bulk approve only applies to rows classified as new.");
          }
          await approveImport(
            supabase,
            {
              id: importRow.id,
              batch_id: importRow.batch_id,
              normalized_data: importRow.normalized_data as FloodProneAreaInput | null,
              status: importRow.status,
            },
            performedBy,
          );
        } else if (body.action === "reject") {
          await rejectImport(supabase, importRow, performedBy, body.reason);
        } else if (body.action === "skip") {
          await skipImport(supabase, importRow, performedBy, body.reason);
        } else {
          throw new Error("Unsupported action.");
        }
        results.push({ id, ok: true });
      } catch (error) {
        results.push({ id, ok: false, error: error instanceof Error ? error.message : "Action failed." });
      }
    }

    const response = buildReviewLoopResponse(results);
    return NextResponse.json(response.body, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Review action failed." },
      { status: 500 },
    );
  }
}
