"use client";

import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import type { NodeKind } from "@/extractor/types";

const KIND_ORDER: { kind: NodeKind; label: string; color: string }[] = [
  { kind: "route_handler", label: "routes", color: "bg-sky-400/80" },
  { kind: "service", label: "services", color: "bg-emerald-400/80" },
  { kind: "data_access", label: "data", color: "bg-amber-400/80" },
  { kind: "middleware", label: "middleware", color: "bg-violet-400/80" },
  { kind: "model", label: "models", color: "bg-cyan-400/80" },
  { kind: "utility", label: "utility", color: "bg-canvas-muted" },
];

export function KindFilter() {
  const graph = useStore((s) => s.graph);
  const visibleKinds = useStore((s) => s.visibleKinds);
  const toggleKind = useStore((s) => s.toggleKind);
  if (!graph) return null;

  const counts = countByKind(graph.nodes);
  const present = KIND_ORDER.filter((k) => (counts.get(k.kind) ?? 0) > 0);
  if (present.length <= 1) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border border-canvas-border bg-canvas-panel/95 px-1.5 py-1 shadow-panel backdrop-blur">
      {present.map((k) => {
        const count = counts.get(k.kind) ?? 0;
        const visible = visibleKinds[k.kind] ?? true;
        return (
          <button
            key={k.kind}
            onClick={() => toggleKind(k.kind)}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-2xs uppercase tracking-wider transition-colors",
              visible
                ? "text-canvas-ink hover:bg-canvas-bg/50"
                : "text-canvas-subtle line-through hover:text-canvas-muted",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-opacity",
                k.color,
                visible ? "" : "opacity-30",
              )}
            />
            {k.label}
            <span className="font-mono text-canvas-subtle">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function countByKind(nodes: { kind: NodeKind }[]): Map<NodeKind, number> {
  const m = new Map<NodeKind, number>();
  for (const n of nodes) m.set(n.kind, (m.get(n.kind) ?? 0) + 1);
  return m;
}
