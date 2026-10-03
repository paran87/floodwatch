import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-navy-700 text-white hover:bg-navy-800 disabled:bg-navy-200",
  accent: "bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-100",
  secondary: "border border-navy-200 bg-white text-navy-800 hover:bg-navy-50 disabled:bg-slate-50 disabled:text-slate-400",
  ghost: "bg-transparent text-slate-700 hover:bg-navy-50 disabled:text-slate-300",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-xs",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
