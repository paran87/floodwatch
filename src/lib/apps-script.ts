/**
 * Typed client for the Google Apps Script backend (the sole gateway to the
 * "Flood Prone Areas" Google Sheet). Every call goes through here — do not
 * scatter raw fetch() calls to the Apps Script URL anywhere else.
 *
 * SERVER-ONLY. The Apps Script web app is guarded by a shared-secret value
 * (APPS_SCRIPT_API_KEY) that must never reach the browser, so this module
 * may only be imported from Server Components and Route Handlers
 * (src/app/api/**). It travels as a query param, not a header — Apps
 * Script's doGet/doPost cannot read arbitrary request headers — see the
 * comment on the `apiKey` param below and apps-script/Auth.js. Client
 * Components call this app's own Next.js API routes instead — see
 * src/hooks/useFloodProneAreas.ts for the pattern.
 *
 * The Apps Script web app exposes a single endpoint that takes an `action`
 * parameter and routes internally (see apps-script/Code.js). GET is used for
 * reads, POST for writes, matching the doGet/doPost router.
 */
import "server-only";
import type {
  ApiResponse,
  FloodProneArea,
  FloodProneAreaFilters,
} from "./types";

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const APPS_SCRIPT_API_KEY = process.env.APPS_SCRIPT_API_KEY;

class AppsScriptError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AppsScriptError";
  }
}

function requireUrl(): string {
  if (!APPS_SCRIPT_URL) {
    throw new AppsScriptError(
      "APPS_SCRIPT_URL is not configured. Set it in .env.local once the Apps Script web app is deployed.",
      "CONFIG_MISSING",
    );
  }
  return APPS_SCRIPT_URL;
}

async function callAction<T>(
  action: string,
  params: Record<string, string | number | undefined> = {},
  options: { method?: "GET" | "POST"; body?: unknown; actorEmail?: string; actorRole?: string } = {},
): Promise<T> {
  const base = requireUrl();
  const url = new URL(base);
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  // Apps Script's doGet/doPost cannot read arbitrary request headers, only
  // `e.parameter` (query/form params) — so the shared secret and the
  // already-verified actor identity travel as params, not headers.
  url.searchParams.set("apiKey", APPS_SCRIPT_API_KEY ?? "");
  if (options.actorEmail) url.searchParams.set("actorEmail", options.actorEmail);
  if (options.actorRole) url.searchParams.set("actorRole", options.actorRole);

  const method = options.method ?? "GET";
  const init: RequestInit = {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
    cache: method === "GET" ? "no-store" : undefined,
  };

  // Apps Script web apps occasionally answer with an HTML error page ("a server error occurred", quota or
  // timeout pages) instead of JSON. Those are transient, so idempotent reads are retried a couple of times.
  // Writes are never retried (they might have gone through).
  const maxAttempts = method === "GET" ? 1 + RETRY_DELAYS_MS.length : 1;
  let lastError: AppsScriptError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await attemptCall<T>(url.toString(), init);
    if (result.ok) return result.data;
    lastError = result.error;
    if (!result.transient || attempt === maxAttempts) break;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
  }
  throw lastError ?? new AppsScriptError("The backend returned an unexpected response.", "BAD_RESPONSE");
}

const RETRY_DELAYS_MS = [400, 1200];
const REQUEST_TIMEOUT_MS = 40_000;

type AttemptResult<T> = { ok: true; data: T } | { ok: false; transient: boolean; error: AppsScriptError };

/** One request. Never logs the URL (it carries the shared secret) — only status, content type and a short body snippet. */
async function attemptCall<T>(url: string, init: RequestInit): Promise<AttemptResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    console.warn("[apps-script] request failed:", timedOut ? "timed out" : err instanceof Error ? err.message : err);
    return {
      ok: false,
      transient: true,
      error: new AppsScriptError(
        timedOut ? "The Sheets backend took too long to respond. Please try again." : "Could not reach the Apps Script backend. Check network connectivity and the deployment URL.",
        timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      ),
    };
  }

  const text = await response.text().catch(() => "");
  let json: ApiResponse<T> | null = null;
  try {
    json = JSON.parse(text) as ApiResponse<T>;
  } catch {
    /* not JSON — handled below */
  }

  if (json && typeof json === "object" && "success" in json) {
    if (json.success) return { ok: true, data: json.data };
    return { ok: false, transient: false, error: new AppsScriptError(json.message, json.code) }; // a real application error: retrying won't change it
  }

  const snippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  console.warn(`[apps-script] non-JSON response: status=${response.status} type=${response.headers.get("content-type")} body="${snippet}"`);

  if (/authori[sz]ation|sign in|accounts\.google\.com|consent/i.test(snippet)) {
    return { ok: false, transient: false, error: new AppsScriptError("The Apps Script web app needs to be re-authorised (see CLAUDE.md §11, gotcha 3).", "AUTH_REQUIRED") };
  }
  if (/too many times|quota|rate limit/i.test(snippet) || response.status === 429) {
    return { ok: false, transient: true, error: new AppsScriptError("Google is rate-limiting the Sheets backend. Please try again in a minute.", "RATE_LIMITED") };
  }
  if (/maximum execution time|timed out/i.test(snippet)) {
    return { ok: false, transient: true, error: new AppsScriptError("The Sheets backend took too long to respond. Please try again.", "TIMEOUT") };
  }
  return {
    ok: false,
    transient: true,
    error: new AppsScriptError("Google Sheets is temporarily unavailable (the backend returned an error page). Please try again in a moment.", "BAD_RESPONSE"),
  };
}

export async function getFloodProneAreas(
  filters: FloodProneAreaFilters = {},
): Promise<{ items: FloodProneArea[]; total: number }> {
  return callAction("getFloodProneAreas", {
    search: filters.search,
    region: filters.region,
    province: filters.province,
    municipalityCity: filters.municipalityCity,
    barangay: filters.barangay,
    deo: filters.deo,
    accuracy: filters.accuracy,
    page: filters.page,
    pageSize: filters.pageSize,
  });
}

export async function getFloodProneArea(rowIndex: number): Promise<FloodProneArea> {
  return callAction("getFloodProneArea", { rowIndex });
}

export async function searchFloodProneAreas(query: string): Promise<FloodProneArea[]> {
  const result = await callAction<{ items: FloodProneArea[]; total: number }>("getFloodProneAreas", { search: query, pageSize: 50 });
  return result.items;
}

export async function getFloodProneAreaFacets(): Promise<{
  regions: string[];
  provinces: string[];
  municipalities: string[];
  barangays: string[];
  deos: string[];
}> {
  return callAction("getFloodProneAreaFacets");
}

export { AppsScriptError };
