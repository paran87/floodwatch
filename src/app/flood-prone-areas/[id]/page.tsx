"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { LocationBadge } from "@/components/flood-prone-areas/LocationBadge";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Alert } from "@/components/ui/Alert";
import { toMapMarker } from "@/components/maps/types";
import { MapUnavailable } from "@/components/maps/MapUnavailable";
import type { FloodProneArea } from "@/lib/types";

const FloodMap = dynamic(() => import("@/components/maps/FloodMap").then((m) => m.FloodMap), { ssr: false });

export default function FloodProneAreaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [area, setArea] = useState<FloodProneArea | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Derived from comparing `id` to the id the current result belongs to,
  // rather than set imperatively in the effect (see useFloodProneAreas.ts).
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const loading = loadedForId !== id;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/flood-prone-areas/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message);
        setArea(json.data);
        setError(null);
        setLoadedForId(id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load record.");
        setLoadedForId(id);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const marker = area ? toMapMarker(area) : null;

  return (
    <AppShell title="Flood-Prone Area Detail">
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {area ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{area.roadNameWaterways || "Unnamed road/waterway"}</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Region" value={area.region} />
                <Field label="Province" value={area.province} />
                <Field label="Municipality/City" value={area.municipalityCity} />
                <Field label="Barangay" value={area.barangay} />
                <Field label="DEO" value={area.deo} />
                <Field label="KM Station Limit" value={area.kmStationLimit} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location Resolution</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              {area.location ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Accuracy</span>
                    <LocationBadge accuracy={area.location.accuracy} />
                  </div>
                  <Field label="Source" value={area.location.source} />
                  {area.location.needsReview ? (
                    <Alert tone="warning" title="Needs location review">
                      {area.location.reviewReason}
                    </Alert>
                  ) : null}
                </>
              ) : null}
            </CardBody>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Map</CardTitle>
            </CardHeader>
            <CardBody>
              {marker ? (
                <div className="h-72 overflow-hidden rounded-lg">
                  <FloodMap markers={[marker]} />
                </div>
              ) : (
                <div className="h-72">
                  <MapUnavailable reason={mapUnavailableReason(area)} />
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value || "—"}</dd>
    </div>
  );
}

/** A specific, accurate explanation of why this record has no map point yet — never a generic "unavailable." */
function mapUnavailableReason(area: FloodProneArea): string {
  const loc = area.location;
  if (!loc) return "Location information for this record could not be loaded.";

  if (loc.accuracy === "unresolved") {
    return "None of this record's Region, Province, Municipality, Barangay, or Road fields have enough information to estimate a map location.";
  }
  if (loc.geocodingStatus === "pending") {
    const strongEnough = loc.accuracy === "exact" || loc.accuracy === "address" || loc.accuracy === "road" || loc.accuracy === "barangay";
    return strongEnough
      ? "This record has enough location information (road/barangay/municipality/province) to estimate a point, but geocoding hasn't been run on this dataset yet — see CLAUDE.md §8."
      : `Only ${loc.accuracy}-level information is available for this record, so an estimated point would be approximate at best — and geocoding hasn't been run yet regardless.`;
  }
  return "This record's location hasn't been resolved to coordinates yet.";
}
