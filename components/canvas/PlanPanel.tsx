"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  MinusCircle,
  Sparkles,
  X,
  CheckSquare,
} from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { DiffView } from "./DiffView";
import type { Step } from "@/lib/planSchema";

export function PlanPanel() {
  const planState = useStore((s) => s.planState);
  const approve = useStore((s) => s.approvePlan);
  const cancel = useStore((s) => s.cancelPlan);
  const graph = useStore((s) => s.graph);

  if (planState.phase === "idle") return null;

  if (planState.phase === "thinking") {
    const partial = planState.partial ?? {};
    const intent = (partial as { intent?: string }).intent;
    const partialSteps = ((partial as { steps?: unknown[] }).steps ?? []).filter(
      (s): s is Partial<Step> => Boolean(s),
    );
    return (
      <div className="absolute bottom-20 left-1/2 z-20 w-[640px] max-w-[calc(100%-32px)] -translate-x-1/2 animate-fade-in">
        <div className="flex max-h-[calc(100vh-180px)] flex-col rounded-xl border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-canvas-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-canvas-subtle">
                <Sparkles className="h-3 w-3 animate-pulse text-accent" />
                <span>thinking</span>
              </div>
              <div className="mt-1 truncate text-sm text-canvas-ink">
                {intent ?? planState.prompt}
              </div>
            </div>
            <button
              onClick={cancel}
              className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {partialSteps.length === 0 ? (
              <div className="px-4 py-3 text-2xs text-canvas-muted">
                streaming plan from Sonnet…
              </div>
            ) : (
              partialSteps.map((s, i) => (
                <div key={i} className="border-b border-canvas-border last:border-b-0 px-4 py-2">
                  <div className="flex items-center gap-3 text-xs text-canvas-ink">
                    <div className="flex h-4 w-4 items-center justify-center rounded-full border border-canvas-border bg-canvas-bg text-2xs text-canvas-subtle">
                      {i + 1}
                    </div>
                    <span className="truncate">
                      {s.description ?? "…"}
                    </span>
                  </div>
                  <div className="mt-1 ml-7 flex items-center gap-2 text-2xs text-canvas-subtle">
                    {s.kind === "op" && s.opName ? (
                      <span className="font-mono">{s.opName}</span>
                    ) : s.kind === "freeform" ? (
                      <span className="font-mono text-violet-300">freeform</span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const plan = planState.plan;
  const isPreview = planState.phase === "preview";
  const isRunning = planState.phase === "running";
  const isDone = planState.phase === "done";
  const results = isPreview
    ? plan.steps.map((s) => ({ status: "pending" as const, description: s.description }))
    : planState.results;
  const ok = isDone ? planState.ok : null;

  return (
    <div className="absolute bottom-20 left-1/2 z-20 w-[640px] max-w-[calc(100%-32px)] -translate-x-1/2 animate-fade-in">
      <div className="flex max-h-[calc(100vh-180px)] flex-col rounded-xl border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
        <div className="flex items-start justify-between gap-3 border-b border-canvas-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-canvas-subtle">
              <Sparkles className="h-3 w-3" />
              <span>
                {isPreview ? "proposed plan" : isRunning ? "running" : ok ? "applied" : "rolled back"}
              </span>
            </div>
            <div className="mt-1 truncate text-sm text-canvas-ink">{plan.intent}</div>
            {plan.notes ? (
              <div className="mt-1 truncate text-2xs text-canvas-subtle">{plan.notes}</div>
            ) : null}
          </div>
          <button
            onClick={cancel}
            className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {plan.steps.map((step, i) => (
            <StepRow
              key={i}
              index={i}
              step={step}
              graph={graph}
              status={results[i]?.status ?? "pending"}
              result={results[i]}
            />
          ))}
        </div>

        {isPreview ? (
          <div className="flex items-center justify-between gap-3 border-t border-canvas-border px-4 py-3">
            <div className="text-2xs text-canvas-subtle">
              tests gate every step · failures roll back
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cancel}
                className="rounded px-3 py-1.5 text-xs text-canvas-muted hover:text-canvas-ink"
              >
                Discard
              </button>
              <button
                onClick={() => void approve()}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas-bg hover:brightness-110"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Apply plan
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepRow({
  index,
  step,
  graph,
  status,
  result,
}: {
  index: number;
  step: Step;
  graph: ReturnType<typeof useStore.getState>["graph"];
  status: "pending" | "running" | "success" | "failure" | "skipped";
  result?: ReturnType<typeof useStore.getState>["planState"] extends infer P
    ? P extends { results: infer R }
      ? R extends Array<infer S>
        ? S
        : never
      : never
    : never;
}) {
  const target =
    step.kind === "op"
      ? graph?.nodes.find((n) => n.id === step.targetId)
      : null;
  const targetLabel = target
    ? target.meta?.httpMethod
      ? `${target.meta.httpMethod} ${target.meta.httpPath}`
      : target.name
    : step.kind === "op"
      ? step.targetId
      : "";

  const riskTone =
    step.risk === "high"
      ? "text-rose-300"
      : step.risk === "medium"
        ? "text-amber-300"
        : "text-emerald-300";

  return (
    <div className="border-b border-canvas-border last:border-b-0">
      <div className="flex gap-3 px-4 py-3">
        <StepStatusIcon status={status} index={index} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm text-canvas-ink">{step.description}</div>
            <span
              className={cn(
                "shrink-0 rounded bg-canvas-bg/60 px-1.5 py-0.5 text-2xs uppercase tracking-wider",
                riskTone,
              )}
            >
              {step.risk}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-canvas-subtle">
            {step.kind === "op" ? (
              <>
                <span className="font-mono">{step.opName}</span>
                <span>·</span>
                <span className="truncate font-mono text-canvas-muted">
                  {targetLabel}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-violet-300">freeform</span>
                <span>·</span>
                <span className="truncate font-mono text-canvas-muted">
                  {step.files.length} file(s)
                </span>
              </>
            )}
          </div>
          <div className="mt-1 text-2xs text-canvas-muted">{step.rationale}</div>

          {result?.intentCheck ? (
            <div
              className={cn(
                "mt-1 flex items-center gap-1.5 text-2xs",
                result.intentCheck.matches ? "text-emerald-300" : "text-amber-300",
              )}
            >
              {result.intentCheck.matches ? "✓ intent verified" : "⚠ intent mismatch"}
              <span className="text-canvas-subtle">— {result.intentCheck.reason}</span>
            </div>
          ) : null}

          {result?.error ? (
            <div className="mt-1 flex items-start gap-1.5 text-2xs text-rose-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{result.explanation ?? result.error}</span>
            </div>
          ) : null}

          {status === "running" && result?.phase ? (
            <div className="mt-1 text-2xs text-canvas-muted">
              {result.phase === "applying"
                ? "applying AST transform…"
                : result.phase === "testing"
                  ? "running fixture tests…"
                  : result.phase === "verifying_intent"
                    ? "Haiku verifying intent…"
                    : ""}
            </div>
          ) : null}

          {status === "running" && result?.testOutputLive ? (
            <pre className="mt-2 max-h-[120px] overflow-auto rounded border border-canvas-border bg-canvas-bg/60 px-3 py-2 font-mono text-2xs text-canvas-muted">
              {tail(result.testOutputLive, 30)}
            </pre>
          ) : null}

          {result?.diff && (status === "success" || status === "failure") ? (
            <div className="mt-2 overflow-hidden rounded border border-canvas-border bg-canvas-bg/40">
              <DiffView diff={result.diff} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function tail(s: string, n: number): string {
  const lines = s.split("\n");
  return lines.slice(-n).join("\n");
}

function StepStatusIcon({
  status,
  index,
}: {
  status: "pending" | "running" | "success" | "failure" | "skipped";
  index: number;
}) {
  if (status === "running") {
    return <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-accent" />;
  }
  if (status === "success") {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />;
  }
  if (status === "failure") {
    return <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-400" />;
  }
  if (status === "skipped") {
    return <MinusCircle className="mt-0.5 h-4 w-4 text-canvas-subtle" />;
  }
  return (
    <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-canvas-border bg-canvas-bg text-2xs text-canvas-subtle">
      {index + 1}
    </div>
  );
}

void Circle;
