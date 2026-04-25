"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Eye,
  EyeOff,
  ShieldCheck,
  BookOpen,
  X,
} from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import type { GraphNode, NodeKind } from "@/extractor/types";

const KIND_ORDER: { kind: NodeKind; label: string; color: string }[] = [
  { kind: "route_handler", label: "routes", color: "bg-sky-400/80" },
  { kind: "service", label: "services", color: "bg-emerald-400/80" },
  { kind: "data_access", label: "data", color: "bg-amber-400/80" },
  { kind: "middleware", label: "middleware", color: "bg-violet-400/80" },
  { kind: "model", label: "models", color: "bg-cyan-400/80" },
  { kind: "utility", label: "utility", color: "bg-canvas-muted" },
];

const KIND_LABEL: Record<NodeKind, string> = {
  route_handler: "route",
  service: "service",
  data_access: "data",
  middleware: "middleware",
  model: "model",
  external: "external",
  utility: "utility",
};

export function TopToolbar() {
  const graph = useStore((s) => s.graph);
  if (!graph) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-4 z-20 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2">
      <KindLegend />
      <Divider />
      <CoverageButton />
      <ReadmeButton />
      <Divider />
      <SearchButton />
    </div>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-canvas-border" />;
}

function KindLegend() {
  const graph = useStore((s) => s.graph);
  const visibleKinds = useStore((s) => s.visibleKinds);
  const toggleKind = useStore((s) => s.toggleKind);
  if (!graph) return null;

  const counts = new Map<NodeKind, number>();
  for (const n of graph.nodes) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
  const present = KIND_ORDER.filter((k) => (counts.get(k.kind) ?? 0) > 0);

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-canvas-border bg-canvas-panel/95 px-1.5 py-1 shadow-panel backdrop-blur">
      {present.map((k) => {
        const count = counts.get(k.kind) ?? 0;
        const visible = visibleKinds[k.kind] !== false;
        return (
          <button
            key={k.kind}
            onClick={() => toggleKind(k.kind)}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-2xs uppercase tracking-wider transition-colors",
              visible
                ? "text-canvas-ink hover:bg-canvas-bg/50"
                : "text-canvas-subtle line-through hover:text-canvas-muted",
            )}
            title={visible ? `Hide ${k.label}` : `Show ${k.label}`}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-opacity",
                k.color,
                visible ? "" : "opacity-30",
              )}
            />
            {k.label}
            <span className="font-mono text-canvas-subtle">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function CoverageButton() {
  const visible = useStore((s) => s.coverageVisible);
  const toggle = useStore((s) => s.toggleCoverage);
  const covered = useStore((s) => s.coveredNodeIds);
  const total = useStore((s) => s.graph?.nodes.length ?? 0);
  const tests = useStore((s) => s.testFileCount);
  const pct = total > 0 ? Math.round((covered.size / total) * 100) : 0;

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1.5 rounded-md border bg-canvas-panel/95 px-2.5 py-1.5 text-2xs uppercase tracking-wider shadow-panel backdrop-blur transition-colors",
        visible
          ? "border-emerald-300/40 text-emerald-200"
          : "border-canvas-border text-canvas-muted hover:text-canvas-ink",
      )}
      title={`${covered.size}/${total} reachable from ${tests} test file(s) — click to ${visible ? "hide" : "show"}`}
    >
      {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      <ShieldCheck className="h-3 w-3" />
      coverage {pct}%
    </button>
  );
}

function ReadmeButton() {
  const readme = useStore((s) => s.readme);
  const origin = useStore((s) => s.origin);
  const [open, setOpen] = useState(false);

  if (!readme || !readme.found || !readme.excerpt) return null;
  const title =
    origin?.kind === "github"
      ? `${origin.owner}/${origin.repo}`
      : readme.file ?? "README";

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-panel/95 px-2.5 py-1.5 text-2xs uppercase tracking-wider text-canvas-muted shadow-panel backdrop-blur transition-colors hover:text-canvas-ink"
      >
        <BookOpen className="h-3 w-3" />
        readme
      </button>
      {open ? (
        <div className="absolute left-0 top-12 w-[420px] animate-fade-in rounded-md border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
          <div className="flex items-center justify-between border-b border-canvas-border px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <BookOpen className="h-3.5 w-3.5 text-canvas-muted" />
              <span className="text-canvas-ink">{title}</span>
              {readme.file ? (
                <span className="font-mono text-2xs text-canvas-subtle">
                  {readme.file}
                </span>
              ) : null}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-canvas-subtle hover:bg-canvas-bg/40 hover:text-canvas-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="max-h-[420px] overflow-auto px-3 py-2 font-mono text-2xs leading-relaxed text-canvas-muted whitespace-pre-wrap">
            {readme.excerpt}
          </pre>
        </div>
      ) : null}
    </>
  );
}

function SearchButton() {
  const graph = useStore((s) => s.graph);
  const selectNode = useStore((s) => s.selectNode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isInputFocused) return;
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    if (!graph || !query.trim()) return [] as GraphNode[];
    const q = query.toLowerCase();
    return graph.nodes
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.file.toLowerCase().includes(q) ||
          (n.meta?.httpPath ?? "").toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [graph, query]);

  if (!graph) return null;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-panel/95 px-2.5 py-1.5 text-2xs text-canvas-muted shadow-panel backdrop-blur transition-colors hover:text-canvas-ink"
      >
        <Search className="h-3 w-3" />
        <span className="uppercase tracking-wider">search</span>
        <span className="font-mono text-canvas-subtle">⌘K</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-10 w-[360px] animate-fade-in rounded-md border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
          <div className="flex items-center gap-2 border-b border-canvas-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-canvas-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                  inputRef.current?.blur();
                } else if (e.key === "Enter" && matches[0]) {
                  selectNode(matches[0].id);
                  setOpen(false);
                  setQuery("");
                  inputRef.current?.blur();
                }
              }}
              placeholder="search node, file, or path…"
              className="flex-1 bg-transparent text-xs text-canvas-ink placeholder:text-canvas-subtle outline-none"
            />
          </div>
          {matches.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto">
              {matches.map((node) => (
                <button
                  key={node.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectNode(node.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-canvas-bg/50"
                >
                  <span className="rounded bg-canvas-bg/60 px-1.5 py-0.5 text-2xs uppercase tracking-wider text-canvas-muted">
                    {KIND_LABEL[node.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-canvas-ink">
                    {node.meta?.httpMethod
                      ? `${node.meta.httpMethod} ${node.meta.httpPath}`
                      : node.name}
                  </span>
                  <span className="truncate text-2xs text-canvas-subtle">
                    {node.file.replace(/^src\//, "")}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
