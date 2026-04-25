"use client";

import { Monitor } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function PresenterToggle() {
  const presenterMode = useStore((s) => s.presenterMode);
  const toggle = useStore((s) => s.togglePresenterMode);

  return (
    <div className="pointer-events-auto absolute right-4 bottom-4 z-20">
      <button
        onClick={toggle}
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-canvas-panel/95 shadow-panel backdrop-blur transition-all",
          presenterMode
            ? "border-accent/50 text-accent px-3 py-1.5 text-xs"
            : "border-canvas-border text-canvas-muted px-2.5 py-1.5 text-2xs hover:border-accent/40 hover:text-canvas-ink",
        )}
        title="Toggle presenter mode (P)"
      >
        <Monitor className="h-3.5 w-3.5" />
        {presenterMode ? "Presenter ON" : "Presenter"}
      </button>
    </div>
  );
}
