"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { FloodProneArea } from "@/lib/types";

/** The API caps one response at 2000 rows; the whole dataset (~1,763) fits in one load, so there is no paging. */
const ALL_ROWS = 2000;
/** Within this window a remount (e.g. navigating back) reuses the loaded data without refetching. */
const REUSE_MS = 20_000;
const STORAGE_KEY = "floodwatch.areas.v1";

// Module-level so it survives client-side navigation between pages (Dashboard → Areas → back is instant).
let loaded: { items: FloodProneArea[]; at: number } | null = null;

// The last list is also kept in localStorage, so a reload or a new visit paints real rows immediately
// (marked "updating") instead of a skeleton while the server — or Google's slow Apps Script behind it — answers.
// Read once and kept: the raw string is ~1 MB, so it must not be re-read on every render.
let storedRaw: string | null | undefined;
const readStored = (): string | null => {
  if (storedRaw === undefined) {
    try {
      storedRaw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      storedRaw = null; // storage blocked (private mode etc.) — just no head start
    }
  }
  return storedRaw;
};
const writeStored = (items: FloodProneArea[]) => {
  try {
    const raw = JSON.stringify(items);
    window.localStorage.setItem(STORAGE_KEY, raw);
    storedRaw = raw;
  } catch {
    /* over quota or blocked: not persisting is fine */
  }
};
const noSubscribe = () => () => undefined;

/**
 * Loads the full flood-prone-area dataset once. Searching and filtering then
 * happen locally in the browser (see src/lib/areaFilter.ts), so typing and
 * dropdown changes never wait on the network. Calls this app's own
 * /api/flood-prone-areas route — never Apps Script directly (src/lib/apps-script.ts).
 */
export function useFloodProneAreas() {
  const [fetched, setFetched] = useState<FloodProneArea[] | null>(loaded?.items ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(() => !(loaded && Date.now() - loaded.at < REUSE_MS));
  const [attempt, setAttempt] = useState(0);

  // null on the server and during hydration, so the first client render matches the server's.
  const raw = useSyncExternalStore(noSubscribe, readStored, () => null);
  const stored = useMemo<FloodProneArea[] | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as FloodProneArea[];
    } catch {
      return null;
    }
  }, [raw]);

  /** Forgets the failure and loads again (the "Try again" button). */
  const reload = useCallback(() => {
    loaded = null;
    setFetched(null);
    setError(null);
    setPending(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (loaded && Date.now() - loaded.at < REUSE_MS) return;
    const controller = new AbortController();

    fetch(`/api/flood-prone-areas?pageSize=${ALL_ROWS}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message);
        loaded = { items: json.data.items, at: Date.now() };
        writeStored(json.data.items);
        setFetched(json.data.items);
        setError(null);
        setPending(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load flood-prone areas.");
        setPending(false);
      });

    return () => controller.abort();
  }, [attempt]);

  const items = fetched ?? stored;
  return {
    items: items ?? EMPTY,
    // Skeleton only when there is nothing at all to show yet.
    loading: !items && !error,
    // Showing the remembered list, not yet confirmed by this visit's fetch.
    updating: Boolean(items) && pending,
    // A failed refresh only becomes an error if there is nothing to keep showing.
    error: items ? null : error,
    reload,
  };
}

const EMPTY: FloodProneArea[] = [];
