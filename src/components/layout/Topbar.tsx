import { Waves } from "lucide-react";

/**
 * Page banner: navy gradient, a small mono eyebrow, a condensed display
 * title with its last word in orange, and an orange underline bar.
 */
export function Topbar({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : null;

  return (
    <header className="shrink-0 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-700 px-4 py-3 text-white md:px-8 md:py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-navy-200 md:text-[11px]">
            Flood-prone area monitoring
          </p>
          <h1 className="mt-0.5 truncate font-display text-2xl font-extrabold uppercase leading-none tracking-wide md:text-4xl">
            {words.join(" ")}
            {last ? <span className="text-brand-500"> {last}</span> : null}
          </h1>
          <div className="mt-1.5 h-[3px] w-16 rounded-full bg-brand-500 md:mt-2 md:w-24" aria-hidden />
        </div>
        <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/20 sm:flex" aria-hidden>
          <Waves className="h-6 w-6 text-brand-500" />
        </span>
      </div>
    </header>
  );
}
