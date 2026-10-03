/**
 * Core domain types for FloodWatch.
 *
 * IMPORTANT: `FloodProneAreaRaw` mirrors the ACTUAL columns discovered in the
 * "Flood Prone Areas" Google Sheet (sheet tab "FLOOD PRONE") during initial
 * inspection on 2026-10-02. Do not add fields here that are not backed by a
 * real column — if the Sheet schema changes, update this file to match it,
 * not the other way around.
 *
 * Discovered columns (row 2, header row; row 1 is a merged title row):
 *   A: Region
 *   B: Province
 *   C: Municipality/City
 *   D: DEO
 *   E: Barangay
 *   F: Road Name/Waterways
 *   G: KM Station Limit
 *   H: Latitude
 *   I: Longitude
 *
 * Data rows: 3–1766 (~1,763 records). Columns J–N exist in the sheet's grid
 * but are completely empty and unused.
 *
 * Known data-shape quirks (see CLAUDE.md "Google Sheets Data Model"):
 *   - `region` is forward-filled visually (merged cells) but stored as a
 *     blank string on repeat rows. Consumers must carry the last non-blank
 *     region forward when grouping/displaying.
 *   - Every record currently has blank Latitude/Longitude (0 of ~1,763).
 *   - A few records (observed: 3) have a "lat, lng" pair typed into the
 *     `kmStationLimit` column by mistake. LocationResolver treats these as a
 *     low-confidence hint, never as authoritative, and never rewrites the
 *     sheet to "fix" them.
 */

export type LocationAccuracy =
  | "exact"
  | "address"
  | "road"
  | "barangay"
  | "municipality"
  | "province"
  | "region"
  | "unresolved";

export type LocationSource =
  | "existing_coordinates"
  | "geocoded"
  | "manually_verified"
  | "approximate"
  | "unresolved";

export type GeocodingStatus =
  | "not_attempted"
  | "pending"
  | "resolved"
  | "needs_review"
  | "failed";

/** Exact shape of one data row from the "FLOOD PRONE" sheet tab, header-mapped. */
export interface FloodProneAreaRaw {
  /** Synthetic id derived from the sheet row number (1-based data index). Not a sheet column. */
  rowIndex: number;
  region: string;
  province: string;
  municipalityCity: string;
  deo: string;
  barangay: string;
  roadNameWaterways: string;
  kmStationLimit: string;
  /** Raw sheet value. Blank for ~100% of current records. Never invented. */
  latitude: number | null;
  /** Raw sheet value. Blank for ~100% of current records. Never invented. */
  longitude: number | null;
}

/**
 * Location resolution result. Apps Script's Locations.js computes a fresh
 * classification from the live sheet on every request; src/lib/overlayLocations.ts
 * then overlays Supabase's persisted `location_cache`/`location_review_queue`
 * on top for any row that's actually been geocoded, replacing `latitude`/
 * `longitude`/`accuracy`/`source`/`geocodingStatus` (resolved rows) or
 * `proposedLatitude`/`proposedLongitude`/`reviewReason` (needs-review rows).
 * `geocodedAt`/`verified`/`verifiedBy`/`verifiedAt` only ever come from that
 * overlay — Apps Script never sets them, hence still optional.
 */
export interface ResolvedLocation {
  rowIndex: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: LocationAccuracy;
  source: LocationSource;
  /** The query string sent to the geocoding provider, if any. */
  geocodingQuery: string | null;
  geocodingStatus: GeocodingStatus;
  /** True when the resolution is too weak/uncertain to trust without a human looking at it. */
  needsReview: boolean;
  reviewReason: string | null;
  /** A candidate coordinate found by heuristics (e.g. a stray lat/lng typed into the wrong column) — never auto-applied. */
  proposedLatitude: number | null;
  proposedLongitude: number | null;
  /** Not yet populated — reserved for the Supabase location_cache merge described above. */
  geocodedAt?: string | null;
  verified?: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

/** A flood-prone-area record merged with its resolved location, as served to the UI. */
export interface FloodProneArea extends FloodProneAreaRaw {
  location: ResolvedLocation | null;
}

export type ReportStatus = "open" | "investigating" | "resolved" | "dismissed";
export type ReportSeverity = "low" | "moderate" | "severe" | "critical";

/** User-submitted flood report. Stored in Supabase (`reports` table), not in the Sheet. */
export interface FloodReport {
  id: string;
  title: string;
  description: string;
  status: ReportStatus;
  severity: ReportSeverity;
  region: string | null;
  province: string | null;
  municipalityCity: string | null;
  barangay: string | null;
  latitude: number | null;
  longitude: number | null;
  linkedFloodProneAreaRowIndex: number | null;
  reportedBy: string;
  reportedAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export type UserRole = "admin" | "editor" | "viewer";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

export type ActivityEventType =
  | "LOGIN"
  | "CREATE_REPORT"
  | "UPDATE_REPORT"
  | "DELETE_REPORT"
  | "UPDATE_FLOOD_AREA"
  | "LOCATION_GEOCODED"
  | "LOCATION_VERIFIED"
  | "AUTHORIZATION_FAILURE"
  | "VALIDATION_FAILURE";

export interface ActivityLogEntry {
  id: string;
  eventType: ActivityEventType;
  actorEmail: string | null;
  targetType: "flood_prone_area" | "report" | "location" | "user" | "system";
  targetId: string | null;
  message: string;
  createdAt: string;
}

export interface DashboardStats {
  totalFloodProneAreas: number;
  byRegion: Array<{ region: string; count: number }>;
  byProvince: Array<{ province: string; count: number }>;
  locationResolution: Record<LocationAccuracy, number>;
  /** null when Supabase is unavailable — never 0 for "unknown." */
  openReports: number | null;
  reportsBySeverity: Record<ReportSeverity, number>;
  /** null when Supabase (the secondary datastore) is unavailable or not yet provisioned — never 0 for "unknown." */
  pendingLocationReviews: number | null;
}

/** Standard API envelope returned by every Apps Script endpoint and every Next.js API route. */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string; code: string };

export interface FloodProneAreaFilters {
  search?: string;
  region?: string;
  province?: string;
  municipalityCity?: string;
  barangay?: string;
  deo?: string;
  accuracy?: LocationAccuracy;
  page?: number;
  pageSize?: number;
}

export interface ReportFilters {
  search?: string;
  status?: ReportStatus;
  severity?: ReportSeverity;
  region?: string;
  province?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
