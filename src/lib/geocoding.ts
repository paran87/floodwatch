import "server-only";
import type { LocationAccuracy } from "./types";
import type { GeocodeTier } from "./geocodeQuery";

/**
 * Nominatim (OpenStreetMap) geocoding client — server-only. Chosen over
 * Google's Geocoding API because it needs no API key or billing-enabled GCP
 * project (see CLAUDE.md §8/§11). Its usage policy
 * (https://operations.osmfoundation.org/policies/nominatim/) allows at most
 * 1 request per second and requires a descriptive User-Agent; this client
 * respects both, and is built to make that budget go as far as possible:
 *
 *  - Every request goes through ONE serial slot queue. (The previous
 *    timestamp throttle let two concurrent callers read the same "last
 *    request" time and fire together, breaking the 1/s rule.) A caller that
 *    has gone away (`signal` aborted) is skipped without spending a slot, so
 *    a fast-clicking user's latest selection isn't stuck behind stale ones.
 *  - Results are cached by query string — including "no result" — and
 *    concurrent identical queries share one request. Siblings in the same
 *    barangay/municipality/province therefore reuse the broad tiers and only
 *    pay for the one query that is unique to them.
 *  - Each request has a hard timeout so a slow provider can't hang a click.
 *  - Photon (komoot's public OpenStreetMap geocoder) is tried first: it has
 *    no 1-request-per-second rule and answered in ~0.25 s vs ~0.5 s plus a
 *    1.1 s gap for Nominatim, and matched more precise places on real sheet
 *    rows. Any Photon error/timeout falls back to Nominatim for that query,
 *    and after repeated failures Photon is skipped for a couple of minutes.
 *    Set GEOCODER=nominatim to turn Photon off. Both are best-effort public
 *    services — keep usage to the one-lookup-per-click this app does.
 */

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "FloodWatch/1.0 (https://github.com/paran87/floodwatch; flood-prone-area geocoding)";
const PHOTON_URL = "https://photon.komoot.io/api/";
const PHOTON_TIMEOUT_MS = 3500;
/** Philippines bounding box (west,south,east,north), so a fuzzy match can't land in another country. */
const PHOTON_BBOX = "116.9,4.5,126.7,21.2";
const PHOTON_MAX_FAILURES = 3;
const PHOTON_COOLDOWN_MS = 2 * 60 * 1000;
const MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 6000;
const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHED_QUERIES = 5000;

export interface GeocodeCandidate {
  latitude: number;
  longitude: number;
  displayName: string;
}

type LookupResult = { kind: "hit"; candidate: GeocodeCandidate } | { kind: "miss" } | { kind: "error"; message: string; isRateLimit: boolean };

export type GeocodeOutcome =
  | { status: "resolved"; candidate: GeocodeCandidate; queryUsed: string; accuracy: LocationAccuracy }
  | { status: "no_result" }
  | { status: "error"; message: string; isRateLimit: boolean }
  | { status: "aborted" };

interface Inflight {
  promise: Promise<LookupResult>;
  controller: AbortController;
  waiters: number;
}

interface State {
  chain: Promise<void>;
  lastStart: number;
  cache: Map<string, { at: number; candidate: GeocodeCandidate | null }>;
  inflight: Map<string, Inflight>;
  photonFailures: number;
  photonDisabledUntil: number;
}
// On globalThis so dev hot reloads keep the cache and the rate-limit clock.
const g = globalThis as unknown as { __nominatim?: State };
const state: State = (g.__nominatim ??= { chain: Promise.resolve(), lastStart: 0, cache: new Map(), inflight: new Map(), photonFailures: 0, photonDisabledUntil: 0 });

class Aborted extends Error {}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Aborted());
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Aborted());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Waits for this caller's turn at the shared 1-request-per-second budget. Rejects with Aborted if the caller left. */
function acquireSlot(signal?: AbortSignal): Promise<void> {
  const turn = state.chain.then(async () => {
    if (signal?.aborted) throw new Aborted();
    const wait = state.lastStart + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait, signal);
    state.lastStart = Date.now();
  });
  state.chain = turn.catch(() => undefined);
  return turn;
}

