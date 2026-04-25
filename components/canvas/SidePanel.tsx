"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  X,
  AlertTriangle,
  Cable,
  Clock4,
  Shield,
  Scissors,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  History,
  Eye,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { ParamsForm } from "./ParamsForm";
import { DiffView } from "./DiffView";
import { CodePreview } from "./CodePreview";
import type { OpDescriptor } from "@/ops/types";

const CATEGORY_ICONS: Record<
  OpDescriptor["category"],
  React.ComponentType<{ className?: string }>
> = {
  middleware: Shield,
  caching: Clock4,
  transform: Cable,
  extract: Scissors,
};

type RightTab = "inspector" | "insights" | "rules" | "history";

export function SidePanel() {
  const applyState = useStore((s) => s.applyState);
  const pendingOp = useStore((s) => s.pendingOp);
  const dismissApplyState = useStore((s) => s.dismissApplyState);
  const cancelOp = useStore((s) => s.cancelOp);
  const applyOp = useStore((s) => s.applyOp);
  const applicableOps = useStore((s) => s.applicableOps);
  const rightTab = useStore((s) => s.rightTab);
  const setRightTab = useStore((s) => s.setRightTab);

  // applyState overrides the tab content (so users see the result they triggered)
  if (applyState.phase === "running") {
    return (
      <PanelShell
        header={<TabBar active={rightTab} setActive={setRightTab} />}
        title="Applying"
        subtitle={applyState.opName}
      >
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-canvas-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Running fixture tests…
        </div>
      </PanelShell>
    );
  }

  if (applyState.phase === "success") {
    return (
      <PanelShell
        header={<TabBar active={rightTab} setActive={setRightTab} />}
        title="Applied"
        subtitle={applyState.description}
        onClose={dismissApplyState}
        accent="success"
      >
        <div className="flex items-center gap-2 border-b border-canvas-border px-4 py-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          tests passed in {applyState.durationMs}ms
        </div>
        <Section title="Diff" mono>
          <DiffView diff={applyState.diff} />
        </Section>
        <Section title="Files">
          <ul className="px-4 py-1 text-xs text-canvas-muted">
            {applyState.filesChanged.map((f) => (
              <li key={f} className="font-mono">
                {f}
              </li>
            ))}
          </ul>
        </Section>
      </PanelShell>
    );
  }

  if (applyState.phase === "error") {
    const isPlan = applyState.opName === "plan";
    return (
      <PanelShell
        header={<TabBar active={rightTab} setActive={setRightTab} />}
        title={isPlan ? "Plan failed" : "Tests failed — rolled back"}
        subtitle={applyState.opName}
        onClose={dismissApplyState}
        accent="danger"
      >
        <div className="flex items-start gap-2 border-b border-canvas-border px-4 py-3 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div>{applyState.explanation ?? applyState.error}</div>
            {applyState.explanation && applyState.error && (
              <div className="mt-1 font-mono text-2xs text-rose-300/70">
                {applyState.error}
              </div>
            )}
            {isPlan ? <RetryPromptButton /> : null}
          </div>
        </div>
        <Section title="Attempted diff" mono>
          <DiffView diff={applyState.diff} />
        </Section>
        {applyState.testOutput ? (
          <Section title="Test output" mono>
            <pre className="max-h-[200px] overflow-auto bg-canvas-bg/60 px-3 py-2 font-mono text-2xs text-canvas-muted">
              {applyState.testOutput.split("\n").slice(-30).join("\n")}
            </pre>
          </Section>
        ) : null}
      </PanelShell>
    );
  }

  if (pendingOp) {
    const op = applicableOps.find((o) => o.name === pendingOp.name);
    if (op) {
      return (
        <PanelShell
          header={<TabBar active={rightTab} setActive={setRightTab} />}
          title={op.description}
          subtitle={op.name}
          onClose={cancelOp}
        >
          <div className="flex flex-col gap-4 px-4 py-3">
            <ParamsForm op={op} />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={cancelOp}
                className="rounded px-2.5 py-1.5 text-xs text-canvas-muted hover:text-canvas-ink"
              >
                cancel
              </button>
              <button
                onClick={applyOp}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-canvas-bg hover:brightness-110"
              >
                Apply
              </button>
            </div>
          </div>
        </PanelShell>
      );
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TabBar active={rightTab} setActive={setRightTab} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rightTab === "inspector" ? <InspectorTab /> : null}
        {rightTab === "insights" ? <InsightsTab /> : null}
        {rightTab === "rules" ? <RulesTab /> : null}
        {rightTab === "history" ? <HistoryTab /> : null}
      </div>
    </div>
  );
}

function TabBar({
  active,
  setActive,
}: {
  active: RightTab;
  setActive: (t: RightTab) => void;
}) {
  const insights = useStore((s) => s.insights);
  const violations = useStore((s) => s.violations);
  const chatHistory = useStore((s) => s.chatHistory);

  return (
    <div className="flex items-center gap-0.5 border-b border-canvas-border bg-canvas-panel/40 px-2 py-1.5">
      <Tab
        active={active === "inspector"}
        onClick={() => setActive("inspector")}
        icon={<Eye className="h-3 w-3" />}
        label="Inspector"
      />
      <Tab
        active={active === "insights"}
        onClick={() => setActive("insights")}
        icon={<Lightbulb className="h-3 w-3 text-amber-300" />}
        label="Insights"
        count={insights.length || undefined}
      />
      <Tab
        active={active === "rules"}
        onClick={() => setActive("rules")}
        icon={
          violations.length > 0 ? (
            <ShieldAlert className="h-3 w-3 text-rose-300" />
          ) : (
            <ShieldCheck className="h-3 w-3 text-emerald-300" />
          )
        }
        label="Rules"
        count={violations.length || undefined}
        countTone={violations.length > 0 ? "danger" : "neutral"}
      />
      <Tab
        active={active === "history"}
        onClick={() => setActive("history")}
        icon={<History className="h-3 w-3 text-canvas-muted" />}
        label="History"
        count={chatHistory.length || undefined}
      />
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  label,
  count,
  countTone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  countTone?: "danger" | "neutral";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-2xs uppercase tracking-wider transition-colors",
        active
          ? "bg-canvas-bg/60 text-canvas-ink"
          : "text-canvas-muted hover:text-canvas-ink",
      )}
    >
      {icon}
      {active ? <span>{label}</span> : null}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1 text-2xs",
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

