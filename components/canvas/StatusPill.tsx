"use client";

import { Github, Loader2 } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function StatusPill() {
  const graph = useStore((s) => s.graph);
  const loading = useStore((s) => s.loading);
  const applyState = useStore((s) => s.applyState);
  const clusterSource = useStore((s) => s.clusterSource);
  const origin = useStore((s) => s.origin);

  let label = "idle";
  let tone = "bg-accent-success/80";
  if (loading) {
    label = "extracting";
    tone = "bg-amber-400/80";
  } else if (applyState.phase === "running") {
    label = "applying";
    tone = "bg-amber-400/80";
  } else if (applyState.phase === "error") {
    label = "rolled back";
    tone = "bg-rose-400/80";
  } else if (applyState.phase === "success") {
    label = "applied";
    tone = "bg-emerald-400/80";
  } else if (graph) {
    label = clusterSource === "llm" ? "ready · llm" : "ready · fallback";
  }

  return (
    <div className="flex items-center gap-3">
      {origin?.kind === "github" ? (
        <a
          href={origin.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-2xs text-canvas-muted transition-colors hover:text-canvas-ink"
        >
          <Github className="h-3 w-3" />
          <span className="font-mono">{origin.owner}/{origin.repo}</span>
        </a>
      ) : null}
      <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-canvas-subtle">
        {loading || applyState.phase === "running" ? (
          <Loader2 className="h-3 w-3 animate-spin text-amber-300" />
        ) : (
          <span className={cn("h-1.5 w-1.5 rounded-full", tone)} />
        )}
        <span>{label}</span>
      </div>
    </div>
  );
}