function remember(query: string, candidate: GeocodeCandidate | null) {
  if (state.cache.size >= MAX_CACHED_QUERIES) {
    // Maps iterate in insertion order, so this drops the oldest entry.
    const oldest = state.cache.keys().next().value;
    if (oldest !== undefined) state.cache.delete(oldest);
  }
  state.cache.set(query, { at: Date.now(), candidate });
}

async function requestNominatim(query: string, signal?: AbortSignal): Promise<LookupResult> {
  await acquireSlot(signal);
  try {
    const url = new URL(NOMINATIM_SEARCH_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ph");
    url.searchParams.set("q", query);

    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });

    if (response.status === 429) return { kind: "error", message: "Nominatim rate limit hit (HTTP 429).", isRateLimit: true };
    if (!response.ok) return { kind: "error", message: `Nominatim returned HTTP ${response.status}.`, isRateLimit: false };

    const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (results.length === 0) {
      remember(query, null);
      return { kind: "miss" };
    }
    const candidate = { latitude: Number(results[0].lat), longitude: Number(results[0].lon), displayName: results[0].display_name };
    remember(query, candidate);
    return { kind: "hit", candidate };
  } catch (err) {
    if (signal?.aborted) throw new Aborted();
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return { kind: "error", message: timedOut ? "Nominatim timed out." : err instanceof Error ? err.message : "Unknown network error calling Nominatim.", isRateLimit: false };
  }
}

async function requestPhoton(query: string, signal: AbortSignal): Promise<LookupResult> {
  try {
    const url = new URL(PHOTON_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "1");
    url.searchParams.set("lang", "en");
    url.searchParams.set("bbox", PHOTON_BBOX);

    const response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.any([signal, AbortSignal.timeout(PHOTON_TIMEOUT_MS)]),
    });
    if (response.status === 429) return { kind: "error", message: "Photon rate limit hit (HTTP 429).", isRateLimit: true };
    if (!response.ok) return { kind: "error", message: `Photon returned HTTP ${response.status}.`, isRateLimit: false };

    const body = (await response.json()) as {
      features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }>;
    };
    const feature = body.features?.[0];
    if (!feature) {
      remember(query, null);
      return { kind: "miss" };
    }
    const p = feature.properties;
    const displayName = [p.name, p.street, p.district, p.locality, p.city, p.county, p.state, p.country].filter(Boolean).join(", ");
    const candidate = { latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0], displayName };
    remember(query, candidate);
    return { kind: "hit", candidate };
  } catch (err) {
    if (signal.aborted) throw new Aborted();
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return { kind: "error", message: timedOut ? "Photon timed out." : err instanceof Error ? err.message : "Unknown network error calling Photon.", isRateLimit: false };
  }
}

const photonEnabled = () => process.env.GEOCODER !== "nominatim" && Date.now() >= state.photonDisabledUntil;

async function requestFresh(query: string, signal: AbortSignal): Promise<LookupResult> {
  if (photonEnabled()) {
    const result = await requestPhoton(query, signal);
    if (result.kind !== "error") {
      state.photonFailures = 0;
      return result;
    }
    console.warn("[geocoding] Photon failed, falling back to Nominatim:", result.message);
    if (++state.photonFailures >= PHOTON_MAX_FAILURES) {
      state.photonDisabledUntil = Date.now() + PHOTON_COOLDOWN_MS;
      state.photonFailures = 0;
    }
  }
  return requestNominatim(query, signal);
}

