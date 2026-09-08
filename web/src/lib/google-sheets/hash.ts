import { createHash } from "node:crypto";

export function hashSourceRow(raw: Record<string, unknown>) {
  const keys = Object.keys(raw).sort();
  const canonical = JSON.stringify(
    keys.map((key) => [key, String(raw[key] ?? "").trim()]),
  );
  return createHash("sha256").update(canonical).digest("hex");
}
