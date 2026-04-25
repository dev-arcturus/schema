"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
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

export function SearchBar() {
  const graph = useStore((s) => s.graph);
  const selectNode = useStore((s) => s.selectNode);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
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
      .filter((n) => {
        const httpPath = n.meta?.httpPath ?? "";
        return (
          n.name.toLowerCase().includes(q) ||
          n.file.toLowerCase().includes(q) ||
          httpPath.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [graph, query]);

  if (!graph) return null;

  return (
    <div className="pointer-events-auto absolute right-4 top-16 z-20">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur transition-all",
          open ? "w-[380px] px-3" : "w-[200px] px-3 hover:bg-canvas-panel",
        )}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Search className="h-3.5 w-3.5 text-canvas-subtle" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "Enter" && matches[0]) {
              selectNode(matches[0].id);
              setQuery("");
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={open ? "search node, file, or path…" : "search…"}
          className="flex-1 bg-transparent py-1.5 text-xs text-canvas-ink placeholder:text-canvas-subtle outline-none"
        />
        {open && query ? (
          <button
            className="text-canvas-subtle hover:text-canvas-ink"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery("");
            }}
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <span className="font-mono text-2xs text-canvas-subtle">⌘K</span>
        )}
      </div>
      {open && matches.length > 0 ? (
        <div className="mt-1 max-h-[320px] w-[380px] overflow-y-auto rounded-md border border-canvas-border bg-canvas-panel/95 shadow-panel backdrop-blur">
          {matches.map((node) => (
            <button
              key={node.id}
              onMouseDown={(e) => {
                e.preventDefault();
                selectNode(node.id);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-canvas-bg/50"
            >
              <span className="rounded bg-canvas-bg/60 px-1.5 py-0.5 text-2xs uppercase tracking-wider text-canvas-muted">
                {KIND_LABEL[node.kind]}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-canvas-ink">
                {node.meta?.httpMethod ? `${node.meta.httpMethod} ${node.meta.httpPath}` : node.name}
              </span>
              <span className="truncate text-2xs text-canvas-subtle">
                {node.file}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
