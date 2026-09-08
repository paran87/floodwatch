export const FLOOD_STATUSES = [
  "Flood-prone",
  "High risk",
  "Moderate",
  "Monitored",
  "Mitigated",
] as const;

export type FloodStatus = (typeof FLOOD_STATUSES)[number];

export type GeoJSONPoint = {
  type: "Point";
  coordinates: [number, number];
};

export type GeoJSONLineString = {
  type: "LineString";
  coordinates: [number, number][];
};

export type AreaGeometry = GeoJSONPoint | GeoJSONLineString;

export type FloodProneArea = {
  id: string;
  name: string | null;
  address: string | null;
  barangay: string | null;
  city_municipality: string;
  road_name: string | null;
  road_length: number | null;
  latitude: number | null;
  longitude: number | null;
  flood_status: string;
  description: string | null;
  geometry: AreaGeometry | null;
  region: string | null;
  deo: string | null;
  location_source: string | null;
  created_at: string;
  updated_at: string;
};

export type FloodProneAreaInput = {
  name: string | null;
  address: string | null;
  barangay: string | null;
  city_municipality: string;
  road_name: string | null;
  road_length: number | null;
  latitude: number | null;
  longitude: number | null;
  flood_status: string;
  description: string | null;
  geometry: AreaGeometry | null;
  region: string | null;
  deo: string | null;
  location_source: string | null;
};

export type EquipmentFundRequest = {
  id: string;
  region: string | null;
  date_requested: string | null;
  subject: string | null;
  equipment: string;
  quantity: number | null;
  request_total: number | null;
  status: string | null;
  aging: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
};

export type MapPickMode = "none" | "pin" | "draw";
