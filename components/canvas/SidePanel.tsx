"use client";

import { CheckCircle2, Loader2, X, AlertTriangle } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { ParamsForm } from "./ParamsForm";
import { DiffView } from "./DiffView";

export function SidePanel() {
  const pendingOp = useStore((s) => s.pendingOp);
  const applicableOps = useStore((s) => s.applicableOps);
  const applyState = useStore((s) => s.applyState);
  const cancelOp = useStore((s) => s.cancelOp);
  const applyOp = useStore((s) => s.applyOp);
  const dismissApplyState = useStore((s) => s.dismissApplyState);

  if (!pendingOp && applyState.phase === "idle") {
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
    return (
      <PanelShell
        title="Tests failed — rolled back"
        subtitle={applyState.opName}
        onClose={dismissApplyState}
        accent="danger"
      >
        <div className="flex items-start gap-2 border-b border-canvas-border px-4 py-3 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <div>{applyState.explanation ?? applyState.error}</div>
            {applyState.explanation && applyState.error && (
              <div className="mt-1 font-mono text-2xs text-rose-300/70">
                {applyState.error}
              </div>
            )}
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
  return (
    <div className="flex h-full flex-col items-start justify-start gap-3 px-5 py-6 text-xs text-canvas-muted">
      <div className="text-sm font-medium text-canvas-ink">Inspector</div>
      <p>Click any node or edge to see the architectural ops available there.</p>
      <div className="mt-2 rounded border border-canvas-border bg-canvas-bg/60 px-3 py-2 text-2xs leading-relaxed">
        Try: select <span className="font-mono text-canvas-ink">GET /todos</span>{" "}
        and add the <span className="font-mono text-canvas-ink">requireAuth</span>{" "}
        middleware. Watch the auth gap close.
      </div>
    </div>
  );
}
