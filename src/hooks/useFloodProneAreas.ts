"use client";

import { useEffect, useState } from "react";
import type { FloodProneArea, FloodProneAreaFilters } from "@/lib/types";

interface Result {
  items: FloodProneArea[];
  total: number;
  error: string | null;
  /** The filters key this result corresponds to — used to derive `loading` without setState-in-effect. */
  key: string;
}

/**
 * Client-side hook. Calls this app's own /api/flood-prone-areas route —
 * never the Apps Script URL directly — so the shared-secret credential
 * that guards Apps Script stays server-side. See src/lib/apps-script.ts.
 *
 * `loading` is derived (result.key !== the current filters key) rather
 * than set imperatively inside the effect, so the effect body only ever
 * calls setState from the fetch's resolution, never synchronously.
 */
export function useFloodProneAreas(filters: FloodProneAreaFilters) {
  const key = JSON.stringify(filters);
  const [result, setResult] = useState<Result>({ items: [], total: 0, error: null, key: "" });

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([paramKey, value]) => {
      if (value !== undefined) params.set(paramKey, String(value));
    });

    fetch(`/api/flood-prone-areas?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message);
        setResult({ items: json.data.items, total: json.data.total, error: null, key });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({ items: [], total: 0, error: err instanceof Error ? err.message : "Failed to load flood-prone areas.", key });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items: result.items, total: result.total, error: result.error, loading: result.key !== key };
}
