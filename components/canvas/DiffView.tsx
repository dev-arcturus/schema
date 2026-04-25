"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/state/store";

type FileHunk = {
  file: string;
  lines: string[];
};

function parseDiff(diff: string): FileHunk[] {
  const hunks: FileHunk[] = [];
  let current: FileHunk | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("===") || line.startsWith("diff ")) {
      // new file section
      if (current) hunks.push(current);
      current = { file: "", lines: [] };
    } else if (line.startsWith("---") && current) {
      // original file header
      const m = line.match(/^---\s+(.+)/);
      if (m && !current.file) current.file = cleanPath(m[1]!);
      current.lines.push(line);
    } else if (line.startsWith("+++") && current) {
      const m = line.match(/^\+\+\+\s+(.+)/);
      if (m) current.file = cleanPath(m[1]!);
      current.lines.push(line);
    } else if (current) {
      current.lines.push(line);
    } else {
      // preamble before any file header — start a hunk
      if (!current) current = { file: "", lines: [] };
      current.lines.push(line);
    }
  }
  if (current) hunks.push(current);
  return hunks.filter((h) => h.lines.some((l) => l.startsWith("+") || l.startsWith("-")));
}

function cleanPath(p: string): string {
  return p.replace(/^[ab]\//, "").replace(/^\.\//, "");
}

export function DiffView({
  diff,
  defaultExpanded = true,
  compact = false,
}: {
  diff: string;
  defaultExpanded?: boolean;
  compact?: boolean;
}) {
  const presenterMode = useStore((s) => s.presenterMode);
  const setFullscreenDiff = useStore((s) => s.setFullscreenDiff);

  if (!diff.trim()) {
    return (
      <div className="px-3 py-2 text-xs text-canvas-muted">
        No textual changes.
      </div>
    );
  }

  const hunks = parseDiff(diff);
  if (hunks.length === 0) {
    return (
      <pre className={cn(
        "overflow-auto bg-canvas-bg/60 px-3 py-2 font-mono leading-relaxed",
        presenterMode ? "text-xs" : "text-2xs",
      )}>
        {diff}
      </pre>
    );
  }

  return (
    <div className="flex flex-col">
      {hunks.map((hunk, i) => (
        <FileHunkView
          key={`${hunk.file}-${i}`}
          hunk={hunk}
          defaultExpanded={defaultExpanded}
          compact={compact}
          presenterMode={presenterMode}
          onMaximize={() => setFullscreenDiff({ diff, description: hunk.file, files: hunks.map(h => h.file) })}
        />
      ))}
    </div>
  );
}

function FileHunkView({
  hunk,
  defaultExpanded,
  compact,
  presenterMode,
  onMaximize,
}: {
  hunk: FileHunk;
  defaultExpanded: boolean;
  compact: boolean;
  presenterMode: boolean;
  onMaximize: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const added = hunk.lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removed = hunk.lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  return (
    <div className="border-b border-canvas-border last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); } }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-canvas-bg/40",
          presenterMode ? "text-xs" : "text-2xs",
        )}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-canvas-subtle" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-canvas-subtle" />
        )}
        <FileCode className="h-3 w-3 shrink-0 text-canvas-muted" />
        <span className="min-w-0 flex-1 truncate font-mono text-canvas-ink">
          {hunk.file || "unknown"}
        </span>
        <span className="shrink-0 font-mono text-emerald-400">+{added}</span>
        <span className="shrink-0 font-mono text-rose-400">-{removed}</span>
        {!compact && (
          <button
            onClick={(e) => { e.stopPropagation(); onMaximize(); }}
            className="shrink-0 rounded p-0.5 text-canvas-subtle hover:text-canvas-ink"
            title="Fullscreen diff"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {expanded && (
        <pre className={cn(
          "overflow-x-auto bg-canvas-bg/40 font-mono leading-relaxed",
          compact ? "max-h-[200px]" : "max-h-[400px]",
          presenterMode ? "text-xs" : "text-2xs",
        )}>
          {hunk.lines.map((line, j) => {
            if (line.startsWith("+++") || line.startsWith("---")) return null;
            return (
              <div key={j} className={cn("px-3 whitespace-pre", lineClass(line))}>
                {line || " "}
              </div>
            );
          })}
        </pre>
      )}
    </div>
  );
}

function lineClass(line: string): string {
  if (line.startsWith("+")) return "bg-emerald-500/10 text-emerald-300";
  if (line.startsWith("-")) return "bg-rose-500/10 text-rose-300";
  if (line.startsWith("@@")) return "bg-canvas-bg/80 text-accent py-0.5";
  return "text-canvas-muted";
}
