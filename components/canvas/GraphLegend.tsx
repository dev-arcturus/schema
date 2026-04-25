"use client";

import { useEffect, useState } from "react";
import { Database, Layers, Shield, Wrench, X, Zap } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

const LEGEND_ITEMS = [
  { kind: "route_handler", label: "Route", color: "bg-kind-route", icon: Zap, description: "HTTP endpoint handler" },
  { kind: "service", label: "Service", color: "bg-kind-service", icon: Layers, description: "Business logic" },
  { kind: "data_access", label: "Data", color: "bg-kind-data", icon: Database, description: "Database / persistence" },
  { kind: "middleware", label: "Middleware", color: "bg-kind-middleware", icon: Shield, description: "Request pipeline" },
  { kind: "utility", label: "Utility", color: "bg-kind-utility", icon: Wrench, description: "Helpers and utils" },
] as const;

const EDGE_ITEMS = [
  { label: "calls", stroke: "bg-canvas-subtle", dash: false },
  { label: "middleware", stroke: "bg-violet-400", dash: true },
  { label: "registers", stroke: "bg-accent", dash: false },
];

export function GraphLegend() {
  const showLegend = useStore((s) => s.showLegend);
  const dismissLegend = useStore((s) => s.dismissLegend);
  const graph = useStore((s) => s.graph);
  const presenterMode = useStore((s) => s.presenterMode);
  const [visible, setVisible] = useState(false);

  // Only show legend on first graph load
  useEffect(() => {
    if (graph && showLegend) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [graph, showLegend]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      dismissLegend();
    }, 8000);
    return () => clearTimeout(t);
  }, [visible, dismissLegend]);

  if (!visible || !graph) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-16 z-20 -translate-x-1/2 animate-fade-in">
      <div className={cn(
        "flex items-stretch gap-0 rounded-xl border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur",
        presenterMode ? "px-1 py-1" : "px-1 py-0.5",
      )}>
        {/* Node types */}
        <div className="flex items-center gap-3 px-3">
          {LEGEND_ITEMS.map(({ kind, label, color, icon: Icon }) => (
            <div key={kind} className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", color)} />
              <Icon className={cn("text-canvas-muted", presenterMode ? "h-3.5 w-3.5" : "h-3 w-3")} />
              <span className={cn("text-canvas-ink", presenterMode ? "text-xs" : "text-2xs")}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-canvas-border" />

        {/* Edge types */}
        <div className="flex items-center gap-3 px-3">
          {EDGE_ITEMS.map(({ label, stroke, dash }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="flex w-4 items-center">
                <div className={cn(
                  "h-px w-full",
                  stroke,
                  dash && "border-t border-dashed border-violet-400 bg-transparent",
                )} />
              </div>
              <span className={cn("text-canvas-muted", presenterMode ? "text-xs" : "text-2xs")}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismissLegend}
          className="ml-1 flex items-center rounded px-1.5 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
