"use client";

import { Loader2, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function PlanProgress() {
  const planState = useStore((s) => s.planState);

  if (
    planState.phase !== "running" &&
    planState.phase !== "thinking" &&
    planState.phase !== "done"
  ) {
    return null;
  }

  if (planState.phase === "thinking") {
    return (
      <Badge tone="thinking" icon={<Sparkles className="h-3 w-3 animate-pulse" />}>
        thinking · {truncate(planState.prompt, 64)}
      </Badge>
    );
  }

  if (planState.phase === "running") {
    const total = planState.plan.steps.length;
    const idx = planState.currentIndex;
    const step = planState.plan.steps[idx];
    const desc = step?.description ?? "";
    return (
      <Badge tone="running" icon={<Loader2 className="h-3 w-3 animate-spin" />}>
        step {idx + 1} of {total} · {truncate(desc, 64)}
      </Badge>
    );
  }

  if (planState.phase === "done") {
    if (planState.ok) {
      return (
        <Badge
          tone="success"
          icon={<CheckCircle2 className="h-3 w-3" />}
        >
          {planState.plan.steps.length} step(s) applied · tests green
        </Badge>
      );
    }
    return (
      <Badge tone="error" icon={<AlertTriangle className="h-3 w-3" />}>
        plan stopped · {planState.results.filter((r) => r.status === "success").length}{"/"}
        {planState.plan.steps.length} steps applied
      </Badge>
    );
  }

  return null;
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: "thinking" | "running" | "success" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "running" || tone === "thinking"
      ? "border-amber-400/40 text-amber-200"
      : tone === "success"
        ? "border-emerald-400/40 text-emerald-200"
        : "border-rose-400/40 text-rose-200";
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-30 flex max-w-[420px] animate-fade-in">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border bg-canvas-panel/95 px-3 py-1.5 text-2xs shadow-panel backdrop-blur",
          cls,
        )}
      >
        {icon}
        <span className="truncate">{children}</span>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
