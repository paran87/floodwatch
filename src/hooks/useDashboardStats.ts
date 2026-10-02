"use client";

import { useEffect, useState } from "react";
import type { DashboardStats } from "@/lib/types";

interface State {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
}

export function useDashboardStats() {
  const [state, setState] = useState<State>({ stats: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message);
        setState({ stats: json.data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ stats: null, loading: false, error: err instanceof Error ? err.message : "Failed to load dashboard stats." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
