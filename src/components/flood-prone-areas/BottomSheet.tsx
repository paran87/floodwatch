"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";

const HANDLE_HEIGHT = 56;
const HALF = 0.45;
const FULL = 0.92;
/** Past this share of the parent, a map selection pulls the sheet back down so the pin isn't hidden. */
const COVERS_MAP = 0.6;
const TAP_SLOP = 4;
/** Released this close to the bottom, the sheet settles fully hidden. */
const HIDE_SNAP = 24;

export type SheetSnap = "hidden" | "half" | "full";

/**
 * Mobile: a bottom sheet over its (relatively positioned) parent. Drag the
 * handle and it follows the finger and stays wherever it is released; a tap
 * toggles hidden/half. md+: a plain flex panel that fills the remaining
 * space — no dragging. The content area scrolls on both axes with
 * always-visible scrollbars.
 *
 * While dragging, the height is written straight to the element (no React
 * state), coalesced to one write per frame. Re-rendering the page on every
 * pointer move would re-render the whole table; the height is only
 * committed to state and reported to the parent on release.
 */
export function BottomSheet({
  title,
  children,
  onHeightChange,
  snapRequest,
}: {
  title: ReactNode;
  children: ReactNode;
  /** Reports the sheet's pixel height once it settles (0 on md+, where it isn't an overlay). */
  onHeightChange?: (height: number) => void;
  /** Change `nonce` to ask the sheet to snap (e.g. to reveal the map after a selection). */
  snapRequest?: { snap: SheetSnap; nonce: number };
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null); // null → CSS default (HALF of parent)
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null);
  const pendingHeight = useRef(0);
  const frame = useRef<number | null>(null);

  const parentHeight = () => panelRef.current?.parentElement?.clientHeight ?? 0;
  const isOverlay = () => (panelRef.current ? getComputedStyle(panelRef.current).position === "absolute" : false);
  const maxHeight = () => Math.round(parentHeight() * FULL);

  const writeHeight = (h: number) => panelRef.current?.style.setProperty("--sheet-h", `${h}px`);

  const report = useCallback((h: number) => onHeightChange?.(isOverlay() ? h : 0), [onHeightChange]);

  const settle = useCallback(
    (h: number) => {
      writeHeight(h);
      setHeight(h);
      report(h);
    },
    [report],
  );

  useEffect(() => {
    report(panelRef.current?.offsetHeight ?? 0);
    const onResize = () => {
      setHeight(null);
      panelRef.current?.style.removeProperty("--sheet-h");
      report(panelRef.current?.offsetHeight ?? 0);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [report]);

  useEffect(() => {
    if (!snapRequest || !isOverlay()) return;
    const parent = parentHeight();
    const current = panelRef.current?.offsetHeight ?? 0;
    const targets = { hidden: HANDLE_HEIGHT, half: Math.round(parent * HALF), full: maxHeight() };
    // Only ever lower the sheet to reveal the map when it's covering most of it; never pop it up on its own.
    if (snapRequest.snap === "full" || (snapRequest.snap === "half" ? current > parent * COVERS_MAP : current > targets[snapRequest.snap])) {
      settle(targets[snapRequest.snap]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapRequest?.nonce]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isOverlay()) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startHeight = panelRef.current?.offsetHeight ?? 0;
    drag.current = { startY: e.clientY, startHeight, moved: false };
    pendingHeight.current = startHeight;
    panelRef.current?.setAttribute("data-dragging", "true"); // turns the settle transition off while following the finger
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > TAP_SLOP) d.moved = true;
    pendingHeight.current = Math.min(maxHeight(), Math.max(HANDLE_HEIGHT, d.startHeight + delta));
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        writeHeight(pendingHeight.current);
      });
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    panelRef.current?.removeAttribute("data-dragging");
    if (!d) return;

    if (!d.moved) {
      // A tap toggles between hidden and half.
      const current = panelRef.current?.offsetHeight ?? d.startHeight;
      settle(current > HANDLE_HEIGHT + 8 ? HANDLE_HEIGHT : Math.round(parentHeight() * HALF));
      return;
    }
    // Stay exactly where it was released — except right at the bottom edge, where it settles fully hidden.
    const released = pendingHeight.current;
    settle(released < HANDLE_HEIGHT + HIDE_SNAP ? HANDLE_HEIGHT : released);
  }

  return (
    <div
      ref={panelRef}
      style={{ ["--sheet-h" as string]: height === null ? `${HALF * 100}%` : `${height}px` }}
      className="absolute inset-x-0 bottom-0 z-[1100] flex h-[var(--sheet-h)] flex-col overflow-hidden rounded-t-2xl border border-t-[3px] border-slate-200 border-t-navy-700 bg-white shadow-[0_-4px_16px_rgba(11,42,107,0.18)] transition-[height] duration-200 data-[dragging=true]:transition-none md:static md:z-auto md:h-auto md:min-h-0 md:flex-1 md:rounded-xl md:shadow-none md:transition-none"
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
        <span className="h-1.5 w-10 rounded-full bg-navy-200 md:hidden" aria-hidden />
        <span className="flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-wider text-navy-800">
          <ChevronUp className="h-3.5 w-3.5 md:hidden" aria-hidden />
          {title}
        </span>
      </div>
      <div className="scrollbar-visible min-h-0 flex-1 overflow-auto overscroll-contain">{children}</div>
    </div>
  );
}
