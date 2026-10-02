import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/25",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