function InspectorTab() {
  const selection = useStore((s) => s.selection);
  const graph = useStore((s) => s.graph);
  const applicableOps = useStore((s) => s.applicableOps);
  const applicableLoading = useStore((s) => s.applicableLoading);
  const startOp = useStore((s) => s.startOp);

  if (!graph) return null;

  if (!selection) {
    return (
      <div className="flex flex-col items-start gap-3 px-5 py-6 text-xs text-canvas-muted">
        <p>Click any node or edge to inspect it. Type an architectural change in the command bar at the bottom to evolve the graph.</p>
        <div className="mt-1 rounded border border-canvas-border bg-canvas-bg/60 px-3 py-2 text-2xs leading-relaxed">
          Try:{" "}
          <span className="font-mono text-canvas-ink">
            &quot;protect every unauthed resource route&quot;
          </span>
        </div>
      </div>
    );
  }

  const node =
    selection.kind === "node"
      ? graph.nodes.find((n) => n.id === selection.id)
      : null;
  const edge =
    selection.kind === "edge"
      ? graph.edges.find((e) => e.id === selection.id)
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-canvas-border px-4 py-3">
        <div className="text-2xs uppercase tracking-wider text-canvas-subtle">
          {selection.kind}
        </div>
        {node ? (
          <>
            <div className="mt-1 truncate text-sm text-canvas-ink">
              {node.meta?.httpMethod
                ? `${node.meta.httpMethod} ${node.meta.httpPath}`
                : node.name}
            </div>
            <div className="mt-0.5 truncate font-mono text-2xs text-canvas-subtle">
              {node.file}
            </div>
          </>
        ) : edge ? (
          <div className="mt-1 truncate text-sm text-canvas-ink">{edge.relation}</div>
        ) : null}
      </div>

      <div className="px-4 py-3">
        <div className="text-2xs uppercase tracking-wider text-canvas-subtle">
          Available ops
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {applicableLoading ? (
            <div className="text-xs text-canvas-muted">resolving…</div>
          ) : applicableOps.length === 0 ? (
            <div className="text-xs text-canvas-muted">
              No ops apply here. Try a freeform prompt instead.
            </div>
          ) : (
            applicableOps.map((op) => {
              const Icon = CATEGORY_ICONS[op.category];
              return (
                <button
                  key={op.name}
                  onClick={() => startOp(op.name)}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-canvas-bg/40"
                >
                  <Icon className="h-3.5 w-3.5 text-canvas-muted group-hover:text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-canvas-ink">
                      {op.description}
                    </div>
                    <div className="truncate font-mono text-2xs text-canvas-subtle">
                      {op.name}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
      <CodePreview />
    </div>
  );
}

function InsightsTab() {
  const insights = useStore((s) => s.insights);
  const submit = useStore((s) => s.submitPrompt);
  const setHoverHighlight = useStore((s) => s.setHoverHighlight);
  if (insights.length === 0) {
    return (
      <div className="px-4 py-4 text-xs text-canvas-muted">
        No architectural smells detected.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
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
    <div className="flex flex-col gap-1.5 px-4 py-3">
      {rules.length === 0 ? (
        <div className="text-2xs text-canvas-muted">No rules yet.</div>
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
      <div className="px-4 py-4 text-2xs text-canvas-muted">
        Past prompts will appear here.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
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

function RetryPromptButton() {
  const lastPrompt = useStore((s) => s.lastPrompt);
  const retry = useStore((s) => s.retryLastPrompt);
  if (!lastPrompt) return null;
  return (
    <button
      onClick={() => void retry()}
      className="mt-2 inline-flex items-center gap-1 rounded bg-canvas-bg/70 px-2 py-1 text-2xs text-canvas-ink transition-colors hover:bg-accent hover:text-canvas-bg"
    >
      Retry: <span className="truncate font-mono">{lastPrompt.slice(0, 64)}</span>
    </button>
  );
}

function PanelShell({
  header,
  title,
  subtitle,
  onClose,
  accent,
  children,
}: {
  header?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  accent?: "success" | "danger";
  children: React.ReactNode;
}) {
  const accentRing =
    accent === "success"
      ? "border-l-emerald-400/60"
      : accent === "danger"
        ? "border-l-rose-400/60"
        : "border-l-accent/60";
  return (
    <div className={cn("flex h-full flex-col border-l-2", accentRing)}>
      {header}
      <div className="flex items-start justify-between gap-2 border-b border-canvas-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-canvas-ink">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 truncate font-mono text-2xs text-canvas-subtle">
              {subtitle}
            </div>
          ) : null}
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function Section({
  title,
  mono,
  children,
}: {
  title: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-canvas-border last:border-b-0">
      <div className="px-4 py-2 text-2xs uppercase tracking-wider text-canvas-subtle">
        {title}
      </div>
      <div className={mono ? "font-mono" : ""}>{children}</div>
    </div>
  );
}
