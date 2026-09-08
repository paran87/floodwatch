import type { AreaGeometry, FloodProneArea, FloodProneAreaInput } from "@/lib/types";

export const IMPORT_STATUSES = [
  "pending",
  "new",
  "possible_duplicate",
  "duplicate",
  "error",
  "approved",
  "merged",
  "rejected",
  "skipped",
] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const DUPLICATE_TYPES = ["exact", "normalized", "fuzzy", "none"] as const;
export type DuplicateType = (typeof DUPLICATE_TYPES)[number];

export const BATCH_STATUSES = ["running", "completed", "failed", "partial"] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export type DuplicateThresholds = {
  likelyDuplicate: number;
  possibleDuplicate: number;
  reviewRecommended: number;
};

export const DEFAULT_DUPLICATE_THRESHOLDS: DuplicateThresholds = {
  likelyDuplicate: 0.9,
  possibleDuplicate: 0.75,
  reviewRecommended: 0.5,
};

export type NormalizedFloodRecord = FloodProneAreaInput;

export type ValidationIssue = {
  field: string;
  message: string;
};

export type DuplicateMatch = {
  record: FloodProneArea;
  confidence: number;
  type: DuplicateType;
  reasons: string[];
  fieldScores: Record<string, number>;
};

export type ProcessedImportRow = {
  sourceRowNumber: number;
  sourceRowHash: string;
  rawData: Record<string, string>;
  normalizedData: NormalizedFloodRecord | null;
  status: ImportStatus;
  duplicateType: DuplicateType | null;
  duplicateConfidence: number | null;
  matchedRecordId: string | null;
  aiReason: string | null;
  validationErrors: ValidationIssue[];
  warnings: string[];
};

export type GoogleSheetImportBatch = {
  id: string;
  source_spreadsheet_id: string;
  source_sheet_name: string;
  target_table: string;
  started_at: string;
  completed_at: string | null;
  total_rows: number;
  new_rows: number;
  duplicate_rows: number;
  possible_duplicate_rows: number;
  approved_rows: number;
  merged_rows: number;
  rejected_rows: number;
  error_rows: number;
  skipped_rows: number;
  status: string;
  error_message?: string | null;
  created_at: string;
};

export type GoogleSheetImport = {
  id: string;
  batch_id: string | null;
  source_spreadsheet_id: string;
  source_sheet_name: string;
  source_row_number: number;
  source_row_hash: string;
  target_table: string;
  raw_data: Record<string, string>;
  normalized_data: NormalizedFloodRecord | null;
  status: ImportStatus | string;
  duplicate_type: string | null;
  duplicate_confidence: number | null;
  matched_record_id: string | null;
  ai_reason: string | null;
  validation_errors: ValidationIssue[] | null;
  warnings: string[] | null;
  processed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  matched_record?: FloodProneArea | null;
};

export type ImportSummary = {
  success: boolean;
  batch_id: string;
  total_rows: number;
  new_rows: number;
  possible_duplicates: number;
  duplicates: number;
  errors: number;
  skipped_unchanged: number;
  status: string;
  header_row_number?: number;
  error?: string;
};

export type MergeFieldChoice = "existing" | "imported" | "custom";

export type MergeFieldSelection = {
  field: keyof FloodProneAreaInput;
  choice: MergeFieldChoice;
  customValue?: string | number | AreaGeometry | null;
};

export const MERGE_FIELDS: (keyof FloodProneAreaInput)[] = [
  "name",
  "address",
  "barangay",
  "city_municipality",
  "road_name",
  "road_length",
  "latitude",
  "longitude",
  "flood_status",
  "description",
  "geometry",
  "region",
  "deo",
  "location_source",
];
