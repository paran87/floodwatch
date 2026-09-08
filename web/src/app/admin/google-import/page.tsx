"use client";

import dynamic from "next/dynamic";

const GoogleImportAdmin = dynamic(
  () => import("@/components/GoogleImportAdmin").then((mod) => mod.GoogleImportAdmin),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#061018] text-[#4ee0c8]">
        <div className="h-10 w-10 animate-pulse rounded-2xl border border-[rgba(78,224,200,0.35)] bg-[rgba(78,224,200,0.12)]" />
        <p className="text-sm uppercase tracking-[0.2em]">Loading sheet import</p>
      </div>
    ),
  },
);

export default function GoogleImportPage() {
  return <GoogleImportAdmin />;
}
