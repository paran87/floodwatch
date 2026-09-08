"use client";

import dynamic from "next/dynamic";

export const FloodMapDynamic = dynamic(
  () => import("./FloodMap").then((mod) => mod.FloodMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Charting the archipelago...
      </div>
    ),
  },
);
