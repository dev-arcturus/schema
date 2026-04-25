"use client";

import { useState } from "react";
import { Lightbulb, Loader2, ArrowRight, X } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function InsightsRail() {
  const insights = useStore((s) => s.insights);
  const loading = useStore((s) => s.insightsLoading);
  const submit = useStore((s) => s.submitPrompt);
  const planState = useStore((s) => s.planState);
  const [expanded, setExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const hasGraph = useStore((s) => !!s.graph);
  if (!hasGraph) return null;
  if (planState.phase !== "idle" && planState.phase !== "done") return null;

  const visible = insights.filter((i) => !dismissedIds.has(i.id));

  return (
    <div className="pointer-events-auto absolute left-4 top-28 z-10 w-[280px]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas-panel/90 px-3 py-1.5 text-2xs uppercase tracking-wider text-canvas-muted shadow-panel backdrop-blur transition-colors hover:text-canvas-ink",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Lightbulb className="h-3 w-3 text-amber-300" />
          insights
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {!loading && visible.length > 0 ? (
            <span className="rounded-full bg-amber-300/20 px-1.5 text-2xs text-amber-200">
              {visible.length}
            </span>
          ) : null}
        </span>
        <span className="font-mono text-2xs">{expanded ? "−" : "+"}</span>
      </button>

      {expanded ? (
        <div className="mt-2 flex max-h-[calc(100vh-220px)] flex-col gap-2 overflow-y-auto">
          {!loading && visible.length === 0 ? (
            <div className="rounded-md border border-canvas-border bg-canvas-panel/70 px-3 py-2 text-2xs text-canvas-muted">
              No architectural smells detected.
            </div>
          ) : null}
          {visible.map((insight) => (
            <div
              key={insight.id}
              className="group rounded-md border border-canvas-border bg-canvas-panel/90 p-3 shadow-panel backdrop-blur"
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    insight.severity === "high"
                      ? "bg-rose-400"
                      : insight.severity === "medium"
                        ? "bg-amber-400"
                        : "bg-canvas-muted",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-canvas-ink">{insight.title}</div>
                  <div className="mt-1 text-2xs text-canvas-muted">{insight.rationale}</div>
                </div>
                <button
                  onClick={() =>
                    setDismissedIds((prev) => {
                      const n = new Set(prev);
                      n.add(insight.id);
                      return n;
                    })
                  }
                  className="rounded p-0.5 text-canvas-subtle opacity-0 transition-opacity hover:text-canvas-ink group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={() => void submit(insight.suggestedPrompt)}
                className="mt-2 inline-flex items-center gap-1 rounded bg-canvas-bg/70 px-2 py-1 text-2xs text-canvas-ink transition-colors hover:bg-accent hover:text-canvas-bg"
              >
                {insight.suggestedPrompt}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
