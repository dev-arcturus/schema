"use client";

import { useEffect } from "react";
import { X, FileCode } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function FullscreenDiffOverlay() {
  const fullscreenDiff = useStore((s) => s.fullscreenDiff);
  const setFullscreenDiff = useStore((s) => s.setFullscreenDiff);

  useEffect(() => {
    if (!fullscreenDiff) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setFullscreenDiff(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [fullscreenDiff, setFullscreenDiff]);

  if (!fullscreenDiff) return null;

  const lines = fullscreenDiff.diff.split("\n");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas-bg/98 backdrop-blur-sm animate-fade-in">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-canvas-border bg-canvas-panel/80 px-6 py-3">
        <div className="flex items-center gap-3">
          <FileCode className="h-5 w-5 text-canvas-muted" />
          <div>
            <div className="text-base font-medium text-canvas-ink">
              {fullscreenDiff.description}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-canvas-subtle">
              {fullscreenDiff.files.map((f) => (
                <span key={f} className="font-mono">{f}</span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setFullscreenDiff(null)}
          className="flex items-center gap-2 rounded-md border border-canvas-border px-3 py-1.5 text-sm text-canvas-muted transition-colors hover:bg-canvas-bg/60 hover:text-canvas-ink"
        >
          <X className="h-4 w-4" />
          Close
          <kbd className="ml-1 rounded border border-canvas-border px-1 text-2xs text-canvas-subtle">Esc</kbd>
        </button>
      </div>

      {/* Diff content — large, readable */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <pre className="font-mono text-sm leading-relaxed">
          {lines.map((line, i) => {
            if (line.startsWith("+++") || line.startsWith("---")) return null;
            if (line.startsWith("===") || line.startsWith("diff ")) {
              return (
                <div key={i} className="mt-6 mb-2 border-b border-canvas-border pb-2 text-base font-medium text-canvas-ink first:mt-0">
                  {line.replace(/^===\s*/, "").replace(/^diff\s*/, "")}
                </div>
              );
            }
            return (
              <div
                key={i}
                className={cn("px-4 py-px whitespace-pre", fullscreenLineClass(line))}
              >
                <span className="mr-4 inline-block w-8 text-right text-canvas-subtle/40 select-none">
                  {i + 1}
                </span>
                {line || " "}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

function fullscreenLineClass(line: string): string {
  if (line.startsWith("+")) return "bg-emerald-500/8 text-emerald-300";
  if (line.startsWith("-")) return "bg-rose-500/8 text-rose-300";
  if (line.startsWith("@@")) return "bg-accent/5 text-accent py-1 mt-2";
  return "text-canvas-muted";
}
