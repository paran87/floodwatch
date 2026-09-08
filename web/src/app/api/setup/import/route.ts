import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

function formatAddress(barangay: string | null, city: string, region: string | null) {
  const brgy = barangay
    ? /^(brgy\.?|barangay)\b/i.test(barangay)
      ? barangay
      : `Brgy. ${barangay}`
    : null;
  return [brgy, city, region, "Philippines"].filter(Boolean).join(", ");
}

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return NextResponse.json(
      { error: "Server is missing Supabase URL or secret key." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const probe = await supabase.from("flood_prone_areas").select("id", { count: "exact", head: true });
  if (probe.error) {
    return NextResponse.json(
      {
        error:
          "Tables are not available yet. Paste supabase/schema.sql into the Supabase SQL editor, then import again.",
        detail: probe.error.message,
      },
      { status: 409 },
    );
  }

  const extracted = JSON.parse(
    readFileSync(join(process.cwd(), "data/extracted_flood_prone.json"), "utf8"),
  ) as {
    flood_prone_areas: Array<{
      region: string | null;
      deo: string | null;
      city_municipality: string;
      barangay: string | null;
      road_name: string | null;
    }>;
    duplicate_count: number;
  };
  const equipment = JSON.parse(
    readFileSync(join(process.cwd(), "data/equipment_requests.json"), "utf8"),
  );

  const { data: existing, error: existingError } = await supabase
    .from("flood_prone_areas")
    .select("region,deo,city_municipality,barangay,road_name");
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const seen = new Set(
    (existing ?? []).map((row) =>
      [row.region, row.deo, row.city_municipality, row.barangay, row.road_name]
        .map((value) => value ?? "")
        .join("|"),
    ),
  );

  const rows = extracted.flood_prone_areas
    .filter((item) => {
      const key = [item.region, item.deo, item.city_municipality, item.barangay, item.road_name]
        .map((value) => value ?? "")
        .join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({
      name: item.road_name || item.barangay || item.city_municipality,
      address: formatAddress(item.barangay, item.city_municipality, item.region),
      barangay: item.barangay,
      city_municipality: item.city_municipality,
      road_name: item.road_name,
      road_length: null,
      latitude: null,
      longitude: null,
      flood_status: "Flood-prone",
      description: item.deo
        ? `Imported from the DPWH flood-prone areas inventory. District Engineering Office: ${item.deo}.`
        : "Imported from the DPWH flood-prone areas inventory.",
      geometry: null,
      region: item.region,
      deo: item.deo,
      location_source: null,
    }));

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from("flood_prone_areas").insert(rows.slice(i, i + 100));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count: fundCount } = await supabase
    .from("equipment_fund_requests")
    .select("id", { count: "exact", head: true });
  if ((fundCount ?? 0) === 0) {
    const { error } = await supabase.from("equipment_fund_requests").insert(equipment);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("flood_prone_areas")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    imported: rows.length,
    skippedDuplicates: extracted.duplicate_count,
    total: count ?? 0,
  });
}
