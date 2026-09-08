import type { AiClient } from "@/lib/ai/client";
import { aiDuplicateReason } from "@/lib/ai/duplicate-analyzer";
import { aiNormalizeRecord } from "@/lib/ai/normalizer";
import { hashSourceRow } from "@/lib/google-sheets/hash";
import type { SpreadsheetRead } from "@/lib/google-sheets/reader";
import {
  classifyDuplicate,
  findDuplicate,
} from "@/lib/import/duplicate-detector";
import { normalizeMappedFields } from "@/lib/import/normalizer";
import { currentSectionRegion, isRegionSectionRow, withInheritedRegion } from "@/lib/import/region-carry";
import type {
  GoogleSheetImport,
  ImportSummary,
  ProcessedImportRow,
} from "@/lib/import/types";
import { DEFAULT_DUPLICATE_THRESHOLDS } from "@/lib/import/types";
import { validateFloodRecord } from "@/lib/import/validator";
import type { FloodProneArea } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ExistingImportRow = Pick<
  GoogleSheetImport,
  "id" | "source_row_number" | "source_row_hash" | "status"
>;

export type ImportProcessorDeps = {
  supabase: SupabaseClient;
  readSheet: () => Promise<SpreadsheetRead>;
  ai?: AiClient | null;
  targetTable?: string;
  force?: boolean;
  syncIntervalMinutes?: number;
  now?: () => Date;
};

export async function processSheetRows(options: {
  headers: string[];
  rows: Array<{ rowNumber: number; raw: Record<string, string>; hash?: string }>;
  existingAreas: FloodProneArea[];
  previousImports: ExistingImportRow[];
  ai?: AiClient | null;
  headerRowNumber?: number;
}): Promise<{ processed: ProcessedImportRow[]; skippedUnchanged: number }> {
  const previousByRow = new Map(options.previousImports.map((row) => [row.source_row_number, row]));
  const processed: ProcessedImportRow[] = [];
  let skippedUnchanged = 0;
  let inheritedRegion: string | null = null;

  for (const row of options.rows) {
    if (isRegionSectionRow(options.headers, row.raw)) {
      inheritedRegion = currentSectionRegion(options.headers, row.raw) ?? inheritedRegion;
      continue;
    }

    const explicitRegion = currentSectionRegion(options.headers, row.raw);
    if (explicitRegion) inheritedRegion = explicitRegion;

    const hash = row.hash ?? hashSourceRow(row.raw);
    const previous = previousByRow.get(row.rowNumber);
    if (previous && previous.source_row_hash === hash) {
      skippedUnchanged += 1;
      continue;
    }

    const mapped = withInheritedRegion(options.headers, row.raw, inheritedRegion);
    let { record, warnings } = normalizeMappedFields(mapped.mapped);
    if (options.headerRowNumber) {
      warnings.unshift(`Column headers taken from sheet row ${options.headerRowNumber}.`);
    }
    if (mapped.inherited && inheritedRegion) {
      warnings.push(`Region inherited from section header (${inheritedRegion}).`);
    }

    if (mapped.unmappedHeaders.length > 0) {
      warnings.push(`Unmapped columns: ${mapped.unmappedHeaders.join(", ")}.`);
    }

    if (options.ai && mapped.unmappedHeaders.length > 0) {
      try {
        const aiResult = await aiNormalizeRecord(options.ai, mapped.mapped, record, row.raw);
        record = aiResult.record;
        warnings = [...warnings, ...aiResult.warnings];
      } catch (error) {
        warnings.push(
          `AI normalization failed; deterministic values were kept. ${
            error instanceof Error ? error.message : ""
          }`.trim(),
        );
      }
    }

    const validationErrors = validateFloodRecord(record);
    if (validationErrors.length > 0) {
      processed.push({
        sourceRowNumber: row.rowNumber,
        sourceRowHash: hash,
        rawData: row.raw,
        normalizedData: record,
        status: "error",
        duplicateType: null,
        duplicateConfidence: null,
        matchedRecordId: null,
        aiReason: null,
        validationErrors,
        warnings,
      });
      continue;
    }

    const match = findDuplicate(record, options.existingAreas, DEFAULT_DUPLICATE_THRESHOLDS);
    if (!match) {
      processed.push({
        sourceRowNumber: row.rowNumber,
        sourceRowHash: hash,
        rawData: row.raw,
        normalizedData: record,
        status: "new",
        duplicateType: "none",
        duplicateConfidence: null,
        matchedRecordId: null,
        aiReason: null,
        validationErrors: [],
        warnings,
      });
      continue;
    }

    const status = classifyDuplicate(match.confidence, match.type);
    let aiReason = match.reasons.join(" ");
    const ambiguous = status === "possible_duplicate";
    if (ambiguous && options.ai) {
      try {
        aiReason = (await aiDuplicateReason(options.ai, record, match)) || aiReason;
      } catch {
        warnings.push("AI duplicate analysis failed; the deterministic comparison reason was kept.");
      }
    }

    processed.push({
      sourceRowNumber: row.rowNumber,
      sourceRowHash: hash,
      rawData: row.raw,
      normalizedData: record,
      status,
      duplicateType: match.type,
      duplicateConfidence: Number(match.confidence.toFixed(4)),
      matchedRecordId: match.record.id,
      aiReason,
      validationErrors: [],
      warnings,
    });
  }

  return { processed, skippedUnchanged };
}

