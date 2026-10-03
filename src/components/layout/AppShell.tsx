import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { ViewportHeight } from "./ViewportHeight";

/**
 * The shell is exactly as tall as the visible area (`--app-h`, set from
 * `visualViewport` by ViewportHeight; `svh` until that runs), and the page
 * content scrolls inside `main`, never the document. That keeps the mobile
 * bottom navigation — a normal flex item at the end of the column rather
 * than `position: fixed` — on screen on every phone.
 *
 * `fill` additionally stops `main` from scrolling, so a screen can lay out
 * its own fixed + scrolling regions (used by the flood-prone-areas map + sheet).
 */
export function AppShell({ title, children, fill = false }: { title: string; children: ReactNode; fill?: boolean }) {
  return (
    <div className="flex h-[var(--app-h,100svh)] flex-col bg-surface md:flex-row">
      <ViewportHeight />
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className={fill ? "min-h-0 flex-1 overflow-clip p-2 md:p-6" : "min-h-0 flex-1 overflow-y-auto p-2 md:p-6"}>{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
