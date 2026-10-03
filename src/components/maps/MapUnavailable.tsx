import { MapPinOff } from "lucide-react";

/**
 * Shown in place of the map whenever there's nothing resolved to plot —
 * never an empty map canvas with a small note elsewhere, which reads
 * as broken rather than "coordinates genuinely aren't available yet."
 */
export function MapUnavailable({ reason }: { reason?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-navy-200 bg-navy-50 p-6 text-center">
      <MapPinOff className="h-8 w-8 text-navy-200" aria-hidden />
      <p className="text-sm font-medium text-slate-700">No map location available yet</p>
      <p className="max-w-sm text-xs text-slate-500">
        {reason ??
          "This record doesn't have enough location information resolved to place it on the map yet. It's still listed below — see its Location badge for details."}
      </p>
    </div>
  );
}
