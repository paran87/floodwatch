"use client";

import { X } from "lucide-react";
import { formatPeso } from "@/lib/format";
import type { EquipmentFundRequest } from "@/lib/types";

export function FundingDrawer({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: EquipmentFundRequest[];
  onClose: () => void;
}) {
  if (!open) return null;

  const groups = new Map<string, EquipmentFundRequest[]>();
  for (const item of items) {
    const key = `${item.region ?? "Unspecified"}|${item.subject ?? ""}|${item.date_requested ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const requestTotals = [...groups.values()].reduce((sum, group) => {
    return sum + (group.find((item) => item.request_total)?.request_total ?? 0);
  }, 0);

  return (
    <div className="overlay fixed inset-0 z-40 flex justify-end bg-black/35 backdrop-blur-sm">
      <aside className="glass-panel flex h-full w-full max-w-xl flex-col rounded-none border-y-0 border-r-0">
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
              Source file
            </p>
            <h2 className="display-title mt-1 text-2xl">Equipment fund requests</h2>
            <p className="mt-1 text-sm text-muted">
              {groups.size} requests · {formatPeso(requestTotals)} requested
            </p>
          </div>
          <button className="btn btn-ghost px-3" onClick={onClose} aria-label="Close funding">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-8 scrollbar-thin">
          {[...groups.entries()].map(([key, group]) => {
            const first = group[0];
            return (
              <article key={key} className="rounded-2xl border border-[var(--line)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{first.region}</p>
                    <p className="text-xs text-muted">{first.date_requested}</p>
                  </div>
                  <p className="text-sm font-semibold text-teal">
                    {formatPeso(first.request_total)}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{first.subject}</p>
                {first.remarks ? (
                  <p className="mt-2 rounded-xl bg-[rgba(232,180,90,0.12)] px-3 py-2 text-sm">
                    {first.remarks}
                  </p>
                ) : null}
                <ul className="mt-3 space-y-1.5">
                  {group.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{item.equipment}</span>
                      <span className="text-muted">× {item.quantity ?? 1}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
