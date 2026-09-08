import type { AiClient } from "@/lib/ai/client";
import type { DuplicateMatch } from "@/lib/import/types";
import type { FloodProneAreaInput } from "@/lib/types";

export async function aiDuplicateReason(
  ai: AiClient,
  imported: FloodProneAreaInput,
  match: DuplicateMatch,
): Promise<string | null> {
  const payload = await ai.completeJson([
    {
      role: "system",
      content:
        "Explain why two flood-prone area records may be duplicates. Use only the provided comparison facts. Never invent matching fields, distances, or identities. Return JSON { \"reason\": string }.",
    },
    {
      role: "user",
      content: JSON.stringify({
        imported,
        existing: match.record,
        confidence: match.confidence,
        type: match.type,
        fieldScores: match.fieldScores,
        facts: match.reasons,
      }),
    },
  ]);

  if (!payload || typeof payload !== "object") return null;
  const reason = (payload as { reason?: unknown }).reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}
