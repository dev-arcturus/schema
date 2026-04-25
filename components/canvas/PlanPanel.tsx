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
  SkipForward,
  Footprints,
  Play,
  RotateCcw,
  Pencil,
  FastForward,
  Square,
} from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { DiffView } from "./DiffView";
import type { Step, StepResult } from "@/lib/planSchema";

export function PlanPanel() {
  const planState = useStore((s) => s.planState);
  const approve = useStore((s) => s.approvePlan);
  const cancel = useStore((s) => s.cancelPlan);
  const graph = useStore((s) => s.graph);
  const presenterMode = useStore((s) => s.presenterMode);
  const stepByStep = useStore((s) => s.stepByStepMode);
  const toggleStepByStep = useStore((s) => s.toggleStepByStep);
  const pendingContinue = useStore((s) => s.pendingContinue);
  const continueNext = useStore((s) => s.continueNextStep);
  const failureDecision = useStore((s) => s.failureDecision);
  const resolveFailure = useStore((s) => s.resolveFailure);

  if (planState.phase === "idle") return null;

  if (planState.phase === "thinking") {
    const partial = planState.partial ?? {};
    const intent = (partial as { intent?: string }).intent;
    const partialSteps = ((partial as { steps?: unknown[] }).steps ?? []).filter(
      (s): s is Partial<Step> => Boolean(s),
    );
    return (
      <div className={cn(
        "absolute bottom-20 left-1/2 z-20 -translate-x-1/2 animate-fade-in",
        presenterMode ? "w-[800px] max-w-[calc(100%-32px)]" : "w-[640px] max-w-[calc(100%-32px)]",
      )}>
        <div className="flex max-h-[calc(100vh-180px)] flex-col rounded-xl border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
          <div className="flex items-start justify-between gap-3 border-b border-canvas-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className={cn(
                "flex items-center gap-2 uppercase tracking-wider text-canvas-subtle",
                presenterMode ? "text-xs" : "text-2xs",
              )}>
                <Sparkles className="h-3 w-3 animate-pulse text-accent" />
                <span>thinking</span>
              </div>
              <div className={cn("mt-1 truncate text-canvas-ink", presenterMode ? "text-base" : "text-sm")}>
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
              <div className={cn("px-4 py-3 text-canvas-muted", presenterMode ? "text-xs" : "text-2xs")}>
                streaming plan from Sonnet...
              </div>
            ) : (
              partialSteps.map((s, i) => (
                <div key={i} className="border-b border-canvas-border last:border-b-0 px-4 py-2">
                  <div className={cn("flex items-center gap-3 text-canvas-ink", presenterMode ? "text-sm" : "text-xs")}>
                    <div className={cn(
                      "flex items-center justify-center rounded-full border border-canvas-border bg-canvas-bg text-canvas-subtle",
                      presenterMode ? "h-5 w-5 text-xs" : "h-4 w-4 text-2xs",
                    )}>
                      {i + 1}
                    </div>
                    <span className="truncate">
                      {s.description ?? "..."}
                    </span>
                  </div>
                  <div className={cn("mt-1 ml-7 flex items-center gap-2 text-canvas-subtle", presenterMode ? "text-xs" : "text-2xs")}>
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
  const currentIndex = isRunning ? planState.currentIndex : -1;

  return (
    <div className={cn(
      "absolute bottom-20 left-1/2 z-20 -translate-x-1/2 animate-fade-in",
      presenterMode ? "w-[800px] max-w-[calc(100%-32px)]" : "w-[640px] max-w-[calc(100%-32px)]",
    )}>
      <div className="flex max-h-[calc(100vh-180px)] flex-col rounded-xl border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-canvas-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className={cn(
              "flex items-center gap-2 uppercase tracking-wider text-canvas-subtle",
              presenterMode ? "text-xs" : "text-2xs",
            )}>
              <Sparkles className="h-3 w-3" />
              <span>
                {isPreview ? "proposed plan" : isRunning ? "running" : ok ? "applied" : "rolled back"}
              </span>
            </div>
            <div className={cn("mt-1 truncate text-canvas-ink", presenterMode ? "text-base" : "text-sm")}>
              {plan.intent}
            </div>
            {plan.notes ? (
              <div className={cn("mt-1 truncate text-canvas-subtle", presenterMode ? "text-xs" : "text-2xs")}>
                {plan.notes}
              </div>
            ) : null}
          </div>
          <button
            onClick={cancel}
            className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Phase indicator bar */}
        {isRunning && (results[currentIndex] as StepResult | undefined)?.phase && (
          <PhaseBar
            phase={(results[currentIndex] as StepResult).phase!}
            stepIndex={currentIndex}
            totalSteps={plan.steps.length}
            presenterMode={presenterMode}
          />
        )}

        {/* Step-by-step pause banner */}
        {pendingContinue && isRunning && (
          <div className="flex items-center justify-between gap-3 border-b border-accent/30 bg-accent/5 px-4 py-2">
            <div className={cn("flex items-center gap-2 text-accent", presenterMode ? "text-sm" : "text-xs")}>
              <Footprints className="h-3.5 w-3.5" />
              Step {currentIndex + 1} complete — paused
            </div>
            <button
              onClick={continueNext}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-canvas-bg hover:brightness-110"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Next step
            </button>
          </div>
        )}

        {/* F: Failure decision bar */}
        {failureDecision && isRunning && (
          <div className="border-b border-rose-500/30 bg-rose-500/5 px-4 py-3">
            <div className={cn("flex items-center gap-2 text-rose-300", presenterMode ? "text-sm" : "text-xs")}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Step {failureDecision.stepIndex + 1} failed — what would you like to do?
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => resolveFailure("retry")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-bg/60 font-medium text-canvas-ink transition-colors hover:border-accent/40 hover:bg-canvas-bg",
                  presenterMode ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
                )}
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
              <button
                onClick={() => resolveFailure("skip")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-bg/60 font-medium text-canvas-muted transition-colors hover:text-canvas-ink",
                  presenterMode ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
                )}
              >
                <FastForward className="h-3 w-3" />
                Skip step
              </button>
              <button
                onClick={() => resolveFailure("stop")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 font-medium text-rose-300 transition-colors hover:bg-rose-500/20",
                  presenterMode ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
                )}
              >
                <Square className="h-3 w-3" />
                Stop plan
              </button>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="flex-1 overflow-y-auto">
          {plan.steps.map((step, i) => (
            <StepRow
              key={i}
              index={i}
              step={step}
              graph={graph}
              status={results[i]?.status ?? "pending"}
              result={results[i]}
              isActive={isRunning && i === currentIndex}
              presenterMode={presenterMode}
            />
          ))}
        </div>

        {/* Footer */}
        {isPreview ? (
          <div className="flex items-center justify-between gap-3 border-t border-canvas-border px-4 py-3">
            <div className={cn("flex items-center gap-3 text-canvas-subtle", presenterMode ? "text-xs" : "text-2xs")}>
              <span>tests gate every step</span>
              <span className="text-canvas-border">|</span>
              <button
                onClick={toggleStepByStep}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5 transition-colors",
                  stepByStep
                    ? "bg-accent/15 text-accent"
                    : "text-canvas-muted hover:text-canvas-ink",
                )}
                title="Pause between steps for narration"
              >
                <Footprints className="h-3 w-3" />
                step-by-step
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cancel}
                className={cn("rounded px-3 py-1.5 text-canvas-muted hover:text-canvas-ink", presenterMode ? "text-sm" : "text-xs")}
              >
                Discard
              </button>
              <button
                onClick={() => void approve()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md bg-accent font-medium text-canvas-bg hover:brightness-110",
                  presenterMode ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs",
                )}
              >
                <Play className="h-3.5 w-3.5" />
                Apply plan
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Phase Bar (B) ── */
function PhaseBar({
  phase,
  stepIndex,
  totalSteps,
  presenterMode,
}: {
  phase: "applying" | "testing" | "verifying_intent" | "done";
  stepIndex: number;
  totalSteps: number;
  presenterMode: boolean;
}) {
  const phases = ["applying", "testing", "verifying_intent"] as const;
  const idx = phases.indexOf(phase as (typeof phases)[number]);
  const pct = idx >= 0 ? ((idx + 1) / phases.length) * 100 : 100;

  const label =
    phase === "applying"
      ? "Applying AST transform"
      : phase === "testing"
        ? "Running test suite"
        : phase === "verifying_intent"
          ? "Verifying intent match"
          : "Complete";

  return (
    <div className="border-b border-canvas-border">
      <div className="flex items-center gap-3 px-4 py-2">
        <Loader2 className={cn("h-3.5 w-3.5 animate-spin text-accent", presenterMode && "h-4 w-4")} />
        <span className={cn("font-medium text-canvas-ink", presenterMode ? "text-sm" : "text-xs")}>
          Step {stepIndex + 1}/{totalSteps}
        </span>
        <span className={cn("text-canvas-muted", presenterMode ? "text-sm" : "text-xs")}>
          {label}
        </span>
      </div>
      <div className="h-0.5 bg-canvas-bg">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Step Row ── */
function StepRow({
  index,
  step,
  graph,
  status,
  result,
  isActive,
  presenterMode,
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
  isActive: boolean;
  presenterMode: boolean;
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

  // Auto-expand diff for the active step and most recent success, collapse old ones
  const autoExpand = isActive || status === "running" || status === "success";

  return (
    <div className={cn(
      "border-b border-canvas-border last:border-b-0",
      isActive && "bg-accent/[0.03]",
    )}>
      <div className="flex gap-3 px-4 py-3">
        <StepStatusIcon status={status} index={index} presenterMode={presenterMode} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className={cn("truncate text-canvas-ink", presenterMode ? "text-base" : "text-sm")}>
              {step.description}
            </div>
            <span
              className={cn(
                "shrink-0 rounded bg-canvas-bg/60 px-1.5 py-0.5 uppercase tracking-wider",
                riskTone,
                presenterMode ? "text-xs" : "text-2xs",
              )}
            >
              {step.risk}
            </span>
          </div>
          <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-canvas-subtle", presenterMode ? "text-xs" : "text-2xs")}>
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

          {/* Narration (D) — plain-English summary visible in presenter mode */}
          {presenterMode && (
            <div className="mt-1.5 rounded bg-canvas-bg/40 px-2.5 py-1.5 text-xs leading-relaxed text-canvas-muted">
              {step.rationale}
            </div>
          )}
          {!presenterMode && (
            <div className="mt-1 text-2xs text-canvas-muted">{step.rationale}</div>
          )}

          {result?.intentCheck ? (
            <div
              className={cn(
                "mt-1 flex items-center gap-1.5",
                result.intentCheck.matches ? "text-emerald-300" : "text-amber-300",
                presenterMode ? "text-xs" : "text-2xs",
              )}
            >
              {result.intentCheck.matches ? "intent verified" : "intent mismatch"}
              <span className="text-canvas-subtle">— {result.intentCheck.reason}</span>
            </div>
          ) : null}

          {result?.error ? (
            <div className={cn("mt-1 flex items-start gap-1.5 text-rose-300", presenterMode ? "text-xs" : "text-2xs")}>
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{result.explanation ?? result.error}</span>
            </div>
          ) : null}

          {status === "running" && result?.testOutputLive ? (
            <pre className={cn(
              "mt-2 max-h-[120px] overflow-auto rounded border border-canvas-border bg-canvas-bg/60 px-3 py-2 font-mono text-canvas-muted",
              presenterMode ? "text-xs" : "text-2xs",
            )}>
              {tail(result.testOutputLive, 30)}
            </pre>
          ) : null}

          {result?.diff && (status === "success" || status === "failure") ? (
            <div className="mt-2 overflow-hidden rounded border border-canvas-border bg-canvas-bg/40">
              <DiffView diff={result.diff} defaultExpanded={autoExpand} />
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
  presenterMode,
}: {
  status: "pending" | "running" | "success" | "failure" | "skipped";
  index: number;
  presenterMode: boolean;
}) {
  const sz = presenterMode ? "h-5 w-5" : "h-4 w-4";
  if (status === "running") {
    return <Loader2 className={cn("mt-0.5 animate-spin text-accent", sz)} />;
  }
  if (status === "success") {
    return <CheckCircle2 className={cn("mt-0.5 text-emerald-400", sz)} />;
  }
  if (status === "failure") {
    return <AlertTriangle className={cn("mt-0.5 text-rose-400", sz)} />;
  }
  if (status === "skipped") {
    return <MinusCircle className={cn("mt-0.5 text-canvas-subtle", sz)} />;
  }
  return (
    <div className={cn(
      "mt-0.5 flex items-center justify-center rounded-full border border-canvas-border bg-canvas-bg text-canvas-subtle",
      presenterMode ? "h-5 w-5 text-xs" : "h-4 w-4 text-2xs",
    )}>
      {index + 1}
    </div>
  );
}

void Circle;
