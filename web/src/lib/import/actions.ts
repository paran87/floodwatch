import type { MergeFieldSelection } from "@/lib/import/types";
import { MERGE_FIELDS } from "@/lib/import/types";
import { validateFloodRecord } from "@/lib/import/validator";
import type { FloodProneArea, FloodProneAreaInput } from "@/lib/types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type SupabaseErrorFields = {
  message: string | null;
  code: string | null;
  details: string | null;
  hint: string | null;
};

export function supabaseErrorFields(
  error: Pick<PostgrestError, "message" | "code" | "details" | "hint"> | null | undefined,
): SupabaseErrorFields {
  return {
    message: error?.message ?? null,
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

export function describeSupabaseError(
  error: Pick<PostgrestError, "message" | "code" | "details" | "hint"> | null | undefined,
): string {
  const fields = supabaseErrorFields(error);
  const parts = [
    fields.message,
    fields.code ? `code=${fields.code}` : null,
    fields.details ? `details=${fields.details}` : null,
    fields.hint ? `hint=${fields.hint}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function logFloodProneInsertError(
  importId: string,
  error: Pick<PostgrestError, "message" | "code" | "details" | "hint"> | null | undefined,
  fallbackMessage?: string,
) {
  console.error("flood_prone_areas insert failed", {
    import_id: importId,
    ...supabaseErrorFields(error),
    ...(fallbackMessage && !error?.message ? { message: fallbackMessage } : {}),
  });
}

function productionPayload(record: FloodProneAreaInput): FloodProneAreaInput {
  return {
    name: record.name,
    address: record.address,
    barangay: record.barangay,
    city_municipality: String(record.city_municipality ?? "").trim(),
    road_name: record.road_name,
    road_length: record.road_length,
    latitude: record.latitude,
    longitude: record.longitude,
    flood_status: record.flood_status || "Flood-prone",
    description: record.description,
    geometry: record.geometry,
    region: record.region,
    deo: record.deo,
    location_source: record.location_source || "Google Sheet",
  };
}

function coerceField(field: keyof FloodProneAreaInput, value: unknown) {
  if (field === "latitude" || field === "longitude" || field === "road_length") {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

export function buildMergedRecord(
  existing: FloodProneArea,
  imported: FloodProneAreaInput,
  selections: MergeFieldSelection[],
): FloodProneAreaInput {
  const next: FloodProneAreaInput = {
    name: existing.name,
    address: existing.address,
    barangay: existing.barangay,
    city_municipality: existing.city_municipality,
    road_name: existing.road_name,
    road_length: existing.road_length,
    latitude: existing.latitude,
    longitude: existing.longitude,
    flood_status: existing.flood_status,
    description: existing.description,
    geometry: existing.geometry,
    region: existing.region,
    deo: existing.deo,
    location_source: existing.location_source,
  };

  for (const field of MERGE_FIELDS) {
    const selection = selections.find((item) => item.field === field);
    if (!selection || selection.choice === "existing") continue;
    if (selection.choice === "imported") {
      (next as Record<string, unknown>)[field] = imported[field];
      continue;
    }
    (next as Record<string, unknown>)[field] = coerceField(field, selection.customValue);
  }

  return productionPayload(next);
}

async function writeAudit(
  supabase: SupabaseClient,
  input: {
    importId: string;
    batchId: string | null;
    action: "approved" | "merged" | "rejected" | "skipped";
    existingRecordId?: string | null;
    finalRecordId?: string | null;
    beforeData?: unknown;
    afterData?: unknown;
    reason?: string | null;
    performedBy: string;
  },
) {
  const { error } = await supabase.from("google_sheet_import_actions").insert({
    import_id: input.importId,
    batch_id: input.batchId,
    action: input.action,
    existing_record_id: input.existingRecordId ?? null,
    final_record_id: input.finalRecordId ?? null,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    reason: input.reason ?? null,
    performed_by: input.performedBy,
  });
  if (error) throw new Error(error.message);
}

async function markImport(
  supabase: SupabaseClient,
  importId: string,
  status: string,
  reviewedBy: string,
  extra: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("google_sheet_imports")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      ...extra,
    })
    .eq("id", importId);
  if (error) throw new Error(error.message);
}

async function bumpBatch(
  supabase: SupabaseClient,
  batchId: string | null,
  field: "approved_rows" | "merged_rows" | "rejected_rows",
) {
  if (!batchId) return;
  const current = await supabase
    .from("google_sheet_import_batches")
    .select("approved_rows, merged_rows, rejected_rows")
    .eq("id", batchId)
    .single();
  if (current.error || !current.data) return;
  const value = Number(current.data[field] ?? 0) + 1;
  await supabase.from("google_sheet_import_batches").update({ [field]: value }).eq("id", batchId);
}

export async function approveImport(
  supabase: SupabaseClient,
  importRow: {
    id: string;
    batch_id: string | null;
    normalized_data: FloodProneAreaInput | null;
    status: string;
  },
  performedBy = "admin",
) {
  if (importRow.status === "approved" || importRow.status === "merged") {
    throw new Error("This row has already been applied.");
  }
  if (!importRow.normalized_data) throw new Error("This row has no normalized data to approve.");
  const payload = productionPayload(importRow.normalized_data);
  const errors = validateFloodRecord(payload);
  if (errors.length > 0) throw new Error(errors.map((item) => item.message).join(" "));

  const inserted = await supabase.from("flood_prone_areas").insert(payload).select("id").single();
  if (inserted.error) {
    logFloodProneInsertError(importRow.id, inserted.error);
    const diagnostic = describeSupabaseError(inserted.error);
    if (/duplicate|unique/i.test(inserted.error.message)) {
      throw new Error(
        `An existing FloodWatch record already uses this region/DEO/municipality/barangay/road combination. Review and merge instead. ${diagnostic}`,
      );
    }
    throw new Error(diagnostic || inserted.error.message);
  }
  if (!inserted.data?.id) {
    logFloodProneInsertError(importRow.id, null, "Insert returned no row id.");
    throw new Error("Insert returned no row id.");
  }

  await writeAudit(supabase, {
    importId: importRow.id,
    batchId: importRow.batch_id,
    action: "approved",
    finalRecordId: inserted.data.id,
    afterData: payload,
    reason: "Approved as a new flood-prone area.",
    performedBy,
  });
  await markImport(supabase, importRow.id, "approved", performedBy, {
    matched_record_id: inserted.data.id,
  });
  await bumpBatch(supabase, importRow.batch_id, "approved_rows");
  return { id: inserted.data.id as string };
}

export async function mergeImport(
  supabase: SupabaseClient,
  importRow: {
    id: string;
    batch_id: string | null;
    normalized_data: FloodProneAreaInput | null;
    matched_record_id: string | null;
    status: string;
  },
  existing: FloodProneArea,
  selections: MergeFieldSelection[],
  performedBy = "admin",
  reason?: string,
) {
  if (!importRow.normalized_data) throw new Error("This row has no normalized data to merge.");
  const merged = buildMergedRecord(existing, importRow.normalized_data, selections);
  const errors = validateFloodRecord(merged);
  if (errors.length > 0) throw new Error(errors.map((item) => item.message).join(" "));

  const updated = await supabase
    .from("flood_prone_areas")
    .update(merged)
    .eq("id", existing.id)
    .select("id")
    .single();
  if (updated.error) throw new Error(updated.error.message);

  await writeAudit(supabase, {
    importId: importRow.id,
    batchId: importRow.batch_id,
    action: "merged",
    existingRecordId: existing.id,
    finalRecordId: existing.id,
    beforeData: existing,
    afterData: merged,
    reason: reason || "Merged selected Google Sheet values into the existing FloodWatch record.",
    performedBy,
  });
  await markImport(supabase, importRow.id, "merged", performedBy, {
    matched_record_id: existing.id,
  });
  await bumpBatch(supabase, importRow.batch_id, "merged_rows");
  return { id: existing.id, record: merged };
}

export async function rejectImport(
  supabase: SupabaseClient,
  importRow: { id: string; batch_id: string | null },
  performedBy = "admin",
  reason?: string,
) {
  await writeAudit(supabase, {
    importId: importRow.id,
    batchId: importRow.batch_id,
    action: "rejected",
    reason: reason || "Rejected; production data was not changed.",
    performedBy,
  });
  await markImport(supabase, importRow.id, "rejected", performedBy);
  await bumpBatch(supabase, importRow.batch_id, "rejected_rows");
}

export async function skipImport(
  supabase: SupabaseClient,
  importRow: { id: string; batch_id: string | null },
  performedBy = "admin",
  reason?: string,
) {
  await writeAudit(supabase, {
    importId: importRow.id,
    batchId: importRow.batch_id,
    action: "skipped",
    reason: reason || "Skipped for later review.",
    performedBy,
  });
  await markImport(supabase, importRow.id, "skipped", performedBy);
}
