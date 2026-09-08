import type { AiClient } from "@/lib/ai/client";
import { mergeAiNormalization, parseAiNormalization } from "@/lib/ai/schema";
import type { FloodAreaField } from "@/lib/google-sheets/mapper";
import type { FloodProneAreaInput } from "@/lib/types";

export async function aiNormalizeRecord(
  ai: AiClient,
  mapped: Partial<Record<FloodAreaField, string>>,
  current: FloodProneAreaInput,
  raw: Record<string, string>,
): Promise<{ record: FloodProneAreaInput; warnings: string[]; usedAi: boolean }> {
  const payload = await ai.completeJson([
    {
      role: "system",
      content:
        "You normalize flood-prone area spreadsheet rows for FloodWatch. Return JSON only. Never invent missing municipalities, coordinates, roads, DEOs, regions, addresses, or descriptions. If a value is missing or ambiguous, return null and add a warning. Expand known abbreviations only when they are present in the input.",
    },
    {
      role: "user",
      content: JSON.stringify({
        raw,
        mapped,
        current,
        expected: {
          normalized_data: current,
          confidence: 0.9,
          warnings: [],
        },
      }),
    },
  ]);

  const parsed = parseAiNormalization(payload);
  if (!parsed) {
    return { record: current, warnings: ["AI normalization response was invalid."], usedAi: false };
  }
  const merged = mergeAiNormalization(current, mapped, parsed);
  return { ...merged, usedAi: true };
}
