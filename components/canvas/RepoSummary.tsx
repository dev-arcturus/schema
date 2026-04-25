"use client";

import { useStore } from "@/state/store";

export function RepoSummary() {
  const summary = useStore((s) => s.summary);
  const origin = useStore((s) => s.origin);
  const planState = useStore((s) => s.planState);

  if (!summary) return null;
  // Keep the bar invisible when a plan is active so it doesn't compete with the plan panel.
  if (planState.phase === "preview" || planState.phase === "running") return null;

  const subject =
    origin?.kind === "github" ? `${origin.owner}/${origin.repo}` : "this repo";

  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 z-10 max-w-[640px] -translate-x-1/2 px-4">
      <div className="rounded-md border border-canvas-border bg-canvas-panel/85 px-3 py-2 text-2xs text-canvas-muted shadow-panel backdrop-blur">
        <span className="text-canvas-subtle">{subject} —</span> {summary}
      </div>
    </div>
  );
}
