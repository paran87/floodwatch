"use client";

import { useEffect, useState } from "react";
import type { FloodReport, ReportFilters } from "@/lib/types";

interface Result {
  items: FloodReport[];
  total: number;
  error: string | null;
  /** The filters key this result corresponds to — used to derive `loading` without setState-in-effect. */
  key: string;
}

export function useReports(filters: ReportFilters) {
  const key = JSON.stringify(filters);
  const [result, setResult] = useState<Result>({ items: [], total: 0, error: null, key: "" });

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([paramKey, value]) => {
      if (value !== undefined) params.set(paramKey, String(value));
    });

    fetch(`/api/reports?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message);
        setResult({ items: json.data.items, total: json.data.total, error: null, key });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({ items: [], total: 0, error: err instanceof Error ? err.message : "Failed to load reports.", key });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { items: result.items, total: result.total, error: result.error, loading: result.key !== key };
}
