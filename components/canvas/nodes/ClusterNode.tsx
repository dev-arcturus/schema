"use client";

import type { NodeProps } from "@xyflow/react";

export type ClusterNodeData = { name: string };

export function ClusterNode({ data }: NodeProps) {
  const { name } = data as ClusterNodeData;
  return (
    <div className="pointer-events-none h-full w-full rounded-xl border border-canvas-border/70 bg-canvas-panel/30">
      <div className="absolute -top-2.5 left-3 rounded-full border border-canvas-border bg-canvas-panel px-2 py-0.5 font-mono text-2xs uppercase tracking-wider text-canvas-muted">
        {name}
      </div>
    </div>
  );
}
