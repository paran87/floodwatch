/**
 * Typed client for the Google Apps Script backend (the sole gateway to the
 * "Flood Prone Areas" Google Sheet). Every call goes through here — do not
 * scatter raw fetch() calls to the Apps Script URL anywhere else.
 *
 * SERVER-ONLY. The Apps Script web app is guarded by a shared-secret header
 * (APPS_SCRIPT_API_KEY) that must never reach the browser, so this module
 * may only be imported from Server Components and Route Handlers
 * (src/app/api/**). Client Components call those Next.js API routes
 * instead — see src/hooks/useFloodProneAreas.ts for the pattern.
 *
 * The Apps Script web app exposes a single endpoint that takes an `action`
 * parameter and routes internally (see apps-script/Code.js). GET is used for
 * reads, POST for writes, matching the doGet/doPost router.
 */
import "server-only";
import type {
  ApiResponse,
  DashboardStats,
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
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
      cache: method === "GET" ? "no-store" : undefined,
    });
  } catch {
    throw new AppsScriptError("Could not reach the Apps Script backend. Check network connectivity and the deployment URL.", "NETWORK_ERROR");
  }

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new AppsScriptError("The backend returned an unexpected response.", "BAD_RESPONSE");
  }

  if (!json.success) {
    throw new AppsScriptError(json.message, json.code);
  }
  return json.data;
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

export async function getDashboardStats(): Promise<DashboardStats> {
  return callAction("getDashboardStats");
}

export { AppsScriptError };
