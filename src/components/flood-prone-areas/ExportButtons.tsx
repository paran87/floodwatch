"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadAreasCsv, downloadAreasPdf } from "@/lib/exportAreas";
import type { FloodProneArea } from "@/lib/types";

/** Exports exactly the rows currently listed (i.e. with the active filters applied). */
export function ExportButtons({ items, filterSummary, disabled }: { items: FloodProneArea[]; filterSummary: string[]; disabled?: boolean }) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const empty = items.length === 0;

  async function run(kind: "csv" | "pdf") {
    setError(null);
    setBusy(kind);
    try {
      if (kind === "csv") downloadAreasCsv(items);
      else await downloadAreasPdf(items, filterSummary);
    } catch {
      setError(`Couldn't create the ${kind.toUpperCase()} file. Please try again.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {error ? <span className="mr-auto text-xs text-red-600">{error}</span> : <span className="mr-auto text-[10px] text-slate-500">Download {items.length.toLocaleString()} listed records</span>}
      <Button size="sm" variant="secondary" disabled={disabled || empty || busy !== null} onClick={() => run("csv")}>
        {busy === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
        CSV
      </Button>
      <Button size="sm" variant="accent" disabled={disabled || empty || busy !== null} onClick={() => run("pdf")}>
        {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileText className="h-3.5 w-3.5" aria-hidden />}
        PDF
      </Button>
    </div>
  );
}
