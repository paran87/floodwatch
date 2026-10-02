"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./navLinks";

/** Mobile-only primary navigation at the bottom of the shell. The sidebar takes over from `md` up. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="grid shrink-0 grid-cols-3 border-t-[3px] border-t-navy-900 bg-white shadow-[0_-4px_12px_rgba(11,42,107,0.08)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-brand-500" : "text-navy-700"}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span className="max-w-full truncate px-1 font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
