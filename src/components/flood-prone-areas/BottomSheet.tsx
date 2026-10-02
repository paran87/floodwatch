"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";

const HANDLE_HEIGHT = 56;
const HALF = 0.45;
const FULL = 0.92;
const TAP_SLOP = 4;

export type SheetSnap = "hidden" | "half" | "full";

/**
 * Mobile: a bottom sheet over its (relatively positioned) parent, dragged
 * up/down by its handle to show or hide, snapping to hidden/half/full.
 * md+: a plain flex panel that fills the remaining space — no dragging.
 * The content area scrolls on both axes with always-visible scrollbars.
 */
export function BottomSheet({
  title,
  children,
  onHeightChange,
  snapRequest,
}: {
  title: ReactNode;
  children: ReactNode;
  /** Reports the sheet's current pixel height (0 on md+, where it isn't an overlay). */
  onHeightChange?: (height: number) => void;
  /** Change `nonce` to ask the sheet to snap (e.g. to reveal the map after a selection). */
  snapRequest?: { snap: SheetSnap; nonce: number };
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null); // null → CSS default (HALF of parent)
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);

  const parentHeight = () => panelRef.current?.parentElement?.clientHeight ?? 0;
  const snapHeights = useCallback(() => {
    const parent = parentHeight();
    return { hidden: HANDLE_HEIGHT, half: Math.round(parent * HALF), full: Math.round(parent * FULL) };
  }, []);

  const isOverlay = () => (panelRef.current ? getComputedStyle(panelRef.current).position === "absolute" : false);

  const report = useCallback(
    (h: number) => onHeightChange?.(isOverlay() ? h : 0),
    [onHeightChange],
  );

  useEffect(() => {
    report(panelRef.current?.offsetHeight ?? 0);
    const onResize = () => {
      setHeight(null);
      report(panelRef.current?.offsetHeight ?? 0);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [report]);

  useEffect(() => {
    if (!snapRequest || !isOverlay()) return;
    const target = snapHeights()[snapRequest.snap];
    const current = panelRef.current?.offsetHeight ?? 0;
    // Only ever lower the sheet to reveal the map; never pop it up on its own.
    if (snapRequest.snap === "full" || current > target) {
      setHeight(target);
      report(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapRequest?.nonce]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isOverlay()) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startHeight: panelRef.current?.offsetHeight ?? 0, moved: false };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > TAP_SLOP) d.moved = true;
    const next = Math.min(snapHeights().full, Math.max(HANDLE_HEIGHT, d.startHeight + delta));
    setHeight(next);
    report(next);
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const snaps = snapHeights();
    const current = panelRef.current?.offsetHeight ?? d.startHeight;
    let target: number;
    if (!d.moved) {
      // A tap toggles between hidden and half.
      target = current > snaps.hidden + 8 ? snaps.hidden : snaps.half;
    } else {
      target = [snaps.hidden, snaps.half, snaps.full].reduce((best, s) => (Math.abs(s - current) < Math.abs(best - current) ? s : best));
    }
    setHeight(target);
    report(target);
  }

  return (
    <div
      ref={panelRef}
      style={{ ["--sheet-h" as string]: height === null ? `${HALF * 100}%` : `${height}px` }}
      className={`absolute inset-x-0 bottom-0 z-[1100] flex h-[var(--sheet-h)] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_-4px_16px_rgba(15,23,42,0.15)] md:static md:z-auto md:h-auto md:min-h-0 md:flex-1 md:rounded-lg md:shadow-none ${dragging ? "" : "transition-[height] duration-200"}`}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        aria-label="Drag up or down to show or hide the list"
        className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center gap-1 border-b border-slate-100 px-4 pb-2 pt-2 active:cursor-grabbing md:cursor-default md:flex-row md:justify-between md:pt-2"
        style={{ minHeight: HANDLE_HEIGHT }}
      >
        <span className="h-1.5 w-10 rounded-full bg-slate-300 md:hidden" aria-hidden />
        <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
          <ChevronUp className="h-3.5 w-3.5 md:hidden" aria-hidden />
          {title}
        </span>
      </div>
      <div className="scrollbar-visible min-h-0 flex-1 overflow-auto overscroll-contain">{children}</div>
    </div>
  );
}
