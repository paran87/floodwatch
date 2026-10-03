"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DashboardStats } from "@/lib/types";

/** Within this window a remount reuses the loaded numbers without refetching. */
const REUSE_MS = 20_000;
const STORAGE_KEY = "floodwatch.dashboard.v1";

// Module-level so it survives client-side navigation: coming back to the dashboard shows the last numbers instantly.
let loaded: { stats: DashboardStats; at: number } | null = null;

// The last numbers are also kept in localStorage, so the first view after reopening the app paints immediately
// with the previous values (clearly marked "updating") instead of an empty skeleton while a cold server wakes up.
const subscribeToStorage = (notify: () => void) => {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
};
const readStored = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked (private mode etc.) — just no head start
  }
};
const writeStored = (stats: DashboardStats) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* not persisting is fine */
  }
};

export function useDashboardStats() {
  const [fetched, setFetched] = useState<DashboardStats | null>(loaded?.stats ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(() => !(loaded && Date.now() - loaded.at < REUSE_MS));
  const [attempt, setAttempt] = useState(0);

  /** Clears a failure and loads again (the "Try again" button). */
  const reload = useCallback(() => {
    loaded = null;
    setFetched(null);
    setError(null);
    setPending(true);
    setAttempt((n) => n + 1);
  }, []);

  // null on the server and during hydration, so the first client render matches the server's.
  const storedRaw = useSyncExternalStore(subscribeToStorage, readStored, () => null);
  const stored = useMemo<DashboardStats | null>(() => {
    if (!storedRaw) return null;
    try {
      return JSON.parse(storedRaw) as DashboardStats;
    } catch {
      return null;
    }
  }, [storedRaw]);

  useEffect(() => {
    if (loaded && Date.now() - loaded.at < REUSE_MS) return;
    const controller = new AbortController();

    fetch("/api/dashboard", { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message);
        loaded = { stats: json.data, at: Date.now() };
        writeStored(json.data);
        setFetched(json.data);
        setError(null);
        setPending(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard stats.");
        setPending(false);
      });

    return () => controller.abort();
  }, [attempt]);

  const stats = fetched ?? stored;
  return {
    stats,
    // Skeleton only when there's nothing at all to show yet.
    loading: !stats && !error,
    // Showing numbers that haven't been confirmed by this visit's fetch yet.
    updating: Boolean(stats) && pending,
    // A failed refresh only becomes an error if there are no numbers to keep showing.
    error: stats ? null : error,
    reload,
  };
}
