import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-brand-100 text-brand-600",
  danger: "bg-red-100 text-red-800",
  info: "bg-navy-100 text-navy-800",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-px text-[10px] font-semibold", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
