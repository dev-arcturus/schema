"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function CanvasShell({
  topBar,
  rightPanel,
  children,
  className,
}: {
  topBar?: ReactNode;
  rightPanel?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const width = useStore((s) => s.rightPanelWidth);
  const setWidth = useStore((s) => s.setRightPanelWidth);
  const draggingRef = useRef(false);

  // Hydrate panel width from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem("schema:rightPanelWidth");
      if (saved) setWidth(Number(saved));
    } catch {
      // ignore
    }
  }, [setWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = window.innerWidth - e.clientX;
      setWidth(next);
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setWidth]);

  return (
    <div className={cn("flex h-screen w-screen flex-col bg-canvas-bg", className)}>
      <div className="relative z-50 flex h-12 shrink-0 items-center gap-2 border-b border-canvas-border bg-canvas-panel/60 px-4 backdrop-blur">
        {topBar}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative z-0 min-w-0 flex-1">{children}</div>
        {rightPanel ? (
          <aside
            style={{ width }}
            className="relative shrink-0 border-l border-canvas-border bg-canvas-panel/60 backdrop-blur"
          >
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                draggingRef.current = true;
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
              }}
              className="absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize hover:bg-accent/30 active:bg-accent/40"
              aria-label="Resize panel"
              title="Drag to resize"
            />
            <div className="h-full overflow-hidden">{rightPanel}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
