import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/25",
        className,
      )}
      {...props}
    />
  );
}
