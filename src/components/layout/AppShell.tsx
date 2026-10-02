import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * `fill` pins the shell to the viewport height and stops the page itself from
 * scrolling, so a screen can lay out its own fixed + scrolling regions
 * (used by the flood-prone-areas map + sheet).
 */
export function AppShell({ title, children, fill = false }: { title: string; children: ReactNode; fill?: boolean }) {
  return (
    <div className={fill ? "flex h-dvh bg-slate-50" : "flex min-h-screen bg-slate-50"}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className={fill ? "min-h-0 flex-1 overflow-hidden p-3 md:p-6" : "flex-1 overflow-y-auto p-6"}>{children}</main>
      </div>
    </div>
  );
}
