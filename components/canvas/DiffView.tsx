"use client";

import { cn } from "@/lib/utils";

export function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return (
      <div className="px-3 py-2 text-xs text-canvas-muted">
        No textual changes.
      </div>
    );
  }
  const lines = diff.split("\n");
  return (
    <pre className="max-h-[320px] overflow-auto bg-canvas-bg/60 px-3 py-2 font-mono text-2xs leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className={cn(lineClass(line), "whitespace-pre")}>
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

function lineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) {
    return "text-canvas-muted";
  }
  if (line.startsWith("+")) return "text-emerald-300";
  if (line.startsWith("-")) return "text-rose-300";
  if (line.startsWith("@@")) return "text-canvas-subtle";
  if (line.startsWith("===")) return "text-canvas-subtle";
  return "text-canvas-muted";
}
