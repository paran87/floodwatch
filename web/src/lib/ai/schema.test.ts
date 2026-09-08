import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeAiNormalization, parseAiNormalization } from "./schema";
import { emptyFloodInput } from "../google-sheets/mapper";

test("AI cannot invent a municipality that was missing from the sheet", () => {
  const current = emptyFloodInput();
  current.city_municipality = "";
  const parsed = parseAiNormalization({
    normalized_data: { ...current, city_municipality: "Invented Town" },
    confidence: 0.9,
    warnings: [],
  });
  assert.ok(parsed);
  const merged = mergeAiNormalization(current, {}, parsed!);
  assert.equal(merged.record.city_municipality, "");
  assert.ok(merged.warnings.some((warning) => /city_municipality/i.test(warning)));
});

test("invalid AI payloads are rejected", () => {
  assert.equal(parseAiNormalization("not json object"), null);
  assert.equal(parseAiNormalization({ confidence: 1 }), null);
});
