"use client";

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["?"], description: "Toggle this cheat sheet" },
  { keys: ["⌘", "I"], description: "Focus the command bar" },
  { keys: ["⌘", "K"], description: "Open node search" },
  { keys: ["/"], description: "Open node search" },
  { keys: ["Esc"], description: "Cancel pending op / clear selection" },
  { keys: ["⌘", "Z"], description: "Undo last graph patch (visual only)" },
  { keys: ["P"], description: "Toggle presenter mode (larger UI)" },
];

const TIPS: string[] = [
  "Hover an insight to highlight the affected nodes on the graph.",
  "Click a node to see its source code in the inspector panel.",
  "Plans run step-by-step — every step is gated by the test suite.",
  "Free-form steps emit full file contents; the executor parses them through TypeScript before writing.",
];

export function CheatSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (inInput) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto absolute bottom-4 right-16 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-canvas-border bg-canvas-panel/90 text-canvas-subtle shadow-panel backdrop-blur transition-colors hover:text-canvas-ink"
        aria-label="keyboard shortcuts"
      >
        <Keyboard className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-canvas-bg/70 p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-xl border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
        <div className="flex items-center justify-between border-b border-canvas-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-canvas-ink">
            <Keyboard className="h-3.5 w-3.5 text-canvas-muted" />
            <span>Keyboard shortcuts</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="flex flex-col gap-2">
            {SHORTCUTS.map((s) => (
              <div
                key={s.description}
                className="flex items-center justify-between gap-3 text-xs text-canvas-muted"
              >
                <span>{s.description}</span>
                <span className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <kbd
                      key={i}
                      className="rounded border border-canvas-border bg-canvas-bg/70 px-1.5 py-0.5 font-mono text-2xs text-canvas-ink"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-canvas-border px-4 py-3">
          <div className="text-2xs uppercase tracking-wider text-canvas-subtle">
            tips
          </div>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs text-canvas-muted">
            {TIPS.map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
