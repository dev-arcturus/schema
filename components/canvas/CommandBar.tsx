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
  const inputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

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
    planState.phase === "idle" && draft.trim().length === 0;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex w-[640px] max-w-[calc(100%-32px)] -translate-x-1/2 flex-col gap-2">
      {showQuickPrompts ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => void submit(p)}
              className="rounded-full border border-canvas-border bg-canvas-panel/70 px-3 py-1 text-2xs text-canvas-muted transition-colors hover:border-accent/40 hover:bg-canvas-panel hover:text-canvas-ink"
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
            "group flex items-center gap-2 rounded-xl border bg-canvas-panel/95 px-3 py-2 shadow-panel backdrop-blur transition-all",
            focused
              ? "border-accent/60 ring-2 ring-accent/20"
              : "border-canvas-border",
          )}
        >
          <Sparkles
            className={cn(
              "h-4 w-4",
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
                ? "Schema is planning…"
                : "Describe an architectural change… (⌘I)"
            }
            disabled={thinking}
            className="flex-1 bg-transparent py-1 text-sm text-canvas-ink placeholder:text-canvas-subtle outline-none disabled:opacity-60"
          />
          {thinking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md text-canvas-bg transition",
                draft.trim()
                  ? "bg-accent hover:brightness-110"
                  : "bg-canvas-bg/60 text-canvas-subtle",
              )}
              aria-label="Submit"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-canvas-border bg-canvas-panel/95 px-3 py-2 shadow-panel backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate text-sm text-canvas-ink">
              {planState.phase === "preview"
                ? planState.plan.intent
                : planState.phase === "running"
                  ? `applying ${planState.plan.steps.length} step(s)…`
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
