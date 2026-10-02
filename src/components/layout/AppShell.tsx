import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";

/**
 * The shell is exactly one dynamic viewport tall (`dvh` tracks the browser
 * toolbar showing/hiding), and the page content scrolls inside `main`, never
 * the document. That keeps the mobile bottom navigation — a normal flex item
 * at the end of the column rather than `position: fixed` — always on screen,
 * on every phone.
 *
 * `fill` additionally stops `main` from scrolling, so a screen can lay out
 * its own fixed + scrolling regions (used by the flood-prone-areas map + sheet).
 */
export function AppShell({ title, children, fill = false }: { title: string; children: ReactNode; fill?: boolean }) {
  return (
    <div className="flex h-dvh flex-col bg-slate-50 md:flex-row">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className={fill ? "min-h-0 flex-1 overflow-hidden p-3 md:p-6" : "min-h-0 flex-1 overflow-y-auto p-4 md:p-6"}>{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
