import type { LocationAccuracy, ReportSeverity, ReportStatus, UserRole } from "./types";

/** Exact header strings in row 2 of the "FLOOD PRONE" sheet tab, in column order (A–I). */
export const SHEET_TAB_NAME = "FLOOD PRONE";
export const SHEET_HEADER_ROW = 2;
export const SHEET_DATA_START_ROW = 3;

export const SHEET_HEADERS = [
  "Region",
  "Province",
  "Municipality/City",
  "DEO",
  "Barangay",
  "Road Name/Waterways",
  "KM Station Limit",
  "Latitude",
  "Longitude",
] as const;

/** Priority order used by LocationResolver — do not reorder without updating apps-script/LocationResolver.js in lockstep. */
export const LOCATION_RESOLUTION_HIERARCHY: LocationAccuracy[] = [
  "exact",
  "address",
  "road",
  "barangay",
  "municipality",
  "province",
  "region",
  "unresolved",
];

export const LOCATION_ACCURACY_LABELS: Record<LocationAccuracy, string> = {
  exact: "Exact",
  address: "Address-level",
  road: "Road-level",
  barangay: "Barangay-level",
  municipality: "Municipality-level",
  province: "Province-level",
  region: "Region-level",
  unresolved: "Needs location review",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const REPORT_SEVERITY_LABELS: Record<ReportSeverity, string> = {
  low: "Low",
  moderate: "Moderate",
  severe: "Severe",
  critical: "Critical",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_PERMISSIONS: Record<UserRole, { canCreate: boolean; canEdit: boolean; canDelete: boolean; canVerifyLocation: boolean }> = {
  admin: { canCreate: true, canEdit: true, canDelete: true, canVerifyLocation: true },
  editor: { canCreate: true, canEdit: true, canDelete: false, canVerifyLocation: true },
  viewer: { canCreate: false, canEdit: false, canDelete: false, canVerifyLocation: false },
};

export const DEFAULT_PAGE_SIZE = 25;
export const PH_COUNTRY_SUFFIX = "Philippines";
