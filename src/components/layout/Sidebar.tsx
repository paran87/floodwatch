import Link from "next/link";
import { LayoutDashboard, MapPinned, FileWarning } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/flood-prone-areas", label: "Flood-Prone Areas", icon: MapPinned },
  { href: "/reports", label: "Reports", icon: FileWarning },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <span className="text-lg font-semibold text-sky-700">FloodWatch</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
