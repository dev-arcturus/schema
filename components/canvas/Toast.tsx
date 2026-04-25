"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function Toast() {
  const applyState = useStore((s) => s.applyState);
  const [shownPhase, setShownPhase] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    if (applyState.phase === "success") {
      setShownPhase("success");
      const t = setTimeout(() => setShownPhase(null), 3500);
      return () => clearTimeout(t);
    }
    if (applyState.phase === "error") {
      setShownPhase("error");
      const t = setTimeout(() => setShownPhase(null), 4500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [applyState]);

  if (!shownPhase || applyState.phase === "idle" || applyState.phase === "running") {
    return null;
  }

  const success = shownPhase === "success" && applyState.phase === "success";
  const error = shownPhase === "error" && applyState.phase === "error";
  const description =
    success
      ? applyState.description
      : error
        ? applyState.explanation ?? applyState.error
        : "";

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 animate-fade-in">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-md border bg-canvas-panel/95 px-3 py-2 shadow-panel backdrop-blur",
          success
            ? "border-emerald-500/40"
            : "border-rose-500/40",
        )}
      >
        {success ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
        )}
        <span className="text-xs text-canvas-ink">{description}</span>
      </div>
    </div>
  );
}
