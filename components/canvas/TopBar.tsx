import type { ReactNode } from "react";
import { Layers } from "lucide-react";

export function TopBar({
  subtitle,
  status,
}: {
  subtitle?: string;
  status?: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/15 text-accent">
          <Layers className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <span className="text-sm font-medium tracking-tight text-canvas-ink">
          Schema
        </span>
      </div>
      {subtitle ? (
        <>
          <span className="text-canvas-subtle">/</span>
          <span className="text-sm text-canvas-muted">{subtitle}</span>
        </>
      ) : null}
      <div className="ml-auto">{status}</div>
    </div>
  );
}
