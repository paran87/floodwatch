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
      className="grid shrink-0 grid-cols-3 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-sky-700" : "text-slate-500"}`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span className="max-w-full truncate px-1">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
