"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers } from "lucide-react";
import { BASE_LAYERS, type BaseLayerId } from "./baseLayers";

/** Google-Maps-style layers button: opens a small panel to pick the base map. */
export function LayerSwitcher({ value, onChange }: { value: BaseLayerId; onChange: (id: BaseLayerId) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="absolute left-2.5 top-2.5 z-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Map layers"
        aria-expanded={open}
        className="flex h-[29px] w-[29px] items-center justify-center rounded bg-white text-navy-800 shadow-[0_0_0_2px_rgba(0,0,0,0.1)] hover:bg-navy-50"
      >
        <Layers className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <ul role="listbox" aria-label="Base map" className="mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {BASE_LAYERS.map((layer) => {
            const active = layer.id === value;
            return (
              <li key={layer.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(layer.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs font-medium ${active ? "bg-navy-50 text-navy-900" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="h-7 w-7 shrink-0 rounded border border-slate-300" style={{ background: layer.swatch }} aria-hidden />
                  <span className="flex-1">{layer.label}</span>
                  {active ? <Check className="h-3.5 w-3.5 text-brand-500" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
