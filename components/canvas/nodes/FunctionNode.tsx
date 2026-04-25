"use client";

import type { LucideIcon } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Database, Layers, Shield, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphNode, NodeKind } from "@/extractor/types";

const KIND_META: Record<
  NodeKind,
  { icon: LucideIcon; tone: string; label: string }
> = {
  service: { icon: Layers, tone: "text-emerald-300", label: "service" },
  data_access: { icon: Database, tone: "text-amber-300", label: "data" },
  middleware: { icon: Shield, tone: "text-violet-300", label: "middleware" },
  model: { icon: Wrench, tone: "text-cyan-300", label: "model" },
  utility: { icon: Wrench, tone: "text-canvas-muted", label: "utility" },
  external: { icon: Wrench, tone: "text-canvas-muted", label: "external" },
  route_handler: { icon: Layers, tone: "text-sky-300", label: "router" },
};

export type FunctionNodeData = { node: GraphNode; failed?: boolean };

export function FunctionNode({ data, selected }: NodeProps) {
  const { node, failed } = data as FunctionNodeData;
  const meta = KIND_META[node.kind];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "relative w-[220px] rounded-md border bg-canvas-panel/90 px-3 py-2 transition-all",
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
        <Icon className={cn("h-3.5 w-3.5", meta.tone)} strokeWidth={2} />
        <span className="truncate font-mono text-[13px] text-canvas-ink">
          {node.name}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-2xs">
        <span className={cn("uppercase tracking-wider", meta.tone)}>
          {meta.label}
        </span>
        <span className="truncate text-canvas-subtle">{node.file}</span>
      </div>
    </div>
  );
}