function lookup(query: string, signal?: AbortSignal): Promise<LookupResult> {
  const cached = state.cache.get(query);
  if (cached) {
    const fresh = Date.now() - cached.at < (cached.candidate ? HIT_TTL_MS : MISS_TTL_MS);
    if (fresh) return Promise.resolve(cached.candidate ? { kind: "hit", candidate: cached.candidate } : { kind: "miss" });
    state.cache.delete(query);
  }

  let flight = state.inflight.get(query);
  if (!flight) {
    // Shared between callers asking for the same query; cancelled only once every caller has gone away.
    const controller = new AbortController();
    const promise = requestFresh(query, controller.signal).finally(() => state.inflight.delete(query));
    flight = { promise, controller, waiters: 0 };
    state.inflight.set(query, flight);
  }
  const current = flight;
  current.waiters++;
  if (!signal) return current.promise;

  return new Promise<LookupResult>((resolve, reject) => {
    if (signal.aborted) {
      if (--current.waiters <= 0) current.controller.abort();
      return reject(new Aborted());
    }
    const onAbort = () => {
      if (--current.waiters <= 0) current.controller.abort();
      reject(new Aborted());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    current.promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * Tries each tier in order (most specific first), stopping at the first
 * that returns a result. Cached tiers cost nothing and never touch the rate
 * limit. An aborted caller stops immediately.
 */
export async function geocodeWithFallback(tiers: GeocodeTier[], options: { signal?: AbortSignal } = {}): Promise<GeocodeOutcome> {
  const { signal } = options;
  try {
    for (const tier of tiers) {
      if (signal?.aborted) return { status: "aborted" };
      const result = await lookup(tier.query, signal);
      if (result.kind === "hit") return { status: "resolved", candidate: result.candidate, queryUsed: tier.query, accuracy: tier.accuracy };
      if (result.kind === "error") return { status: "error", message: result.message, isRateLimit: result.isRateLimit };
      // miss: fall through to the next, broader tier
    }
    return { status: "no_result" };
  } catch (err) {
    if (err instanceof Aborted) return { status: "aborted" };
    throw err;
  }
}

/** The Sheet says "NCR"; OpenStreetMap says "Metro Manila". Without this every Metro Manila result was sent to manual review. */
const PROVINCE_ALIASES: Record<string, string[]> = {
  ncr: ["ncr", "metro manila", "national capital region"],
};

function mentionsProvince(displayName: string, province: string): boolean {
  const wanted = province.trim().toLowerCase();
  if (!wanted) return false;
  const text = displayName.toLowerCase();
  return (PROVINCE_ALIASES[wanted] ?? [wanted]).some((name) => text.includes(name));
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** "Las Piñas City" / "City of Las Piñas" / "Municipality of Juban (Capital)" → the bare place name, accent-free. */
function bareMunicipality(name: string): string {
  return plain(name)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(city of|municipality of|city|municipality)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mentionsMunicipality(displayName: string, municipality: string): boolean {
  const bare = bareMunicipality(municipality);
  return bare.length === 0 || plain(displayName).includes(bare);
}

export interface GeocodeClassification {
  accuracy: LocationAccuracy;
  needsReview: boolean;
  reason: string | null;
}

/**
 * Decides whether a Nominatim match is trustworthy enough to show as an
 * exact pin, or should go to manual review instead. Never returns a result
 * that silently claims more confidence than the data supports.
 */
export function classifyGeocodeResult(accuracy: LocationAccuracy, displayName: string, province: string, municipality = ""): GeocodeClassification {
  const provinceMatches = mentionsProvince(displayName, province);

  if (!provinceMatches) {
    return {
      accuracy,
      needsReview: true,
      reason: `Geocoder result ("${displayName}") doesn't clearly mention the expected province ("${province}") — needs manual confirmation.`,
    };
  }
  // A fuzzy match for a road or barangay can land in the right province but the wrong town.
  if ((accuracy === "road" || accuracy === "barangay") && municipality && !mentionsMunicipality(displayName, municipality)) {
    return {
      accuracy,
      needsReview: true,
      reason: `Geocoder result ("${displayName}") doesn't clearly mention the expected municipality/city ("${municipality}") — needs manual confirmation.`,
    };
  }
  if (accuracy === "municipality" || accuracy === "province" || accuracy === "region") {
    return {
      accuracy,
      needsReview: true,
      reason: `Only ${accuracy}-level location information was specific enough to geocode; the resulting point is approximate, not exact.`,
    };
  }
  return { accuracy, needsReview: false, reason: null };
}
