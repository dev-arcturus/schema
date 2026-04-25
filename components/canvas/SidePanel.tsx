"use client";

import {
  CheckCircle2,
  Loader2,
  X,
  AlertTriangle,
  Cable,
  Clock4,
  Shield,
  Scissors,
} from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { ParamsForm } from "./ParamsForm";
import { DiffView } from "./DiffView";
import { CodePreview } from "./CodePreview";
import type { OpDescriptor } from "@/ops/types";

const CATEGORY_ICONS: Record<OpDescriptor["category"], React.ComponentType<{ className?: string }>> = {
  middleware: Shield,
  caching: Clock4,
  transform: Cable,
  extract: Scissors,
};

export function SidePanel() {
  const pendingOp = useStore((s) => s.pendingOp);
  const applicableOps = useStore((s) => s.applicableOps);
  const applicableLoading = useStore((s) => s.applicableLoading);
  const applyState = useStore((s) => s.applyState);
  const selection = useStore((s) => s.selection);
  const graph = useStore((s) => s.graph);
  const startOp = useStore((s) => s.startOp);
  const cancelOp = useStore((s) => s.cancelOp);
  const applyOp = useStore((s) => s.applyOp);
  const dismissApplyState = useStore((s) => s.dismissApplyState);

  if (!pendingOp && applyState.phase === "idle") {
    if (selection && graph) {
      return (
        <SelectionInspector
          selection={selection}
          graph={graph}
          ops={applicableOps}
          loading={applicableLoading}
          startOp={startOp}
        />
      );
    }
    return <EmptyHint />;
  }

  if (applyState.phase === "running") {
    return (
      <PanelShell title="Applying" subtitle={applyState.opName}>
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

  // pending op — render form
  if (pendingOp) {
    const op = applicableOps.find((o) => o.name === pendingOp.name);
    if (!op) return null;
    return (
      <PanelShell
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

  return null;
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
  title,
  subtitle,
  onClose,
  accent,
  children,
}: {
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

function EmptyHint() {
  const history = useStore((s) => s.chatHistory);
  const submit = useStore((s) => s.submitPrompt);
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-start gap-3 border-b border-canvas-border px-5 py-6 text-xs text-canvas-muted">
        <div className="text-sm font-medium text-canvas-ink">Inspector</div>
        <p>
          Type an architectural change in the command bar, or click a node to see
          the ops available there.
        </p>
        <div className="mt-1 rounded border border-canvas-border bg-canvas-bg/60 px-3 py-2 text-2xs leading-relaxed">
          Try:{" "}
          <span className="font-mono text-canvas-ink">
            &quot;protect every unauthed resource route&quot;
          </span>
        </div>
      </div>
      {history.length > 0 ? (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-2xs uppercase tracking-wider text-canvas-subtle">
            History
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {[...history].reverse().map((turn, i) => (
              <button
                key={`${i}-${turn.prompt}`}
                onClick={() => void submit(turn.prompt)}
                className="group flex flex-col gap-1 rounded-md border border-canvas-border bg-canvas-bg/40 px-3 py-2 text-left text-2xs transition-colors hover:border-accent/40 hover:bg-canvas-bg/70"
              >
                <span className="truncate text-xs text-canvas-ink">
                  {turn.prompt}
                </span>
                <span className="truncate text-canvas-subtle">
                  {(turn.appliedSteps ?? []).length > 0
                    ? `${(turn.appliedSteps ?? []).length} step(s) applied`
                    : "no steps applied"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectionInspector({
  selection,
  graph,
  ops,
  loading,
  startOp,
}: {
  selection: { kind: "node" | "edge"; id: string };
  graph: { nodes: { id: string; name: string; kind: string; file: string; meta?: { httpMethod?: string; httpPath?: string } }[]; edges: { id: string; relation: string }[] };
  ops: OpDescriptor[];
  loading: boolean;
  startOp: (name: string) => void;
}) {
  const node = selection.kind === "node" ? graph.nodes.find((n) => n.id === selection.id) : null;
  const edge = selection.kind === "edge" ? graph.edges.find((e) => e.id === selection.id) : null;

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

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="text-2xs uppercase tracking-wider text-canvas-subtle">
            Available ops
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {loading ? (
              <div className="text-xs text-canvas-muted">resolving…</div>
            ) : ops.length === 0 ? (
              <div className="text-xs text-canvas-muted">
                No ops apply here. Try a freeform prompt instead.
              </div>
            ) : (
              ops.map((op) => {
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
    </div>
  );
}
