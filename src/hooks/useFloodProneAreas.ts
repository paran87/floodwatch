"use client";

import { useEffect, useState } from "react";
import type { FloodProneArea } from "@/lib/types";

/** The API caps one response at 2000 rows; the whole dataset (~1,763) fits in one load, so there is no paging. */
const ALL_ROWS = 2000;
/** Within this window a remount (e.g. navigating back) reuses the loaded data without refetching. */
const REUSE_MS = 20_000;

// Module-level so it survives client-side navigation between pages (Dashboard → Areas → back is instant).
let loaded: { items: FloodProneArea[]; at: number } | null = null;

/**
 * Loads the full flood-prone-area dataset once. Searching and filtering then
 * happen locally in the browser (see src/lib/areaFilter.ts), so typing and
 * dropdown changes never wait on the network. Calls this app's own
 * /api/flood-prone-areas route — never Apps Script directly (src/lib/apps-script.ts).
 */
export function useFloodProneAreas() {
  const [state, setState] = useState<{ items: FloodProneArea[]; error: string | null; ready: boolean }>(() =>
    loaded ? { items: loaded.items, error: null, ready: true } : { items: [], error: null, ready: false },
  );

  useEffect(() => {
    if (loaded && Date.now() - loaded.at < REUSE_MS) return;
    const controller = new AbortController();

    fetch(`/api/flood-prone-areas?pageSize=${ALL_ROWS}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message);
        loaded = { items: json.data.items, at: Date.now() };
        setState({ items: json.data.items, error: null, ready: true });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Keep showing data we already have if only a background refresh failed.
        setState((prev) => (prev.ready ? prev : { items: [], error: err instanceof Error ? err.message : "Failed to load flood-prone areas.", ready: true }));
      });

    return () => controller.abort();
  }, []);

  return { items: state.items, error: state.error, loading: !state.ready };
}
