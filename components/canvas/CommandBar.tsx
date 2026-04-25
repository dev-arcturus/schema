"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowUp, Loader2, X } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS: string[] = [
  "Protect every unauthed resource route",
  "Memoize verifyToken so middleware doesn't re-verify",
  "Extract auth into its own module",
  "Wrap every service with logging",
];

export function CommandBar() {
  const graph = useStore((s) => s.graph);
  const planState = useStore((s) => s.planState);
  const submit = useStore((s) => s.submitPrompt);
  const cancel = useStore((s) => s.cancelPlan);
  const presenterMode = useStore((s) => s.presenterMode);
  const inputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState("");
  const focused = useStore((s) => s.commandBarFocused);
  const setFocused = useStore((s) => s.setCommandBarFocused);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        return; // search bar handles
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "i" || e.key === "I") &&
        graph
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [graph]);

  if (!graph) return null;

  const thinking = planState.phase === "thinking";
  const showInput =
    planState.phase === "idle" ||
    planState.phase === "thinking" ||
    planState.phase === "done";

  const showQuickPrompts =
    focused && planState.phase === "idle" && draft.trim().length === 0;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex w-[600px] max-w-[calc(100%-340px)] -translate-x-1/2 flex-col gap-2">
      {showQuickPrompts ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void submit(p)}
              className={cn(
                "rounded-full border border-canvas-border bg-canvas-panel/70 px-3 py-1 text-canvas-muted transition-colors hover:border-accent/40 hover:bg-canvas-panel hover:text-canvas-ink",
                presenterMode ? "text-xs" : "text-2xs",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}
      {showInput ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            if (!trimmed || thinking) return;
            void submit(trimmed);
            setDraft("");
          }}
          className={cn(
            "group flex items-center gap-2 rounded-xl border bg-canvas-panel/95 shadow-panel backdrop-blur transition-all",
            focused
              ? "border-accent/60 ring-2 ring-accent/20"
              : "border-canvas-border",
            presenterMode ? "px-4 py-3" : "px-3 py-2",
          )}
        >
          <Sparkles
            className={cn(
              presenterMode ? "h-5 w-5" : "h-4 w-4",
              thinking
                ? "animate-pulse text-accent"
                : "text-canvas-subtle group-focus-within:text-accent",
            )}
          />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={
              thinking
                ? "Schema is planning..."
                : "Describe an architectural change... (Cmd+I)"
            }
            disabled={thinking}
            className={cn(
              "flex-1 bg-transparent text-canvas-ink placeholder:text-canvas-subtle outline-none disabled:opacity-60",
              presenterMode ? "py-1.5 text-base" : "py-1 text-sm",
            )}
          />
          {thinking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className={cn(
                "flex items-center justify-center rounded-md text-canvas-bg transition",
                draft.trim()
                  ? "bg-accent hover:brightness-110"
                  : "bg-canvas-bg/60 text-canvas-subtle",
                presenterMode ? "h-8 w-8" : "h-6 w-6",
              )}
              aria-label="Submit"
            >
              <ArrowUp className={presenterMode ? "h-4 w-4" : "h-3.5 w-3.5"} />
            </button>
          )}
        </form>
      ) : (
        <div className={cn(
          "flex items-center justify-between gap-2 rounded-xl border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur",
          presenterMode ? "px-4 py-3" : "px-3 py-2",
        )}>
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className={cn("shrink-0 text-accent", presenterMode ? "h-5 w-5" : "h-4 w-4")} />
            <span className={cn("truncate text-canvas-ink", presenterMode ? "text-base" : "text-sm")}>
              {planState.phase === "preview"
                ? planState.plan.intent
                : planState.phase === "running"
                  ? `applying ${planState.plan.steps.length} step(s)...`
                  : ""}
            </span>
          </div>
          <button
            onClick={cancel}
            className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
            aria-label="cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
