"use client";

import { useEffect, useState } from "react";
import { Github, Loader2, Play, Folder, KeyRound, Sparkles } from "lucide-react";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

const LOADING_PHASES = [
  "Walking source files with ts-morph",
  "Reading README for domain context",
  "Asking Sonnet to cluster components",
  "Surfacing architectural insights",
];

function useLoadingPhase(loading: boolean): string {
  const [phase, setPhase] = useState(LOADING_PHASES[0]!);
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setPhase(LOADING_PHASES[0]!);
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_PHASES.length;
      setPhase(LOADING_PHASES[i]!);
    }, 4500);
    return () => clearInterval(interval);
  }, [loading]);
  return phase;
}

const SAMPLE_REPOS: { label: string; value: string; tag: string }[] = [
  { label: "Express + JWT demo", value: "fixtures/demo-app", tag: "local" },
  { label: "honojs / examples", value: "honojs/examples", tag: "github" },
  { label: "trpc / examples", value: "trpc/examples", tag: "github" },
];

export function EmptyState() {
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.loadError);
  const repoSource = useStore((s) => s.repoSource);
  const repoValue = useStore((s) => s.repoValue);
  const repoToken = useStore((s) => s.repoToken);
  const setRepoSource = useStore((s) => s.setRepoSource);
  const setRepoValue = useStore((s) => s.setRepoValue);
  const setRepoToken = useStore((s) => s.setRepoToken);
  const loadGraph = useStore((s) => s.loadGraph);

  const [showToken, setShowToken] = useState(false);
  const phase = useLoadingPhase(loading);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-canvas-border bg-canvas-panel/90 px-6 py-8 shadow-panel backdrop-blur">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            <Loader2 className="h-7 w-7 animate-spin text-accent" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="text-sm font-medium text-canvas-ink">
              {repoSource === "github"
                ? `Loading ${repoValue}`
                : `Loading ${repoValue}`}
            </div>
            <div className="animate-fade-in text-2xs text-canvas-subtle" key={phase}>
              {phase}…
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-md rounded-xl border border-canvas-border bg-canvas-panel/90 p-6 shadow-panel backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <span className="text-xs font-semibold">S</span>
          </div>
          <div>
            <div className="text-base font-medium text-canvas-ink">Schema</div>
            <div className="text-2xs uppercase tracking-wider text-canvas-subtle">
              brownfield architecture editor
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-md border border-canvas-border bg-canvas-bg/40 p-1">
          <TabButton
            active={repoSource === "github"}
            onClick={() => {
              setRepoSource("github");
              if (repoValue === "fixtures/demo-app") setRepoValue("");
            }}
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </TabButton>
          <TabButton
            active={repoSource === "local"}
            onClick={() => {
              setRepoSource("local");
              if (!repoValue) setRepoValue("fixtures/demo-app");
            }}
          >
            <Folder className="h-3.5 w-3.5" />
            Local
          </TabButton>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <label className="text-2xs uppercase tracking-wider text-canvas-subtle">
            {repoSource === "github" ? "GitHub repository" : "Local path"}
          </label>
          <input
            value={repoValue}
            onChange={(e) => setRepoValue(e.target.value)}
            className="rounded-md border border-canvas-border bg-canvas-bg/60 px-3 py-2 font-mono text-xs text-canvas-ink outline-none focus:border-accent"
            placeholder={
              repoSource === "github"
                ? "owner/repo  or  https://github.com/owner/repo"
                : "fixtures/demo-app"
            }
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>

        {repoSource === "github" ? (
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => setShowToken((v) => !v)}
              className="flex items-center gap-1.5 self-start text-2xs uppercase tracking-wider text-canvas-subtle transition-colors hover:text-canvas-muted"
            >
              <KeyRound className="h-3 w-3" />
              {showToken ? "hide token" : "private repo? add token"}
            </button>
            {showToken ? (
              <input
                type="password"
                value={repoToken}
                onChange={(e) => setRepoToken(e.target.value)}
                className="rounded-md border border-canvas-border bg-canvas-bg/60 px-3 py-2 font-mono text-xs text-canvas-ink outline-none focus:border-accent"
                placeholder="ghp_…  (kept in memory; sent only with this clone)"
                spellCheck={false}
              />
            ) : null}
          </div>
        ) : null}

        <button
          onClick={loadGraph}
          disabled={loading || !repoValue.trim()}
          className={cn(
            "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-canvas-bg transition hover:brightness-110",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" fill="currentColor" />
          )}
          {loading ? loadingLabel(repoSource) : "Extract architecture"}
        </button>

        {error ? (
          <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-2xs text-rose-200">
            {error}
          </div>
        ) : (
          <div className="mt-4 text-2xs leading-relaxed text-canvas-subtle">
            {repoSource === "github" ? (
              <>
                Public repos work without a token. Schema reads the README for
                domain context and runs the test suite to gate every edit.
              </>
            ) : (
              <>
                Default points at the bundled demo (Express + sqlite + JWT, with
                a deliberate auth gap on resource routes).
              </>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-canvas-border pt-4">
          <div className="text-2xs uppercase tracking-wider text-canvas-subtle">
            Try it on
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {SAMPLE_REPOS.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setRepoSource(s.tag === "github" ? "github" : "local");
                  setRepoValue(s.value);
                }}
                disabled={loading}
                className="group flex items-center justify-between rounded-md border border-transparent bg-canvas-bg/40 px-3 py-1.5 text-left text-xs text-canvas-muted transition-colors hover:border-canvas-border hover:bg-canvas-bg/70 hover:text-canvas-ink"
              >
                <span>{s.label}</span>
                <span className="font-mono text-2xs text-canvas-subtle">
                  {s.tag}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-canvas-border pt-4">
          <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-canvas-subtle">
            <Sparkles className="h-3 w-3 text-accent" />
            Once loaded, try a prompt
          </div>
          <div className="mt-2 flex flex-col gap-1 text-2xs text-canvas-muted">
            <code className="rounded bg-canvas-bg/40 px-2 py-1 font-mono">
              "protect every unauthed resource route"
            </code>
            <code className="rounded bg-canvas-bg/40 px-2 py-1 font-mono">
              "memoize verifyToken so middleware doesn&apos;t re-verify"
            </code>
            <code className="rounded bg-canvas-bg/40 px-2 py-1 font-mono">
              "extract auth into its own module"
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
        active
          ? "bg-canvas-panel text-canvas-ink shadow-sm"
          : "text-canvas-muted hover:text-canvas-ink",
      )}
    >
      {children}
    </button>
  );
}

function loadingLabel(source: "local" | "github"): string {
  return source === "github" ? "Cloning + extracting…" : "Extracting…";
}
