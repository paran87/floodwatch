"use client";

import { useEffect } from "react";

/**
 * Publishes the height of the area the user can actually see as `--app-h` on
 * <html>. CSS viewport units (`vh`/`dvh`) can come out taller than the visible
 * area on some phones (browser toolbar, system navigation bar, foldables),
 * which pushes the bottom navigation off-screen; `visualViewport` reports the
 * real visible height. Ignored while pinch-zoomed so the layout doesn't jump.
 */
export function ViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    function update() {
      if (vv && vv.scale > 1.01) return;
      // Embedded (e.g. in the OKB Command Center iframe), visualViewport can report the
      // top-level page's size rather than this frame's, so trust the frame's own height.
      const embedded = window.self !== window.top;
      const height = Math.round(vv && !embedded ? vv.height : window.innerHeight);
      root.style.setProperty("--app-h", `${height}px`);
    }

    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("pageshow", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  return null;
}
