"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { SeverityBadge } from "@/components/reports/SeverityBadge";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { formatDateTime } from "@/lib/utils";
import type { FloodReport } from "@/lib/types";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<FloodReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const loading = loadedForId !== id;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message);
        setReport(json.data);
        setError(null);
        setLoadedForId(id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load report.");
        setLoadedForId(id);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell title="Report Detail">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {report ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{report.title}</CardTitle>
            <div className="flex gap-2">
              <SeverityBadge severity={report.severity} />
              <StatusBadge status={report.status} />
            </div>
          </CardHeader>
          <CardBody className="space-y-4 text-sm">
            <p className="text-slate-700">{report.description || "No description provided."}</p>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Location</dt>
                <dd className="mt-0.5 text-slate-900">
                  {[report.barangay, report.municipalityCity, report.province].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Reported by</dt>
                <dd className="mt-0.5 text-slate-900">{report.reportedBy}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Reported at</dt>
                <dd className="mt-0.5 text-slate-900">{formatDateTime(report.reportedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Last updated</dt>
                <dd className="mt-0.5 text-slate-900">{formatDateTime(report.updatedAt)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      ) : null}
    </AppShell>
  );
}
