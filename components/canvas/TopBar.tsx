"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Layers,
  Search,
  Eye,
  EyeOff,
  ShieldCheck,
  BookOpen,
  X,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import type { GraphNode, NodeKind } from "@/extractor/types";

const KIND_LABEL: Record<NodeKind, string> = {
  route_handler: "route",
  service: "service",
  data_access: "data",
  middleware: "middleware",
  model: "model",
  external: "external",
  utility: "utility",
};

export function TopBar({
  subtitle,
  status,
}: {
  subtitle?: string;
  status?: ReactNode;
}) {
  const graph = useStore((s) => s.graph);

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/15 text-accent">
          <Layers className="h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
        <span className="text-sm font-medium tracking-tight text-canvas-ink">
          Schema
        </span>
        {subtitle ? (
          <>
            <span className="text-canvas-subtle">/</span>
            <span className="text-sm text-canvas-muted">{subtitle}</span>
          </>
        ) : null}
      </div>

      {graph ? (
        <>
          <Divider />
          <div className="flex items-center gap-1.5">
            <CoverageButton />
            <ReadmeButton />
            <SearchButton />
            <ResetDemoButton />
          </div>
        </>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-3">{status}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-5 w-px shrink-0 bg-canvas-border" />;
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
        "flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-2xs uppercase tracking-wider transition-colors",
        visible
          ? "bg-emerald-500/10 text-emerald-200"
          : "text-canvas-muted hover:bg-canvas-bg/50 hover:text-canvas-ink",
      )}
      title={`${covered.size}/${total} reachable from ${tests} test file(s)`}
    >
      {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      <ShieldCheck className="h-3 w-3" />
      coverage {pct}%
    </button>
  );
}

function ResetDemoButton() {
  const repoSource = useStore((s) => s.repoSource);
  const resetDemo = useStore((s) => s.resetDemo);
  const [resetting, setResetting] = useState(false);

  // Only show for local fixture repos
  if (repoSource !== "local") return null;

  return (
    <button
      onClick={async () => {
        setResetting(true);
        await resetDemo();
        setResetting(false);
      }}
      disabled={resetting}
      className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-2xs uppercase tracking-wider text-canvas-muted transition-colors hover:bg-canvas-bg/50 hover:text-canvas-ink disabled:opacity-50"
      title="Reset demo fixture to original state (undo all plan changes)"
    >
      <RotateCcw className={cn("h-3 w-3", resetting && "animate-spin")} />
      reset demo
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

  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-2xs uppercase tracking-wider text-canvas-muted transition-colors hover:bg-canvas-bg/50 hover:text-canvas-ink"
      >
        <BookOpen className="h-3 w-3" />
        readme
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[9999] w-[420px] animate-fade-in rounded-md border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur"
              style={{
                top: (btnRef.current?.getBoundingClientRect().bottom ?? 48) + 4,
                left: btnRef.current?.getBoundingClientRect().left ?? 200,
              }}
            >
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
            </div>,
            document.body,
          )
        : null}
    </div>
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
        className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-2xs text-canvas-muted transition-colors hover:bg-canvas-bg/50 hover:text-canvas-ink"
      >
        <Search className="h-3 w-3" />
        <span className="uppercase tracking-wider">search</span>
        <span className="font-mono text-canvas-subtle">⌘K</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-50 w-[360px] animate-fade-in rounded-md border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
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
