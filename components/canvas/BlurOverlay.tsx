"use client";

import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

/**
 * Progressive blur + tint behind the command bar when it's focused.
 * Uses a vertical gradient mask so the blur fades upward — strongest at the
 * bottom (right above the textbar), invisible at the top.
 */
export function BlurOverlay() {
  const focused = useStore((s) => s.commandBarFocused);
  const planActive = useStore(
    (s) =>
      s.planState.phase === "thinking" ||
      s.planState.phase === "preview" ||
      s.planState.phase === "running",
  );
  const visible = focused || planActive;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-10 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          maskImage:
            "linear-gradient(to top, black 0%, black 25%, transparent 60%)",
          WebkitMaskImage:
            "linear-gradient(to top, black 0%, black 25%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{
          maskImage:
            "linear-gradient(to top, black 0%, black 12%, transparent 35%)",
          WebkitMaskImage:
            "linear-gradient(to top, black 0%, black 12%, transparent 35%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, hsl(220 14% 4% / 0.7), hsl(220 14% 4% / 0.0) 60%)",
        }}
      />
    </div>
  );
}
