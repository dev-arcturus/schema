"use client";

import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function CoverageToggle() {
  const visible = useStore((s) => s.coverageVisible);
  const toggle = useStore((s) => s.toggleCoverage);
  const covered = useStore((s) => s.coveredNodeIds);
  const total = useStore((s) => s.graph?.nodes.length ?? 0);
  const tests = useStore((s) => s.testFileCount);
  const hasGraph = useStore((s) => !!s.graph);

  if (!hasGraph) return null;
  const pct = total > 0 ? Math.round((covered.size / total) * 100) : 0;

  return (
    <button
      onClick={toggle}
      className={cn(
        "pointer-events-auto absolute right-4 top-32 z-10 flex items-center gap-2 rounded-md border bg-canvas-panel/90 px-3 py-1.5 text-2xs uppercase tracking-wider shadow-panel backdrop-blur transition-colors",
        visible
          ? "border-emerald-300/40 text-emerald-200"
          : "border-canvas-border text-canvas-muted hover:text-canvas-ink",
      )}
      title={`${covered.size}/${total} nodes reachable from ${tests} test file(s)`}
    >
      {visible ? (
        <Eye className="h-3 w-3" />
      ) : (
        <EyeOff className="h-3 w-3" />
      )}
      <ShieldCheck className="h-3 w-3" />
      coverage {pct}%
    </button>
  );
}
