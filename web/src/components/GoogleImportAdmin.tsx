"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  GitMerge,
  RefreshCw,
  Search,
  SkipForward,
  X,
} from "lucide-react";
import { Atmosphere } from "@/components/Atmosphere";
import { BrandMark } from "@/components/BrandMark";
import { displayText } from "@/lib/import/normalizer";
import { isReviewSuccess, reviewFailureMessage } from "@/lib/import/review-error";
import { MERGE_FIELDS, type GoogleSheetImport, type GoogleSheetImportBatch, type MergeFieldSelection } from "@/lib/import/types";
import type { FloodProneAreaInput } from "@/lib/types";

type Theme = "dark" | "light";
type StatusFilter =
  | "all"
  | "new"
  | "possible_duplicate"
  | "duplicate"
  | "error"
  | "approved"
  | "merged"
  | "rejected"
  | "skipped";

type ConfigResponse = {
  spreadsheetId?: string;
  spreadsheetConfigured?: boolean;
  sheetName?: string;
  targetTable?: string;
  syncIntervalMinutes?: number;
  aiEnabled?: boolean;
  latestBatch?: GoogleSheetImportBatch | null;
  error?: string | null;
};

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "possible_duplicate", label: "Possible Duplicate" },
  { id: "duplicate", label: "Duplicate" },
  { id: "error", label: "Error" },
  { id: "approved", label: "Approved" },
  { id: "merged", label: "Merged" },
  { id: "rejected", label: "Rejected" },
  { id: "skipped", label: "Skipped" },
];

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  address: "Address",
  barangay: "Barangay",
  city_municipality: "Municipality",
  road_name: "Road",
  road_length: "Road length",
  latitude: "Latitude",
  longitude: "Longitude",
  flood_status: "Flood status",
  description: "Description",
  geometry: "Geometry",
  region: "Region",
  deo: "DEO",
  location_source: "Location source",
};

