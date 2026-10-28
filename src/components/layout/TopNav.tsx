"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./navLinks";

/** Desktop-only primary navigation: brand + tabs in one slim bar. Mobile uses BottomNav. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden shrink-0 items-center gap-8 border-b border-slate-200 bg-white px-8 md:flex">
      <span className="font-display text-2xl font-extrabold uppercase leading-none text-navy-900">
        Flood<span className="text-brand-500">Watch</span>
      </span>
      <div className="flex items-stretch gap-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 border-b-[3px] px-4 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-brand-500 text-navy-900"
                  : "border-transparent text-slate-600 hover:bg-navy-50 hover:text-navy-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-brand-500" : ""}`} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