export async function runGoogleSheetImport(deps: ImportProcessorDeps): Promise<ImportSummary> {
  const now = deps.now?.() ?? new Date();
  const targetTable = deps.targetTable ?? "flood_prone_areas";
  if (targetTable !== "flood_prone_areas") {
    throw new Error(`Target table "${targetTable}" is not enabled yet. Use flood_prone_areas.`);
  }

  const intervalMs = (deps.syncIntervalMinutes ?? 5) * 60 * 1000;
  if (!deps.force) {
    const latest = await deps.supabase
      .from("google_sheet_import_batches")
      .select("started_at,status")
      .eq("target_table", targetTable)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.data?.started_at) {
      const elapsed = now.getTime() - new Date(latest.data.started_at).getTime();
      if (elapsed < intervalMs && latest.data.status !== "failed") {
        return {
          success: true,
          batch_id: "",
          total_rows: 0,
          new_rows: 0,
          possible_duplicates: 0,
          duplicates: 0,
          errors: 0,
          skipped_unchanged: 0,
          status: "skipped",
          error: "Sync skipped because the configured interval has not elapsed. Use Sync Now to force.",
        };
      }
    }
  }

  const sheet = await deps.readSheet();
  const batchInsert = await deps.supabase
    .from("google_sheet_import_batches")
    .insert({
      source_spreadsheet_id: sheet.spreadsheetId,
      source_sheet_name: sheet.sheetName,
      target_table: targetTable,
      status: "running",
      total_rows: sheet.rows.length,
      started_at: now.toISOString(),
    })
    .select("id")
    .single();
  if (batchInsert.error || !batchInsert.data) {
    throw new Error(batchInsert.error?.message || "Unable to create import batch.");
  }
  const batchId = batchInsert.data.id as string;

  try {
    const areasResult = await deps.supabase
      .from("flood_prone_areas")
      .select(
        "id,name,address,barangay,city_municipality,road_name,road_length,latitude,longitude,flood_status,description,geometry,region,deo,location_source,created_at,updated_at",
      );
    if (areasResult.error) throw new Error(areasResult.error.message);

    const previousResult = await deps.supabase
      .from("google_sheet_imports")
      .select("id,source_row_number,source_row_hash,status")
      .eq("source_spreadsheet_id", sheet.spreadsheetId)
      .eq("source_sheet_name", sheet.sheetName)
      .eq("target_table", targetTable);
    if (previousResult.error) throw new Error(previousResult.error.message);

    const { processed, skippedUnchanged } = await processSheetRows({
      headers: sheet.headers,
      rows: sheet.rows,
      existingAreas: (areasResult.data ?? []) as FloodProneArea[],
      previousImports: (previousResult.data ?? []) as ExistingImportRow[],
      ai: deps.ai ?? null,
      headerRowNumber: sheet.headerRowNumber,
    });

    for (const row of processed) {
      const payload = {
        batch_id: batchId,
        source_spreadsheet_id: sheet.spreadsheetId,
        source_sheet_name: sheet.sheetName,
        source_row_number: row.sourceRowNumber,
        source_row_hash: row.sourceRowHash,
        target_table: targetTable,
        raw_data: row.rawData,
        normalized_data: row.normalizedData,
        status: row.status,
        duplicate_type: row.duplicateType,
        duplicate_confidence: row.duplicateConfidence,
        matched_record_id: row.matchedRecordId,
        ai_reason: row.aiReason,
        validation_errors: row.validationErrors,
        warnings: row.warnings,
        processed_at: now.toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      };
      const { error } = await deps.supabase
        .from("google_sheet_imports")
        .upsert(payload, { onConflict: "source_spreadsheet_id,source_sheet_name,source_row_number" });
      if (error) throw new Error(error.message);
    }

    const newRows = processed.filter((row) => row.status === "new").length;
    const duplicates = processed.filter((row) => row.status === "duplicate").length;
    const possible = processed.filter((row) => row.status === "possible_duplicate").length;
    const errors = processed.filter((row) => row.status === "error").length;
    const status = errors > 0 && processed.length > errors ? "partial" : errors > 0 && processed.length === errors ? "failed" : "completed";

    await deps.supabase
      .from("google_sheet_import_batches")
      .update({
        completed_at: (deps.now?.() ?? new Date()).toISOString(),
        total_rows: sheet.rows.length,
        new_rows: newRows,
        duplicate_rows: duplicates,
        possible_duplicate_rows: possible,
        error_rows: errors,
        skipped_rows: skippedUnchanged,
        status,
      })
      .eq("id", batchId);

    return {
      success: true,
      batch_id: batchId,
      total_rows: sheet.rows.length,
      new_rows: newRows,
      possible_duplicates: possible,
      duplicates,
      errors,
      skipped_unchanged: skippedUnchanged,
      status,
      header_row_number: sheet.headerRowNumber,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    await deps.supabase
      .from("google_sheet_import_batches")
      .update({
        completed_at: (deps.now?.() ?? new Date()).toISOString(),
        status: "failed",
        error_message: message,
      })
      .eq("id", batchId);
    return {
      success: false,
      batch_id: batchId,
      total_rows: 0,
      new_rows: 0,
      possible_duplicates: 0,
      duplicates: 0,
      errors: 0,
      skipped_unchanged: 0,
      status: "failed",
      error: message,
    };
  }
}