function statusClass(status: string) {
  if (status === "new") return "status-pill status-pill-low";
  if (status === "possible_duplicate") return "status-pill status-pill-moderate";
  if (status === "duplicate") return "status-pill status-pill-critical";
  if (status === "error") return "status-pill status-pill-critical";
  if (status === "approved" || status === "merged") return "status-pill status-pill-low";
  return "status-pill status-pill-moderate";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function normalizedValue(row: GoogleSheetImport, field: keyof FloodProneAreaInput) {
  return row.normalized_data?.[field] ?? null;
}

export function GoogleImportAdmin() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [batches, setBatches] = useState<GoogleSheetImportBatch[]>([]);
  const [rows, setRows] = useState<GoogleSheetImport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [batchId, setBatchId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState<GoogleSheetImport | null>(null);
  const [choices, setChoices] = useState<Record<string, MergeFieldSelection["choice"]>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    const stored = window.localStorage.getItem("floodwatch-theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.classList.toggle("light", stored === "light");
    }
  }, []);

  const loadConfig = useCallback(async () => {
    const response = await fetch("/api/google-sheets/config");
    const payload = await response.json();
    setConfig(payload);
    return payload as ConfigResponse;
  }, []);

  const loadBatches = useCallback(async () => {
    const response = await fetch("/api/google-sheets/batches");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load import history.");
    setBatches(payload.batches ?? []);
  }, []);

  const loadRows = useCallback(async () => {
    const params = new URLSearchParams({
      status,
      page: String(page),
      page_size: "25",
    });
    if (query.trim()) params.set("q", query.trim());
    if (batchId) params.set("batch_id", batchId);
    const response = await fetch(`/api/google-sheets/imports?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load import rows.");
    setRows(payload.imports ?? []);
    setTotal(payload.total ?? 0);
    setSelected([]);
  }, [status, page, query, batchId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadConfig(), loadBatches(), loadRows()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load importer.");
    } finally {
      setLoading(false);
    }
  }, [loadBatches, loadConfig, loadRows]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const latest = config?.latestBatch ?? batches[0] ?? null;
  const pageCount = Math.max(1, Math.ceil(total / 25));

  const openReview = (row: GoogleSheetImport) => {
    setReviewing(row);
    const initial: Record<string, MergeFieldSelection["choice"]> = {};
    for (const field of MERGE_FIELDS) initial[field] = "imported";
    setChoices(initial);
    setCustomValues({});
  };

  const mergedPreview = useMemo(() => {
    if (!reviewing?.normalized_data) return null;
    const existing = reviewing.matched_record;
    const imported = reviewing.normalized_data;
    const next: Record<string, unknown> = {};
    for (const field of MERGE_FIELDS) {
      const choice = choices[field] ?? "imported";
      if (choice === "existing") next[field] = existing?.[field] ?? null;
      else if (choice === "custom") next[field] = customValues[field] ?? "";
      else next[field] = imported[field];
    }
    return next;
  }, [choices, customValues, reviewing]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/google-sheets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || "Sync failed.");
      }
      showToast(
        `Synced ${payload.total_rows} rows · ${payload.new_rows} new · ${payload.possible_duplicates} possible duplicates`,
      );
      await loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const reviewAction = async (
    action: "approve" | "reject" | "skip" | "merge",
    ids: string[],
    extra: Record<string, unknown> = {},
  ) => {
    setActing(true);
    try {
      const response = await fetch("/api/google-sheets/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, import_ids: ids, performed_by: "admin", ...extra }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        results?: Array<{ id?: string; ok?: boolean; error?: string }>;
      };
      if (!isReviewSuccess(response.ok, payload)) {
        setActionError(reviewFailureMessage(payload));
        return;
      }
      setActionError(null);
      showToast(action === "approve" ? "Approved into FloodWatch." : action === "merge" ? "Merged into FloodWatch." : "Updated.");
      setReviewing(null);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActing(false);
    }
  };

  const submitMerge = async () => {
    if (!reviewing) return;
    const field_choices: MergeFieldSelection[] = MERGE_FIELDS.map((field) => ({
      field,
      choice: choices[field] ?? "imported",
      customValue: customValues[field] ?? null,
    }));
    await reviewAction("merge", [reviewing.id], {
      existing_record_id: reviewing.matched_record_id,
      field_choices,
      reason: reviewing.ai_reason,
    });
  };

  return (
    <div className={`app-shell ${theme === "light" ? "light" : ""}`}>
      <Atmosphere />
      <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col px-3 py-3 md:px-5">
        <header className="hero-panel glass-panel mb-3 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BrandMark />
              <div>
                <p className="kicker">Floodwatch</p>
                <h1 className="display-title text-2xl italic">Google Sheet import</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/" className="btn btn-ghost px-3 py-1.5 text-sm">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
              <button className="btn btn-primary px-3 py-1.5 text-sm" onClick={() => void runSync()} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          </div>
        </header>

        {actionError ? (
          <div className="glass-panel mb-3 rounded-2xl p-4 text-sm" role="alert">
            <p className="font-semibold text-[#fb7185]">Review action failed</p>
            <p className="mt-1 whitespace-pre-wrap text-[#fb7185]">{actionError}</p>
            <button type="button" className="btn btn-ghost mt-3" onClick={() => setActionError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="glass-panel mb-3 rounded-2xl p-4 text-sm">
            <p className="font-semibold text-[#fb7185]">Importer is not ready</p>
            <p className="mt-1 text-muted">{error}</p>
            {config?.error ? <p className="mt-1 text-muted">{config.error}</p> : null}
            <button
              className="btn btn-ghost mt-3"
              onClick={async () => {
                try {
                  const response = await fetch("/api/setup/import-schema");
                  const sql = await response.text();
                  await navigator.clipboard.writeText(sql);
                  showToast("Import table SQL copied. Paste it in the FloodWatch Supabase SQL editor.");
                } catch {
                  showToast("Could not copy the import SQL.");
                }
              }}
            >
              Copy import table SQL
            </button>
          </div>
        ) : null}

        <section className="mb-3 grid gap-3 lg:grid-cols-2">
          <article className="glass-panel rounded-2xl p-4">
            <p className="kicker">Google Sheet configuration</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Spreadsheet</dt>
                <dd>{config?.spreadsheetConfigured ? config.spreadsheetId : "Not configured"}</dd>
              </div>
              <div>
                <dt className="text-muted">Worksheet</dt>
                <dd>{config?.sheetName || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Target</dt>
                <dd>{config?.targetTable || "flood_prone_areas"}</dd>
              </div>
              <div>
                <dt className="text-muted">Last sync</dt>
                <dd>{latest?.started_at ? new Date(latest.started_at).toLocaleString() : "Never"}</dd>
              </div>
              <div>
                <dt className="text-muted">Sync status</dt>
                <dd>{latest?.status || "idle"}</dd>
              </div>
              <div>
                <dt className="text-muted">Schedule</dt>
                <dd>Every {config?.syncIntervalMinutes ?? 5} minutes</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              AI assist is {config?.aiEnabled ? "enabled" : "off (deterministic mapping only)"}.
            </p>
          </article>

          <article className="glass-panel rounded-2xl p-4">
            <p className="kicker">Latest import</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[
                ["Total rows", latest?.total_rows ?? 0],
                ["New", latest?.new_rows ?? 0],
                ["Possible duplicates", latest?.possible_duplicate_rows ?? 0],
                ["Duplicates", latest?.duplicate_rows ?? 0],
                ["Errors", latest?.error_rows ?? 0],
                ["Approved", latest?.approved_rows ?? 0],
                ["Merged", latest?.merged_rows ?? 0],
                ["Skipped", latest?.skipped_rows ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-[var(--line)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
                  <p className="display-title text-xl italic">{value}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="glass-panel mb-3 rounded-2xl p-4">
          <p className="kicker">Import history</p>
          <div className="data-table-wrap mt-3 overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Spreadsheet</th>
                  <th>Worksheet</th>
                  <th>Target</th>
                  <th>Total</th>
                  <th>New</th>
                  <th>Duplicates</th>
                  <th>Possible</th>
                  <th>Errors</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-muted">
                      No imports yet.
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className={batchId === batch.id ? "is-selected" : undefined}
                      onClick={() => {
                        setBatchId(batch.id);
                        setPage(1);
                      }}
                    >
                      <td>{new Date(batch.started_at).toLocaleString()}</td>
                      <td className="max-w-[8rem] truncate">{batch.source_spreadsheet_id}</td>
                      <td>{batch.source_sheet_name}</td>
                      <td>{batch.target_table}</td>
                      <td>{batch.total_rows}</td>
                      <td>{batch.new_rows}</td>
                      <td>{batch.duplicate_rows}</td>
                      <td>{batch.possible_duplicate_rows}</td>
                      <td>{batch.error_rows}</td>
                      <td>
                        <span className={statusClass(batch.status)}>{batch.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass-panel min-h-0 flex-1 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="kicker">Review queue</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-primary px-3 py-1.5 text-xs"
                disabled={selected.length === 0 || acting}
                onClick={() => void reviewAction("approve", selected)}
              >
                <Check className="h-3.5 w-3.5" />
                Approve selected
              </button>
              <button
                className="btn btn-danger px-3 py-1.5 text-xs"
                disabled={selected.length === 0 || acting}
                onClick={() => void reviewAction("reject", selected)}
              >
                <X className="h-3.5 w-3.5" />
                Reject selected
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div className="search-field">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search municipality, barangay, road, DEO, region"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`panel-tab ${status === item.id ? "is-active" : ""}`}
                  onClick={() => {
                    setStatus(item.id);
                    setPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
              {batchId ? (
                <button
                  type="button"
                  className="panel-tab"
                  onClick={() => {
                    setBatchId("");
                    setPage(1);
                  }}
                >
                  Clear batch filter
                </button>
              ) : null}
            </div>
          </div>

          <div className="data-table-wrap mt-3 overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={(event) => {
                        setSelected(event.target.checked ? rows.map((row) => row.id) : []);
                      }}
                      aria-label="Select all visible rows"
                    />
                  </th>
                  <th>Status</th>
                  <th>Row</th>
                  <th>Municipality</th>
                  <th>Barangay</th>
                  <th>Road</th>
                  <th>Match</th>
                  <th>Confidence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-muted">
                      No imported rows match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={(event) => {
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, row.id]
                                : current.filter((id) => id !== row.id),
                            );
                          }}
                          aria-label={`Select row ${row.source_row_number}`}
                        />
                      </td>
                      <td>
                        <span className={statusClass(row.status)}>{statusLabel(row.status)}</span>
                      </td>
                      <td>{row.source_row_number}</td>
                      <td>{displayText(normalizedValue(row, "city_municipality"))}</td>
                      <td>{displayText(normalizedValue(row, "barangay"))}</td>
                      <td>{displayText(normalizedValue(row, "road_name"))}</td>
                      <td>{row.matched_record_id ? row.matched_record_id.slice(0, 8) : "—"}</td>
                      <td>
                        {row.duplicate_confidence == null
                          ? "—"
                          : `${Math.round(Number(row.duplicate_confidence) * 100)}%`}
                      </td>
                      <td>
                        {row.status === "new" ? (
                          <button
                            type="button"
                            className="table-btn table-btn-edit"
                            onClick={() => void reviewAction("approve", [row.id])}
                          >
                            Approve
                          </button>
                        ) : row.status === "error" ? (
                          <button type="button" className="table-btn table-btn-delete" onClick={() => openReview(row)}>
                            Fix
                          </button>
                        ) : row.status === "possible_duplicate" || row.status === "duplicate" ? (
                          <button type="button" className="table-btn table-btn-edit" onClick={() => openReview(row)}>
                            Review
                          </button>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <p>
              {total} rows · page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <button className="btn btn-ghost px-3 py-1 text-xs" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </button>
              <button
                className="btn btn-ghost px-3 py-1 text-xs"
                disabled={page >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {reviewing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 py-3 backdrop-blur-sm md:items-center">
          <div className="glass-panel max-h-[92dvh] w-full max-w-5xl overflow-auto rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kicker">Review</p>
                <h2 className="display-title text-2xl">Sheet row {reviewing.source_row_number}</h2>
              </div>
              <button className="btn btn-ghost px-3" onClick={() => setReviewing(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {reviewing.validation_errors && reviewing.validation_errors.length > 0 ? (
              <div className="mt-3 rounded-xl border border-[rgba(225,29,72,0.3)] p-3 text-sm text-[#fb7185]">
                {reviewing.validation_errors.map((item) => item.message).join(" ")}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-[var(--line)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-teal">Imported Google Sheet record</p>
                {MERGE_FIELDS.filter((field) => field !== "geometry").map((field) => (
                  <p key={field} className="mt-2 text-sm">
                    <span className="text-muted">{FIELD_LABELS[field]}:</span>{" "}
                    {displayText(reviewing.normalized_data?.[field])}
                  </p>
                ))}
              </article>
              <article className="rounded-2xl border border-[var(--line)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-teal">Existing Supabase record</p>
                {reviewing.matched_record ? (
                  MERGE_FIELDS.filter((field) => field !== "geometry").map((field) => (
                    <p key={field} className="mt-2 text-sm">
                      <span className="text-muted">{FIELD_LABELS[field]}:</span>{" "}
                      {displayText(reviewing.matched_record?.[field])}
                    </p>
                  ))
                ) : (
                  <p className="mt-2 text-sm text-muted">No matched production record.</p>
                )}
              </article>
            </div>

            <p className="mt-4 text-sm">
              AI duplicate confidence:{" "}
              <strong>
                {reviewing.duplicate_confidence == null
                  ? "—"
                  : `${Math.round(Number(reviewing.duplicate_confidence) * 100)}%`}
              </strong>
            </p>
            <p className="mt-1 text-sm text-muted">{reviewing.ai_reason || "No comparison reason stored."}</p>

            {reviewing.matched_record ? (
              <div className="mt-4 overflow-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Existing</th>
                      <th>Imported</th>
                      <th>Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MERGE_FIELDS.filter((field) => field !== "geometry").map((field) => (
                      <tr key={field}>
                        <td>{FIELD_LABELS[field]}</td>
                        <td>{displayText(reviewing.matched_record?.[field])}</td>
                        <td>{displayText(reviewing.normalized_data?.[field])}</td>
                        <td>
                          <select
                            className="field"
                            value={choices[field] ?? "imported"}
                            onChange={(event) =>
                              setChoices((current) => ({
                                ...current,
                                [field]: event.target.value as MergeFieldSelection["choice"],
                              }))
                            }
                          >
                            <option value="existing">Use existing</option>
                            <option value="imported">Use imported</option>
                            <option value="custom">Custom</option>
                          </select>
                          {choices[field] === "custom" ? (
                            <input
                              className="field mt-2"
                              value={customValues[field] ?? ""}
                              onChange={(event) =>
                                setCustomValues((current) => ({ ...current, [field]: event.target.value }))
                              }
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 rounded-xl border border-[var(--line)] p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Final merged record</p>
                  {mergedPreview
                    ? MERGE_FIELDS.filter((field) => field !== "geometry").map((field) => (
                        <p key={field} className="mt-1">
                          <span className="text-muted">{FIELD_LABELS[field]}:</span> {displayText(mergedPreview[field])}
                        </p>
                      ))
                    : null}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {reviewing.matched_record ? (
                <button className="btn btn-primary" disabled={acting} onClick={() => void submitMerge()}>
                  <GitMerge className="h-4 w-4" />
                  Merge
                </button>
              ) : null}
              <button
                className="btn btn-primary"
                disabled={acting || reviewing.status === "error"}
                onClick={() => void reviewAction("approve", [reviewing.id])}
              >
                <Check className="h-4 w-4" />
                Approve as new
              </button>
              <button className="btn btn-danger" disabled={acting} onClick={() => void reviewAction("reject", [reviewing.id])}>
                <X className="h-4 w-4" />
                Reject
              </button>
              <button className="btn btn-ghost" disabled={acting} onClick={() => void reviewAction("skip", [reviewing.id])}>
                <SkipForward className="h-4 w-4" />
                Skip
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[rgba(16,40,36,0.92)] px-4 py-2 text-sm text-[#86efac] shadow-[var(--shadow)]">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
