"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function RulesRail() {
  const rules = useStore((s) => s.rules);
  const violations = useStore((s) => s.violations);
  const loading = useStore((s) => s.rulesLoading);
  const compileError = useStore((s) => s.ruleCompileError);
  const addRule = useStore((s) => s.addRuleFromPrompt);
  const removeRule = useStore((s) => s.removeRule);
  const toggleRule = useStore((s) => s.toggleRuleEnabled);
  const applyFix = useStore((s) => s.applyRuleFix);
  const setHoverHighlight = useStore((s) => s.setHoverHighlight);
  const planState = useStore((s) => s.planState);
  const hasGraph = useStore((s) => !!s.graph);

  const [open, setOpen] = useState(true);
  const [addingPrompt, setAddingPrompt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (!hasGraph) return null;
  if (planState.phase !== "idle" && planState.phase !== "done") return null;

  const violatingRuleIds = new Set(violations.map((v) => v.ruleId));
  const violatingCount = violations.length;

  const submit = async () => {
    if (!draft.trim()) return;
    await addRule(draft.trim());
    setDraft("");
    setAddingPrompt(null);
  };

  return (
    <div className="pointer-events-auto absolute bottom-28 left-4 z-10 w-[300px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas-panel/90 px-3 py-1.5 text-2xs uppercase tracking-wider text-canvas-muted shadow-panel backdrop-blur transition-colors hover:text-canvas-ink"
      >
        <span className="flex items-center gap-1.5">
          {violatingCount > 0 ? (
            <ShieldAlert className="h-3 w-3 text-rose-300" />
          ) : (
            <ShieldCheck className="h-3 w-3 text-emerald-300" />
          )}
          rules
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          <span
            className={cn(
              "rounded-full px-1.5 text-2xs",
              violatingCount > 0
                ? "bg-rose-500/20 text-rose-200"
                : "bg-emerald-500/20 text-emerald-200",
            )}
          >
            {rules.length} · {violatingCount} viol.
          </span>
        </span>
        <span className="font-mono text-2xs">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="mt-2 flex max-h-[300px] flex-col gap-1.5 overflow-y-auto rounded-md border border-canvas-border bg-canvas-panel/90 p-2 shadow-panel backdrop-blur">
          {rules.length === 0 ? (
            <div className="px-2 py-1 text-2xs text-canvas-muted">
              No rules. Add one below.
            </div>
          ) : (
            rules.map((rule) => {
              const violation = violations.find((v) => v.ruleId === rule.id);
              const isViolating = violatingRuleIds.has(rule.id);
              return (
                <div
                  key={rule.id}
                  onMouseEnter={() =>
                    violation && setHoverHighlight(violation.nodeIds)
                  }
                  onMouseLeave={() => setHoverHighlight([])}
                  className={cn(
                    "group rounded border bg-canvas-bg/40 px-2 py-1.5 text-2xs transition-colors",
                    isViolating
                      ? "border-rose-500/30 hover:border-rose-300/60"
                      : "border-canvas-border hover:border-emerald-300/40",
                    !rule.enabled && "opacity-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isViolating ? (
                      <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-rose-300" />
                    ) : (
                      <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-canvas-ink">
                        {rule.title}
                      </div>
                      {violation ? (
                        <div className="mt-0.5 truncate text-2xs text-rose-200">
                          {violation.message}
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => void removeRule(rule.id)}
                      className="rounded p-0.5 text-canvas-subtle opacity-0 transition-opacity hover:text-canvas-ink group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {violation ? (
                    <button
                      onClick={() => void applyFix(violation)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded bg-canvas-bg/70 px-2 py-0.5 text-2xs text-canvas-ink transition-colors hover:bg-accent hover:text-canvas-bg"
                    >
                      Generate repair plan
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : null}
                  <div className="mt-1 flex items-center gap-2 text-2xs text-canvas-subtle">
                    <button
                      onClick={() => void toggleRule(rule.id, !rule.enabled)}
                      className="hover:text-canvas-ink"
                    >
                      {rule.enabled ? "disable" : "enable"}
                    </button>
                    <span>·</span>
                    <span>{rule.severity}</span>
                  </div>
                </div>
              );
            })
          )}

          {addingPrompt !== null ? (
            <div className="mt-1 rounded border border-accent/30 bg-canvas-bg/60 p-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Services don't call data layer directly"
                rows={2}
                className="w-full resize-none rounded bg-transparent text-2xs text-canvas-ink placeholder:text-canvas-subtle outline-none"
              />
              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setAddingPrompt(null);
                    setDraft("");
                  }}
                  className="text-2xs text-canvas-muted hover:text-canvas-ink"
                >
                  cancel
                </button>
                <button
                  onClick={() => void submit()}
                  disabled={!draft.trim() || loading}
                  className="rounded bg-accent px-2 py-0.5 text-2xs text-canvas-bg disabled:opacity-50 hover:brightness-110"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "compile + add"
                  )}
                </button>
              </div>
              {compileError ? (
                <div className="mt-1 text-2xs text-rose-200">{compileError}</div>
              ) : null}
            </div>
          ) : (
            <button
              onClick={() => setAddingPrompt("")}
              className="mt-1 inline-flex items-center justify-center gap-1 rounded border border-dashed border-canvas-border px-2 py-1 text-2xs text-canvas-muted transition-colors hover:border-accent/50 hover:text-canvas-ink"
            >
              <Plus className="h-3 w-3" />
              add rule
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
