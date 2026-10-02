"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./navLinks";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="flex h-16 items-center border-b border-slate-200 px-5">
        <span className="font-display text-3xl font-extrabold uppercase leading-none text-navy-900">
          Flood<span className="text-brand-500">Watch</span>
        </span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-brand-500 bg-navy-50 text-navy-900"
                  : "border-transparent text-slate-600 hover:bg-navy-50 hover:text-navy-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-brand-500" : ""}`} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
