import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const text = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function formatAddress(barangay, city, region) {
  const brgy = barangay
    ? /^(brgy\.?|barangay)\b/i.test(barangay)
      ? barangay
      : `Brgy. ${barangay}`
    : null;
  return [brgy, city, region, "Philippines"].filter(Boolean).join(", ");
}

function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

async function tryApplySchema(url, secret, sql) {
  const endpoints = [
    `${url}/pg/query`,
    `${url}/pg-meta/default/query`,
    `https://api.supabase.com/v1/projects/ercpzbbfkphbjtjfuvof/database/query`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: secret,
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      const text = await response.text();
      if (response.ok) {
        console.log(`Applied schema via ${endpoint}`);
        return true;
      }
      console.log(`Schema endpoint ${endpoint} -> ${response.status}: ${text.slice(0, 180)}`);
    } catch (error) {
      console.log(`Schema endpoint ${endpoint} failed: ${error.message}`);
    }
  }
  return false;
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !secret) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  }

  const sql = readFileSync(resolve(root, "supabase/schema.sql"), "utf8");
  const applied = await tryApplySchema(url, secret, sql);
  if (!applied) {
    console.log(
      "Could not apply DDL automatically. If tables are missing, run supabase/schema.sql in the Supabase SQL editor, then re-run npm run seed.",
    );
  }

  const supabase = createClient(url, secret || anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const probe = await supabase.from("flood_prone_areas").select("id", { count: "exact", head: true });
  if (probe.error) {
    throw new Error(
      `flood_prone_areas is not available (${probe.error.message}). Apply web/supabase/schema.sql in the Supabase SQL editor, then run npm run seed again.`,
    );
  }

  const extracted = JSON.parse(
    readFileSync(resolve(root, "data/extracted_flood_prone.json"), "utf8"),
  );
  const equipment = JSON.parse(
    readFileSync(resolve(root, "data/equipment_requests.json"), "utf8"),
  );

  const { data: existing, error: existingError } = await supabase
    .from("flood_prone_areas")
    .select("region,deo,city_municipality,barangay,road_name");
  if (existingError) throw existingError;

  const seen = new Set(
    (existing ?? []).map((row) =>
      [row.region, row.deo, row.city_municipality, row.barangay, row.road_name]
        .map((value) => value ?? "")
        .join("|"),
    ),
  );

  const rows = extracted.flood_prone_areas
    .map((item) => {
      const key = [item.region, item.deo, item.city_municipality, item.barangay, item.road_name]
        .map((value) => value ?? "")
        .join("|");
      if (seen.has(key)) return null;
      seen.add(key);
      return {
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
      };
    })
    .filter(Boolean);

  console.log(`Importing ${rows.length} new flood-prone areas (${extracted.duplicate_count} source duplicates skipped).`);

  for (const group of chunk(rows, 100)) {
    const { error } = await supabase.from("flood_prone_areas").insert(group);
    if (error) throw error;
  }

  const { count: fundCount, error: fundProbeError } = await supabase
    .from("equipment_fund_requests")
    .select("id", { count: "exact", head: true });
  if (fundProbeError) {
    console.log(`Skipping equipment import: ${fundProbeError.message}`);
  } else if ((fundCount ?? 0) === 0) {
    const { error } = await supabase.from("equipment_fund_requests").insert(equipment);
    if (error) throw error;
    console.log(`Imported ${equipment.length} equipment fund line items.`);
  } else {
    console.log(`Equipment table already has ${fundCount} rows.`);
  }

  const { count } = await supabase
    .from("flood_prone_areas")
    .select("id", { count: "exact", head: true });
  console.log(`Done. flood_prone_areas now has ${count} rows.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
