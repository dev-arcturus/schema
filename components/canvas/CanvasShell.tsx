import type { ReactNode } from "react";
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
  return (
    <div className={cn("flex h-screen w-screen flex-col bg-canvas-bg", className)}>
      <div className="flex h-11 shrink-0 items-center border-b border-canvas-border bg-canvas-panel/60 px-4 backdrop-blur">
        {topBar}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">{children}</div>
        {rightPanel ? (
          <aside className="w-[320px] shrink-0 border-l border-canvas-border bg-canvas-panel/60 backdrop-blur">
            {rightPanel}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
