import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "info" | "danger" | "warning";

const toneClasses: Record<Tone, string> = {
  info: "border-navy-200 bg-navy-50 text-navy-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-brand-100 bg-brand-50 text-brand-600",
};

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm", toneClasses[tone])} role="alert">
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}
