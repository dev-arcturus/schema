"use client";

import { useEffect, useState } from "react";
import { Code } from "lucide-react";
import { useStore } from "@/state/store";

type Snippet = {
  file: string;
  snippet: string;
  startLine: number;
  endLine: number;
  totalLines: number;
};

export function CodePreview() {
  const selection = useStore((s) => s.selection);
  const graph = useStore((s) => s.graph);
  const repoPath = useStore((s) => s.resolvedRepoPath);
  const [data, setData] = useState<Snippet | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const node =
    selection?.kind === "node"
      ? graph?.nodes.find((n) => n.id === selection.id)
      : null;

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErr(null);
    if (!node) return;
    setLoading(true);
    fetch("/api/source", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repoPath,
        file: node.file,
        range: node.range,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) throw new Error(d.error);
        setData(d as Snippet);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node?.id, node?.file, node?.range.start, node?.range.end, repoPath]);

  if (!node) return null;

  return (
    <div className="border-t border-canvas-border">
      <div className="flex items-center gap-2 px-4 py-2 text-2xs uppercase tracking-wider text-canvas-subtle">
        <Code className="h-3 w-3" />
        <span>source</span>
        {data ? (
          <span className="ml-auto font-mono text-canvas-muted">
            L{data.startLine}–{data.endLine}
          </span>
        ) : null}
      </div>
      <div className="bg-canvas-bg/60">
        {loading ? (
          <div className="px-4 py-3 text-2xs text-canvas-muted">loading…</div>
        ) : err ? (
          <div className="px-4 py-3 text-2xs text-rose-300">{err}</div>
        ) : data ? (
          <pre className="max-h-[260px] overflow-auto px-4 py-2 font-mono text-2xs leading-relaxed text-canvas-ink">
            {data.snippet}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
