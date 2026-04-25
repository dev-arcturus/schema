"use client";

import { Cable, Clock4, Shield, Scissors } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import type { OpDescriptor } from "@/ops/types";

const ICONS: Record<OpDescriptor["category"], React.ComponentType<{ className?: string }>> = {
  middleware: Shield,
  caching: Clock4,
  transform: Cable,
  extract: Scissors,
};

export function OpsMenu() {
  const selection = useStore((s) => s.selection);
  const ops = useStore((s) => s.applicableOps);
  const loading = useStore((s) => s.applicableLoading);
  const startOp = useStore((s) => s.startOp);
  const pendingOp = useStore((s) => s.pendingOp);
  const graph = useStore((s) => s.graph);

  if (!selection || !graph || pendingOp) return null;

  const targetLabel = labelForSelection(selection, graph);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-20 w-[420px] -translate-x-1/2 animate-fade-in rounded-lg border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
      <div className="flex items-center justify-between border-b border-canvas-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider text-canvas-subtle">
            {selection.kind}
          </span>
          <span className="truncate font-mono text-xs text-canvas-ink">
            {targetLabel}
          </span>
        </div>
        <span className="text-2xs text-canvas-subtle">esc</span>
      </div>
      {loading ? (
        <div className="px-3 py-3 text-xs text-canvas-muted">resolving ops…</div>
      ) : ops.length === 0 ? (
        <div className="px-3 py-3 text-xs text-canvas-muted">
          No ops available for this target.
        </div>
      ) : (
        <div className="flex flex-col py-1">
          {ops.map((op) => {
            const Icon = ICONS[op.category];
            return (
              <button
                key={op.name}
                onClick={() => startOp(op.name)}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-canvas-bg/40",
                )}
              >
                <Icon className="h-4 w-4 text-canvas-muted group-hover:text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-canvas-ink">{op.description}</div>
                  <div className="font-mono text-2xs text-canvas-subtle">
                    {op.name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function labelForSelection(
  sel: { kind: "node" | "edge"; id: string },
  graph: { nodes: { id: string; name: string }[]; edges: { id: string; source: string; target: string; relation: string }[] },
): string {
  if (sel.kind === "node") {
    const n = graph.nodes.find((x) => x.id === sel.id);
    return n?.name ?? sel.id;
  }
  const e = graph.edges.find((x) => x.id === sel.id);
  if (!e) return sel.id;
  return `${e.relation}`;
}
