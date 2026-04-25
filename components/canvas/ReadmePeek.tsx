"use client";

import { useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function ReadmePeek() {
  const readme = useStore((s) => s.readme);
  const origin = useStore((s) => s.origin);
  const [open, setOpen] = useState(false);

  if (!readme || !readme.found || !readme.excerpt) return null;

  const title =
    origin?.kind === "github"
      ? `${origin.owner}/${origin.repo}`
      : readme.file ?? "README";

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10">
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-canvas-border bg-canvas-panel/90 px-3 py-1.5 text-xs text-canvas-muted shadow-panel backdrop-blur",
          "transition-colors hover:text-canvas-ink",
        )}
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span className="font-mono text-2xs">README</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-10 w-[420px] animate-fade-in rounded-md border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between border-b border-canvas-border px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <BookOpen className="h-3.5 w-3.5 text-canvas-muted" />
              <span className="text-canvas-ink">{title}</span>
              {readme.file ? (
                <span className="font-mono text-2xs text-canvas-subtle">
                  {readme.file}
                </span>
              ) : null}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="max-h-[420px] overflow-auto px-3 py-2 font-mono text-2xs leading-relaxed text-canvas-muted whitespace-pre-wrap">
            {readme.excerpt}
          </pre>
          <div className="border-t border-canvas-border px-3 py-2 text-2xs text-canvas-subtle">
            Used as context for the clustering pass.
          </div>
        </div>
      ) : null}
    </div>
  );
}
