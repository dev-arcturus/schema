"use client";

import { GitCompareArrows } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function GraphBeforeAfterToggle() {
  const graphSnapshot = useStore((s) => s.graphSnapshot);
  const showBefore = useStore((s) => s.showGraphBefore);
  const toggle = useStore((s) => s.toggleGraphBefore);
  const planPhase = useStore((s) => s.planState.phase);
  const presenterMode = useStore((s) => s.presenterMode);

  // Only show when there's a snapshot and plan is running or done
  if (!graphSnapshot || (planPhase !== "running" && planPhase !== "done")) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-20 animate-fade-in">
      <button
        onClick={toggle}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-canvas-panel/95 shadow-panel backdrop-blur transition-all",
          showBefore
            ? "border-amber-400/50 text-amber-200"
            : "border-canvas-border text-canvas-muted hover:border-accent/40 hover:text-canvas-ink",
          presenterMode ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
        )}
      >
        <GitCompareArrows className={presenterMode ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {showBefore ? "Showing: Before" : "Showing: After"}
      </button>
    </div>
  );
}
