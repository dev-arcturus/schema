"use client";

import { useState } from "react";
import {
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  History,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

type Tab = "insights" | "rules" | "history";

export function LeftSidebar() {
  const hasGraph = useStore((s) => !!s.graph);
  const insights = useStore((s) => s.insights);
  const insightsLoading = useStore((s) => s.insightsLoading);
  const violations = useStore((s) => s.violations);
  const chatHistory = useStore((s) => s.chatHistory);
  const planState = useStore((s) => s.planState);

  const [active, setActive] = useState<Tab>("insights");
  const [open, setOpen] = useState(true);

  if (!hasGraph) return null;
  if (planState.phase !== "idle" && planState.phase !== "done") return null;

  const insightCount = insights.length;
  const violationCount = violations.length;
  const historyCount = chatHistory.length;

  return (
    <aside
      className={cn(
        "pointer-events-auto absolute bottom-4 left-4 top-16 z-10 flex flex-col rounded-xl border border-canvas-border bg-canvas-panel/90 shadow-panel backdrop-blur transition-[width] duration-200",
        open ? "w-[300px]" : "w-12",
      )}
    >
      <div className="flex items-center justify-between border-b border-canvas-border px-2 py-1.5">
        {open ? (
          <div className="flex items-center gap-0.5">
            <TabButton
              active={active === "insights"}
              onClick={() => setActive("insights")}
              icon={<Lightbulb className="h-3 w-3 text-amber-300" />}
              label="Insights"
              count={insightCount}
              loading={insightsLoading}
            />
            <TabButton
              active={active === "rules"}
              onClick={() => setActive("rules")}
              icon={
                violationCount > 0 ? (
                  <ShieldAlert className="h-3 w-3 text-rose-300" />
                ) : (
                  <ShieldCheck className="h-3 w-3 text-emerald-300" />
                )
              }
              label="Rules"
              count={violationCount > 0 ? violationCount : undefined}
              countTone={violationCount > 0 ? "danger" : "neutral"}
            />
            <TabButton
              active={active === "history"}
              onClick={() => setActive("history")}
              icon={<History className="h-3 w-3 text-canvas-muted" />}
              label="History"
              count={historyCount > 0 ? historyCount : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <CollapsedIcon
              icon={<Lightbulb className="h-3.5 w-3.5 text-amber-300" />}
              count={insightCount}
              onClick={() => {
                setActive("insights");
                setOpen(true);
              }}
            />
            <CollapsedIcon
              icon={
                violationCount > 0 ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-300" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                )
              }
              count={violationCount}
              tone={violationCount > 0 ? "danger" : "neutral"}
              onClick={() => {
                setActive("rules");
                setOpen(true);
              }}
            />
            <CollapsedIcon
              icon={<History className="h-3.5 w-3.5 text-canvas-muted" />}
              count={historyCount}
              onClick={() => {
                setActive("history");
                setOpen(true);
              }}
            />
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
          aria-label={open ? "collapse" : "expand"}
        >
          {open ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {open ? (
        <div className="flex-1 overflow-y-auto">
          {active === "insights" ? <InsightsTab /> : null}
          {active === "rules" ? <RulesTab /> : null}
          {active === "history" ? <HistoryTab /> : null}
        </div>
      ) : null}
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  countTone,
  loading,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  countTone?: "danger" | "neutral";
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-2xs uppercase tracking-wider transition-colors",
        active
          ? "bg-canvas-bg/60 text-canvas-ink"
          : "text-canvas-muted hover:text-canvas-ink",
      )}
    >
      {icon}
      <span>{label}</span>
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-2xs",
            countTone === "danger"
              ? "bg-rose-500/20 text-rose-200"
              : "bg-canvas-bg/60 text-canvas-muted",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function CollapsedIcon({
  icon,
  count,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  count?: number;
  tone?: "danger" | "neutral";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-7 w-7 items-center justify-center rounded text-canvas-muted hover:bg-canvas-bg/40 hover:text-canvas-ink"
    >
      {icon}
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-semibold",
            tone === "danger"
              ? "bg-rose-500 text-canvas-bg"
              : "bg-amber-400/90 text-canvas-bg",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function InsightsTab() {
  const insights = useStore((s) => s.insights);
  const submit = useStore((s) => s.submitPrompt);
  const setHoverHighlight = useStore((s) => s.setHoverHighlight);
  if (insights.length === 0) {
    return (
      <div className="px-3 py-3 text-2xs text-canvas-muted">
        No architectural smells detected.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      {insights.map((insight) => (
        <div
          key={insight.id}
          onMouseEnter={() => setHoverHighlight(insight.targetIds)}
          onMouseLeave={() => setHoverHighlight([])}
          className="rounded-md border border-canvas-border bg-canvas-bg/40 p-2.5 transition-colors hover:border-amber-300/40"
        >
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                insight.severity === "high"
                  ? "bg-rose-400"
                  : insight.severity === "medium"
                    ? "bg-amber-400"
                    : "bg-canvas-muted",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs leading-tight text-canvas-ink">
                {insight.title}
              </div>
              <div className="mt-1 text-2xs leading-relaxed text-canvas-muted">
                {insight.rationale}
              </div>
            </div>
          </div>
          <button
            onClick={() => void submit(insight.suggestedPrompt)}
            className="mt-2 inline-flex items-center gap-1 rounded bg-canvas-bg/70 px-2 py-1 text-2xs text-canvas-ink transition-colors hover:bg-accent hover:text-canvas-bg"
          >
            {insight.suggestedPrompt}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function RulesTab() {
  const rules = useStore((s) => s.rules);
  const violations = useStore((s) => s.violations);
  const compileError = useStore((s) => s.ruleCompileError);
  const loading = useStore((s) => s.rulesLoading);
  const addRule = useStore((s) => s.addRuleFromPrompt);
  const removeRule = useStore((s) => s.removeRule);
  const toggleRule = useStore((s) => s.toggleRuleEnabled);
  const applyFix = useStore((s) => s.applyRuleFix);
  const setHoverHighlight = useStore((s) => s.setHoverHighlight);

  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = async () => {
    if (!draft.trim()) return;
    await addRule(draft.trim());
    setDraft("");
    setDraftOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-3">
      {rules.length === 0 ? (
        <div className="px-1 text-2xs text-canvas-muted">
          No rules yet. Add one below.
        </div>
      ) : (
        rules.map((rule) => {
          const violation = violations.find((v) => v.ruleId === rule.id);
          return (
            <div
              key={rule.id}
              onMouseEnter={() =>
                violation && setHoverHighlight(violation.nodeIds)
              }
              onMouseLeave={() => setHoverHighlight([])}
              className={cn(
                "group rounded-md border bg-canvas-bg/40 px-2.5 py-2 text-2xs transition-colors",
                violation
                  ? "border-rose-500/30 hover:border-rose-300/60"
                  : "border-canvas-border hover:border-emerald-300/40",
                !rule.enabled && "opacity-50",
              )}
            >
              <div className="flex items-start gap-2">
                {violation ? (
                  <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-rose-300" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-300" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-tight text-canvas-ink">
                    {rule.title}
                  </div>
                  {violation ? (
                    <div className="mt-0.5 text-2xs leading-relaxed text-rose-200">
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

      {draftOpen ? (
        <div className="rounded-md border border-accent/30 bg-canvas-bg/60 p-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. services don't call data layer directly"
            rows={2}
            className="w-full resize-none rounded bg-transparent text-2xs text-canvas-ink placeholder:text-canvas-subtle outline-none"
          />
          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setDraftOpen(false);
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
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "compile + add"}
            </button>
          </div>
          {compileError ? (
            <div className="mt-1 text-2xs text-rose-200">{compileError}</div>
          ) : null}
        </div>
      ) : (
        <button
          onClick={() => setDraftOpen(true)}
          className="inline-flex items-center justify-center gap-1 rounded border border-dashed border-canvas-border px-2 py-1.5 text-2xs text-canvas-muted transition-colors hover:border-accent/50 hover:text-canvas-ink"
        >
          <Plus className="h-3 w-3" />
          add rule
        </button>
      )}
    </div>
  );
}

function HistoryTab() {
  const chatHistory = useStore((s) => s.chatHistory);
  const submit = useStore((s) => s.submitPrompt);
  if (chatHistory.length === 0) {
    return (
      <div className="px-3 py-3 text-2xs text-canvas-muted">
        Past prompts will appear here. Click any to re-run.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 px-3 py-3">
      {[...chatHistory].reverse().map((turn, i) => (
        <button
          key={`${i}-${turn.prompt}`}
          onClick={() => void submit(turn.prompt)}
          className="flex flex-col gap-1 rounded-md border border-canvas-border bg-canvas-bg/40 px-2.5 py-2 text-left transition-colors hover:border-accent/40 hover:bg-canvas-bg/70"
        >
          <span className="truncate text-xs text-canvas-ink">{turn.prompt}</span>
          <span className="truncate text-2xs text-canvas-subtle">
            {(turn.appliedSteps ?? []).length > 0
              ? `${(turn.appliedSteps ?? []).length} step(s) applied`
              : "no steps applied"}
          </span>
        </button>
      ))}
    </div>
  );
}
