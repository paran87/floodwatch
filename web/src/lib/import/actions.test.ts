import assert from "node:assert/strict";
import { test } from "node:test";
import { approveImport, buildMergedRecord, describeSupabaseError, mergeImport, supabaseErrorFields } from "./actions";
import type { FloodProneArea, FloodProneAreaInput } from "../types";

const imported: FloodProneAreaInput = {
  name: "National Hwy.",
  address: null,
  barangay: "Brgy. San Roque",
  city_municipality: "San Jose",
  road_name: "National Hwy.",
  road_length: null,
  latitude: 12.3521,
  longitude: 121.0672,
  flood_status: "Flood-prone",
  description: "From sheet",
  geometry: null,
  region: "MIMAROPA",
  deo: "Occidental Mindoro DEO",
  location_source: "Google Sheet",
};

const existing: FloodProneArea = {
  id: "existing-1",
  name: "National Highway",
  address: null,
  barangay: "San Roque",
  city_municipality: "San Jose",
  road_name: "National Highway",
  road_length: 120,
  latitude: 12.352,
  longitude: 121.0673,
  flood_status: "Flood-prone",
  description: "Old description",
  geometry: null,
  region: "MIMAROPA",
  deo: "Occidental Mindoro DEO",
  location_source: "manual",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

test("merge uses the selected field values", () => {
  const merged = buildMergedRecord(existing, imported, [
    { field: "barangay", choice: "imported" },
    { field: "road_name", choice: "existing" },
    { field: "latitude", choice: "imported" },
    { field: "description", choice: "imported" },
  ]);
  assert.equal(merged.barangay, "Brgy. San Roque");
  assert.equal(merged.road_name, "National Highway");
  assert.equal(merged.latitude, 12.3521);
  assert.equal(merged.description, "From sheet");
  assert.equal(merged.road_length, 120);
});

function fakeSupabase(
  store: { inserts: Record<string, unknown[]>; updates: Record<string, unknown[]> },
  options: {
    insertError?: { message: string; code: string; details: string; hint: string };
  } = {},
) {
  return {
    from(table: string) {
      return {
        insert(payload: unknown) {
          if (table === "flood_prone_areas" && options.insertError) {
            return {
              select() {
                return {
                  async single() {
                    return { data: null, error: options.insertError };
                  },
                };
              },
              then(resolve: (value: { error: typeof options.insertError }) => unknown) {
                return Promise.resolve({ error: options.insertError }).then(resolve);
              },
            };
          }
          store.inserts[table] ??= [];
          store.inserts[table].push(payload);
          return {
            select() {
              return {
                async single() {
                  return { data: { id: table === "flood_prone_areas" ? "created-1" : "action-1" }, error: null };
                },
              };
            },
            then(resolve: (value: { error: null }) => unknown) {
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
        },
        update(payload: unknown) {
          store.updates[table] ??= [];
          store.updates[table].push(payload);
          const result = {
            eq() {
              return {
                select() {
                  return {
                    async single() {
                      return { data: { id: existing.id, approved_rows: 0, merged_rows: 0 }, error: null };
                    },
                  };
                },
                then(resolve: (value: { error: null }) => unknown) {
                  return Promise.resolve({ error: null }).then(resolve);
                },
              };
            },
            select() {
              return {
                eq() {
                  return {
                    async single() {
                      return { data: { approved_rows: 0, merged_rows: 0 }, error: null };
                    },
                  };
                },
              };
            },
          };
          return result;
        },
        select() {
          return {
            eq() {
              return {
                async single() {
                  return { data: { approved_rows: 0, merged_rows: 0 }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("approve writes the production row and an audit record", async () => {
  const store = { inserts: {}, updates: {} } as { inserts: Record<string, unknown[]>; updates: Record<string, unknown[]> };
  await approveImport(
    fakeSupabase(store) as never,
    { id: "imp-1", batch_id: "batch-1", normalized_data: imported, status: "new" },
    "admin",
  );
  assert.equal(store.inserts.flood_prone_areas?.length, 1);
  assert.equal(store.inserts.google_sheet_import_actions?.length, 1);
  const audit = store.inserts.google_sheet_import_actions[0] as { action: string; performed_by: string };
  assert.equal(audit.action, "approved");
  assert.equal(audit.performed_by, "admin");
});

test("merge writes before/after audit data", async () => {
  const store = { inserts: {}, updates: {} } as { inserts: Record<string, unknown[]>; updates: Record<string, unknown[]> };
  await mergeImport(
    fakeSupabase(store) as never,
    {
      id: "imp-1",
      batch_id: "batch-1",
      normalized_data: imported,
      matched_record_id: existing.id,
      status: "possible_duplicate",
    },
    existing,
    [
      { field: "latitude", choice: "imported" },
      { field: "road_name", choice: "existing" },
    ],
    "admin",
    "Same municipality and barangay.",
  );
  assert.equal(store.updates.flood_prone_areas?.length, 1);
  const audit = store.inserts.google_sheet_import_actions[0] as {
    action: string;
    existing_record_id: string;
    before_data: FloodProneArea;
    after_data: FloodProneAreaInput;
  };
  assert.equal(audit.action, "merged");
  assert.equal(audit.existing_record_id, existing.id);
  assert.equal(audit.before_data.id, existing.id);
  assert.equal(audit.after_data.latitude, 12.3521);
  assert.equal(audit.after_data.road_name, "National Highway");
});

test("supabase error diagnostics include message, code, details, and hint", () => {
  const insertError = {
    message: "duplicate key value violates unique constraint \"flood_prone_areas_dedup_idx\"",
    code: "23505",
    details: "Key (region, deo, city_municipality, barangay, road_name)=(...) already exists.",
    hint: "Review and merge instead.",
  };
  const fields = supabaseErrorFields(insertError);
  assert.deepEqual(Object.keys(fields).sort(), ["code", "details", "hint", "message"]);
  assert.equal(fields.code, "23505");
  const described = describeSupabaseError(insertError);
  assert.match(described, /duplicate key value/);
  assert.match(described, /code=23505/);
  assert.match(described, /details=/);
  assert.match(described, /hint=/);
});

test("approve logs the exact flood_prone_areas insert error and does not write production data", async () => {
  const store = { inserts: {}, updates: {} } as { inserts: Record<string, unknown[]>; updates: Record<string, unknown[]> };
  const insertError = {
    message: "duplicate key value violates unique constraint \"flood_prone_areas_dedup_idx\"",
    code: "23505",
    details: "Key already exists.",
    hint: "Check the unique index.",
  };
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    await assert.rejects(
      () =>
        approveImport(
          fakeSupabase(store, { insertError }) as never,
          { id: "imp-1", batch_id: "batch-1", normalized_data: imported, status: "new" },
          "admin",
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /duplicate key value violates unique constraint/);
        assert.match(error.message, /code=23505/);
        assert.match(error.message, /details=Key already exists/);
        assert.match(error.message, /hint=Check the unique index/);
        return true;
      },
    );
  } finally {
    console.error = original;
  }

  assert.equal(store.inserts.flood_prone_areas, undefined);
  assert.equal(store.inserts.google_sheet_import_actions, undefined);
  const entry = logged.find((item) => Array.isArray(item) && item[0] === "flood_prone_areas insert failed") as
    | [string, Record<string, unknown>]
    | undefined;
  assert.ok(entry);
  assert.equal(entry[1].import_id, "imp-1");
  assert.equal(entry[1].message, insertError.message);
  assert.equal(entry[1].code, "23505");
  assert.equal(entry[1].details, "Key already exists.");
  assert.equal(entry[1].hint, "Check the unique index.");
  assert.equal("SUPABASE_SECRET_KEY" in entry[1], false);
  assert.equal("url" in entry[1], false);
  assert.equal("key" in entry[1], false);
});
