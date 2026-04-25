"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GraphNode } from "@/extractor/types";

const METHOD_STYLES: Record<string, { bg: string; ring: string; label: string }> = {
  GET: { bg: "bg-emerald-500/15", ring: "text-emerald-300", label: "GET" },
  POST: { bg: "bg-sky-500/15", ring: "text-sky-300", label: "POST" },
  PUT: { bg: "bg-amber-500/15", ring: "text-amber-300", label: "PUT" },
  PATCH: { bg: "bg-violet-500/15", ring: "text-violet-300", label: "PATCH" },
  DELETE: { bg: "bg-rose-500/15", ring: "text-rose-300", label: "DEL" },
};

export type RouteNodeData = { node: GraphNode; failed?: boolean };

export function RouteNode({ data, selected }: NodeProps) {
  const { node, failed } = data as RouteNodeData;
  const method = (node.meta?.httpMethod ?? "GET").toUpperCase();
  const path = node.meta?.httpPath ?? node.name;
  const style = METHOD_STYLES[method] ?? METHOD_STYLES.GET!;

  return (
    <div
      className={cn(
        "group relative w-[220px] rounded-md border bg-canvas-panel/90 px-3 py-2 transition-all",
        selected
          ? "border-accent shadow-node-selected"
          : "border-canvas-border shadow-node",
        failed ? "border-accent-danger ring-2 ring-accent-danger/40" : "",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-canvas-border !bg-canvas-panel"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-canvas-border !bg-canvas-panel"
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider",
            style.bg,
            style.ring,
          )}
        >
          {style.label}
        </span>
        <span className="truncate font-mono text-[13px] text-canvas-ink">
          {path}
        </span>
      </div>
      <div className="mt-1 truncate text-2xs text-canvas-subtle">{node.file}</div>
    </div>
  );
}
