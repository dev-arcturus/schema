"use client";

import { create } from "zustand";
import type { Graph, GraphEdge, GraphNode, NodeKind } from "@/extractor/types";
import type { OpDescriptor, OpGraphPatch } from "@/ops/types";
import type { Plan, StepResult } from "@/lib/planSchema";
import type { Rule, Violation } from "@/lib/rules";

export type Insight = {
  id: string;
  title: string;
  rationale: string;
  severity: "low" | "medium" | "high";
  targetIds: string[];
  suggestedPrompt: string;
};

export type ConversationTurn = {
  prompt: string;
  intent?: string;
  appliedSteps?: string[];
};

export type PlanState =
  | { phase: "idle" }
  | {
      phase: "thinking";
      prompt: string;
      partial?: Partial<Plan> | null;
    }
  | {
      phase: "preview";
      prompt: string;
      plan: Plan;
    }
  | {
      phase: "running";
      prompt: string;
      plan: Plan;
      results: StepResult[];
      currentIndex: number;
    }
  | {
      phase: "done";
      prompt: string;
      plan: Plan;
      results: StepResult[];
      ok: boolean;
    };

export type RepoOrigin =
  | { kind: "local" }
  | { kind: "github"; owner: string; repo: string; url: string };

export type RepoReadmeInfo = {
  found: boolean;
  file?: string;
  excerpt?: string;
};

export type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

export type ApplyState =
  | { phase: "idle" }
  | { phase: "running"; opName: string }
  | {
      phase: "success";
      opName: string;
      diff: string;
      filesChanged: string[];
      description: string;
      testOutput: string;
      durationMs: number;
    }
  | {
      phase: "error";
      opName: string;
      diff: string;
      error: string;
      explanation?: string;
      testOutput?: string;
      filesChanged: string[];
    };

export type HistoryEntry = {
  opName: string;
  description: string;
  filesChanged: string[];
  reverse: { type: "patch"; patch: OpGraphPatch };
  timestamp: number;
};

type Store = {
  repoSource: "local" | "github";
  repoValue: string;
  repoToken: string;
  resolvedRepoPath: string;
  origin: RepoOrigin | null;
  readme: RepoReadmeInfo | null;

  graph: Graph | null;
  summary: string | null;
  loading: boolean;
  loadError: string | null;
  clusterSource?: "llm" | "fallback";
  clusterReason?: string;

  selection: Selection;
  applicableOps: OpDescriptor[];
  applicableLoading: boolean;

  pendingOp: { name: string; params: Record<string, unknown> } | null;
  applyState: ApplyState;

  history: HistoryEntry[];
  failureFlash: { targetId: string; until: number } | null;
  recentlyAdded: { nodeIds: Set<string>; edgeIds: Set<string>; until: number } | null;
  focusTargetIds: string[];
  hoverHighlightIds: string[];
  setHoverHighlight: (ids: string[]) => void;
  sessionStats: { prompts: number; stepsApplied: number; filesChanged: number };

  rightTab: "inspector" | "insights" | "rules" | "history";
  setRightTab: (tab: "inspector" | "insights" | "rules" | "history") => void;

  commandBarFocused: boolean;
  setCommandBarFocused: (focused: boolean) => void;

  rightPanelWidth: number;
  setRightPanelWidth: (width: number) => void;

  visibleKinds: Partial<Record<NodeKind, boolean>>;
  toggleKind: (kind: NodeKind) => void;

  rules: Rule[];
  violations: Violation[];
  rulesLoading: boolean;
  ruleCompileError: string | null;
  loadRules: () => Promise<void>;
  addRuleFromPrompt: (prompt: string, severity?: Rule["severity"]) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  toggleRuleEnabled: (id: string, enabled: boolean) => Promise<void>;
  applyRuleFix: (violation: Violation) => Promise<void>;

  coveredNodeIds: Set<string>;
  testFileCount: number;
  coverageVisible: boolean;
  toggleCoverage: () => void;
  loadCoverage: () => Promise<void>;

  planState: PlanState;
  chatHistory: ConversationTurn[];
  lastPrompt: string | null;
  insights: Insight[];
  insightsLoading: boolean;
  submitPrompt: (prompt: string) => Promise<void>;
  approvePlan: () => Promise<void>;
  cancelPlan: () => void;
  retryLastPrompt: () => Promise<void>;
  loadInsights: () => Promise<void>;

  setRepoSource: (source: "local" | "github") => void;
  setRepoValue: (v: string) => void;
  setRepoToken: (t: string) => void;
  loadGraph: () => Promise<void>;
  selectNode: (id: string) => void;
  selectEdge: (id: string) => void;
  clearSelection: () => void;
  startOp: (name: string) => void;
  cancelOp: () => void;
  setOpParam: (key: string, value: unknown) => void;
  applyOp: () => Promise<void>;
  dismissApplyState: () => void;
  undoGraph: () => void;
};

export const useStore = create<Store>((set, get) => ({
  repoSource: "local",
  repoValue: "fixtures/demo-app",
  repoToken: "",
  resolvedRepoPath: "fixtures/demo-app",
  origin: null,
  readme: null,
  graph: null,
  summary: null,
  loading: false,
  loadError: null,
  clusterSource: undefined,
  clusterReason: undefined,

  selection: null,
  applicableOps: [],
  applicableLoading: false,
  pendingOp: null,
  applyState: { phase: "idle" },

  history: [],
  failureFlash: null,
  recentlyAdded: null,
  focusTargetIds: [],
  hoverHighlightIds: [],
  setHoverHighlight: (ids) => set({ hoverHighlightIds: ids }),
  sessionStats: { prompts: 0, stepsApplied: 0, filesChanged: 0 },

  rightTab: "insights",
  setRightTab: (tab) => set({ rightTab: tab }),

  commandBarFocused: false,
  setCommandBarFocused: (focused) => set({ commandBarFocused: focused }),

  rightPanelWidth: typeof window !== "undefined"
    ? Number(localStorage.getItem("schema:rightPanelWidth") ?? 360)
    : 360,
  setRightPanelWidth: (width) => {
    const clamped = Math.min(720, Math.max(260, width));
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("schema:rightPanelWidth", String(clamped));
      } catch {
        // ignore
      }
    }
    set({ rightPanelWidth: clamped });
  },

  rules: [],
  violations: [],
  rulesLoading: false,
  ruleCompileError: null,

  coveredNodeIds: new Set(),
  testFileCount: 0,
  coverageVisible: false,
  toggleCoverage: () => {
    set((s) => ({ coverageVisible: !s.coverageVisible }));
  },
  async loadCoverage() {
    const { resolvedRepoPath, graph } = get();
    if (!graph) return;
    try {
      const res = await fetch("/api/coverage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoPath: resolvedRepoPath, graph }),
      });
      const data = await res.json();
      set({
        coveredNodeIds: new Set<string>(
          Array.isArray(data.coveredNodeIds) ? data.coveredNodeIds : [],
        ),
        testFileCount: typeof data.testFileCount === "number" ? data.testFileCount : 0,
      });
    } catch {
      // ignore
    }
  },

  async loadRules() {
    const { resolvedRepoPath, graph } = get();
    if (!graph) return;
    set({ rulesLoading: true });
    try {
      const res = await fetch("/api/rules/violations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoPath: resolvedRepoPath, graph }),
      });
      const data = await res.json();
      set({
        rules: Array.isArray(data.rules) ? data.rules : [],
        violations: Array.isArray(data.violations) ? data.violations : [],
        rulesLoading: false,
      });
    } catch {
      set({ rulesLoading: false });
    }
  },

  async addRuleFromPrompt(prompt, severity = "warn") {
    const { resolvedRepoPath } = get();
    set({ ruleCompileError: null, rulesLoading: true });
    try {
      const compileRes = await fetch("/api/rules/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const compiled = await compileRes.json();
      if (!compileRes.ok || !compiled?.predicate) {
        throw new Error(compiled?.error ?? "compile failed");
      }
      const rule: Rule = {
        id: `rule:${Date.now().toString(36)}`,
        title: compiled.title ?? prompt.slice(0, 80),
        prompt,
        predicate: compiled.predicate,
        severity,
        createdAt: Date.now(),
        enabled: true,
      };
      const saveRes = await fetch("/api/rules/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "add",
          repoPath: resolvedRepoPath,
          rule,
        }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "save failed");
      }
      await get().loadRules();
    } catch (err) {
      set({
        ruleCompileError: err instanceof Error ? err.message : "rule failed",
        rulesLoading: false,
      });
    }
  },

  async removeRule(id) {
    const { resolvedRepoPath } = get();
    await fetch("/api/rules/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "remove", repoPath: resolvedRepoPath, id }),
    });
    await get().loadRules();
  },

  async toggleRuleEnabled(id, enabled) {
    const { resolvedRepoPath } = get();
    await fetch("/api/rules/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "toggle",
        repoPath: resolvedRepoPath,
        id,
        enabled,
      }),
    });
    await get().loadRules();
  },

  async applyRuleFix(violation) {
    const prompt = violation.suggestedPrompt ?? `Fix: ${violation.ruleTitle}`;
    await get().submitPrompt(prompt);
  },

  visibleKinds: {
    route_handler: true,
    service: true,
    data_access: true,
    middleware: true,
    model: true,
    utility: true,
    external: true,
  },
  toggleKind: (kind) =>
    set((s) => ({
      visibleKinds: {
        ...s.visibleKinds,
        [kind]: !(s.visibleKinds[kind] ?? true),
      },
    })),

  planState: { phase: "idle" },
  chatHistory: [],
  lastPrompt: null,
  insights: [],
  insightsLoading: false,

  async submitPrompt(prompt) {
    const { graph, chatHistory } = get();
    if (!graph || !prompt.trim()) return;
    set({
      planState: { phase: "thinking", prompt, partial: null },
      lastPrompt: prompt,
    });
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          graph,
          history: chatHistory.slice(-3),
          stream: true,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `plan failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalPlan: Plan | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let payload: { type: string; plan?: Partial<Plan>; error?: string };
          try {
            payload = JSON.parse(line);
          } catch {
            continue;
          }
          if (payload.type === "partial") {
            const cur = get().planState;
            if (cur.phase === "thinking") {
              set({
                planState: {
                  phase: "thinking",
                  prompt: cur.prompt,
                  partial: payload.plan ?? null,
                },
              });
            }
          } else if (payload.type === "final" && payload.plan) {
            finalPlan = payload.plan as Plan;
          } else if (payload.type === "error") {
            streamError = payload.error ?? "stream error";
          }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!finalPlan) throw new Error("no plan returned");
      set({ planState: { phase: "preview", prompt, plan: finalPlan } });
    } catch (err) {
      set({
        planState: { phase: "idle" },
        applyState: {
          phase: "error",
          opName: "plan",
          diff: "",
          error: err instanceof Error ? err.message : "plan failed",
          filesChanged: [],
        },
        lastPrompt: prompt,
      });
    }
  },

  async approvePlan() {
    const state = get();
    const ps = state.planState;
    if (ps.phase !== "preview") return;
    const { plan, prompt } = ps;
    const results: StepResult[] = plan.steps.map((s) => ({
      status: "pending",
      description: s.description,
    }));
    set({
      planState: {
        phase: "running",
        prompt,
        plan,
        results,
        currentIndex: 0,
      },
    });

    let ok = true;
    let workingGraph = state.graph!;
    const appliedDescriptions: string[] = [];
    const focusIds = plan.steps
      .filter((s): s is Extract<typeof s, { kind: "op" }> => s.kind === "op")
      .map((s) => s.targetId);
    set({ focusTargetIds: focusIds });

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]!;
      const cur = get().planState;
      if (cur.phase !== "running") return; // cancelled
      const newResults = [...cur.results];
      newResults[i] = { ...newResults[i]!, status: "running" };
      set({
        planState: { ...cur, results: newResults, currentIndex: i },
      });

      try {
        const res = await fetch("/api/plan/execute-step-stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            repoPath: get().resolvedRepoPath,
            graph: workingGraph,
            step,
            intent: prompt,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error("execute-step request failed");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let live = "";
        let data: Record<string, unknown> | null = null;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buf += decoder.decode(chunk.value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(line);
            } catch {
              continue;
            }
            if (ev.type === "test_output" && typeof ev.chunk === "string") {
              live += ev.chunk;
              const cur = get().planState;
              if (cur.phase === "running") {
                const rr = [...cur.results];
                rr[i] = {
                  ...rr[i]!,
                  status: "running",
                  testOutputLive: live,
                };
                set({ planState: { ...cur, results: rr } });
              }
            } else if (ev.type === "phase") {
              const cur = get().planState;
              if (cur.phase === "running") {
                const rr = [...cur.results];
                rr[i] = {
                  ...rr[i]!,
                  status: "running",
                  phase: ev.phase as StepResult["phase"],
                };
                set({ planState: { ...cur, results: rr } });
              }
            } else if (ev.type === "diff") {
              const cur = get().planState;
              if (cur.phase === "running") {
                const rr = [...cur.results];
                rr[i] = {
                  ...rr[i]!,
                  status: "running",
                  diff: ev.diff as string,
                  filesChanged: ev.filesChanged as string[],
                };
                set({ planState: { ...cur, results: rr } });
              }
            } else if (ev.type === "result") {
              data = ev;
            }
          }
        }
        if (!data) {
          throw new Error("no result from stream");
        }
        const cur2 = get().planState;
        if (cur2.phase !== "running") return;
        const r2 = [...cur2.results];
        if (data.ok) {
          r2[i] = {
            status: "success",
            description: (data.description as string) ?? step.description,
            diff: data.diff as string | undefined,
            filesChanged: data.filesChanged as string[] | undefined,
            testOutput: data.testOutput as string | undefined,
            intentCheck: data.intentCheck as
              | { matches: boolean; reason: string }
              | undefined,
          };
          if (data.graphPatch) {
            workingGraph = applyPatch(
              workingGraph,
              data.graphPatch as OpGraphPatch,
            );
            // re-evaluate rules whenever graph changes
            void get().loadRules();
            const patch = data.graphPatch as OpGraphPatch;
            const newNodeIds = new Set<string>(
              (patch.addNodes ?? []).map((n) => n.id),
            );
            const newEdgeIds = new Set<string>(
              (patch.addEdges ?? []).map((e) => e.id),
            );
            set({
              graph: workingGraph,
              recentlyAdded: {
                nodeIds: newNodeIds,
                edgeIds: newEdgeIds,
                until: Date.now() + 3500,
              },
            });
          }
          appliedDescriptions.push(step.description);
        } else {
          ok = false;
          r2[i] = {
            status: "failure",
            description: step.description,
            diff: (data.diff as string) ?? "",
            filesChanged: (data.filesChanged as string[]) ?? [],
            testOutput: data.testOutput as string | undefined,
            error: data.error as string,
            explanation: data.explanation as string | undefined,
          };
          // Mark remaining as skipped
          for (let j = i + 1; j < r2.length; j++) {
            r2[j] = { ...r2[j]!, status: "skipped" };
          }
          set({ planState: { ...cur2, results: r2, currentIndex: i } });
          break;
        }
        set({ planState: { ...cur2, results: r2, currentIndex: i } });
      } catch (err) {
        ok = false;
        const cur3 = get().planState;
        if (cur3.phase !== "running") return;
        const r3 = [...cur3.results];
        r3[i] = {
          status: "failure",
          description: step.description,
          error: err instanceof Error ? err.message : "request failed",
        };
        for (let j = i + 1; j < r3.length; j++) {
          r3[j] = { ...r3[j]!, status: "skipped" };
        }
        set({ planState: { ...cur3, results: r3, currentIndex: i } });
        break;
      }
    }

    const final = get().planState;
    if (final.phase !== "running") return;
    const stepsApplied = final.results.filter((r) => r.status === "success").length;
    const filesTouched = new Set<string>();
    for (const r of final.results) {
      for (const f of r.filesChanged ?? []) filesTouched.add(f);
    }
    const prevStats = get().sessionStats;
    set({
      planState: {
        phase: "done",
        prompt,
        plan,
        results: final.results,
        ok,
      },
      focusTargetIds: [],
      chatHistory: [
        ...get().chatHistory,
        { prompt, intent: plan.intent, appliedSteps: appliedDescriptions },
      ],
      sessionStats: {
        prompts: prevStats.prompts + 1,
        stepsApplied: prevStats.stepsApplied + stepsApplied,
        filesChanged: prevStats.filesChanged + filesTouched.size,
      },
    });
  },

  cancelPlan() {
    set({ planState: { phase: "idle" }, focusTargetIds: [] });
  },

  async retryLastPrompt() {
    const last = get().lastPrompt;
    if (!last) return;
    set({
      applyState: { phase: "idle" },
      planState: { phase: "idle" },
    });
    await get().submitPrompt(last);
  },

  async loadInsights() {
    const { graph } = get();
    if (!graph) return;
    set({ insightsLoading: true });
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graph }),
      });
      const data = await res.json();
      set({
        insights: Array.isArray(data.insights) ? data.insights : [],
        insightsLoading: false,
      });
    } catch {
      set({ insightsLoading: false });
    }
  },

  setRepoSource: (source) => set({ repoSource: source }),
  setRepoValue: (v) => set({ repoValue: v }),
  setRepoToken: (t) => set({ repoToken: t }),

  async loadGraph() {
    set({ loading: true, loadError: null });
    const { repoSource, repoValue, repoToken } = get();
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: repoSource,
          value: repoValue,
          token: repoSource === "github" && repoToken ? repoToken : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `extract failed (${res.status})`);
      }
      const data = await res.json();
      set({
        graph: data.graph,
        summary: data.summary ?? null,
        clusterSource: data.clusterSource,
        clusterReason: data.clusterReason,
        readme: data.readme
          ? {
              found: data.readme.found,
              file: data.readme.file,
              excerpt: data.readme.excerpt,
            }
          : null,
        origin: data.origin ?? null,
        resolvedRepoPath: data.repoPath ?? get().resolvedRepoPath,
        loading: false,
        chatHistory: [],
        insights: [],
        sessionStats: { prompts: 0, stepsApplied: 0, filesChanged: 0 },
        rules: [],
        violations: [],
      });
      void get().loadInsights();
      void get().loadRules();
      void get().loadCoverage();
    } catch (err) {
      set({
        loading: false,
        loadError: err instanceof Error ? err.message : "extract failed",
      });
    }
  },

  selectNode: (id) => {
    set({
      selection: { kind: "node", id },
      pendingOp: null,
      applyState: { phase: "idle" },
      rightTab: "inspector",
    });
    void fetchApplicableOps();
  },

  selectEdge: (id) => {
    set({
      selection: { kind: "edge", id },
      pendingOp: null,
      applyState: { phase: "idle" },
      rightTab: "inspector",
    });
    void fetchApplicableOps();
  },

  clearSelection: () =>
    set({
      selection: null,
      applicableOps: [],
      pendingOp: null,
      applyState: { phase: "idle" },
    }),

  startOp(name) {
    const op = get().applicableOps.find((o) => o.name === name);
    if (!op) return;
    const initial: Record<string, unknown> = {};
    for (const f of op.paramsUI) {
      if (f.type === "text") initial[f.name] = f.defaultValue ?? "";
      else if (f.type === "number") initial[f.name] = f.defaultValue ?? 0;
      else if (f.type === "select")
        initial[f.name] = f.defaultValue ?? f.options[0]?.value ?? "";
      else if (f.type === "graph-select") initial[f.name] = "";
    }
    set({ pendingOp: { name, params: initial } });
  },

  cancelOp: () => set({ pendingOp: null, applyState: { phase: "idle" } }),

  setOpParam(key, value) {
    const cur = get().pendingOp;
    if (!cur) return;
    set({ pendingOp: { ...cur, params: { ...cur.params, [key]: value } } });
  },

  async applyOp() {
    const { pendingOp, selection, graph, resolvedRepoPath } = get();
    if (!pendingOp || !selection || !graph) return;

    set({ applyState: { phase: "running", opName: pendingOp.name } });

    try {
      const res = await fetch("/api/ops/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repoPath: resolvedRepoPath,
          graph,
          opName: pendingOp.name,
          target: selection,
          params: paramsForApi(pendingOp.params, graph),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const patched = applyPatch(graph, data.graphPatch);
        set({
          graph: patched,
          applyState: {
            phase: "success",
            opName: pendingOp.name,
            diff: data.diff,
            filesChanged: data.filesChanged,
            description: data.description,
            testOutput: data.testRun?.output ?? "",
            durationMs: data.testRun?.durationMs ?? 0,
          },
          pendingOp: null,
          history: [
            ...get().history,
            {
              opName: pendingOp.name,
              description: data.description,
              filesChanged: data.filesChanged,
              reverse: { type: "patch", patch: reversePatch(data.graphPatch) },
              timestamp: Date.now(),
            },
          ],
        });
      } else {
        set({
          applyState: {
            phase: "error",
            opName: pendingOp.name,
            diff: data.diff ?? "",
            error: data.error ?? "unknown error",
            explanation: data.explanation,
            testOutput: data.testRun?.output,
            filesChanged: data.filesChanged ?? [],
          },
          failureFlash: selection
            ? { targetId: selection.id, until: Date.now() + 4000 }
            : null,
        });
      }
    } catch (err) {
      set({
        applyState: {
          phase: "error",
          opName: pendingOp.name,
          diff: "",
          error: err instanceof Error ? err.message : "apply failed",
          filesChanged: [],
        },
      });
    }
  },

  dismissApplyState: () => set({ applyState: { phase: "idle" } }),

  undoGraph: () => {
    const { history, graph } = get();
    if (!graph || history.length === 0) return;
    const last = history[history.length - 1]!;
    const next = applyPatch(graph, last.reverse.patch);
    set({
      graph: next,
      history: history.slice(0, -1),
      applyState: { phase: "idle" },
      pendingOp: null,
    });
  },
}));

async function fetchApplicableOps(): Promise<void> {
  const { selection, graph } = useStore.getState();
  if (!selection || !graph) {
    useStore.setState({ applicableOps: [] });
    return;
  }
  useStore.setState({ applicableLoading: true });
  try {
    const res = await fetch("/api/ops/applicable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph, target: selection }),
    });
    const data = await res.json();
    useStore.setState({
      applicableOps: Array.isArray(data.ops) ? data.ops : [],
      applicableLoading: false,
    });
  } catch {
    useStore.setState({ applicableLoading: false, applicableOps: [] });
  }
}

function paramsForApi(
  params: Record<string, unknown>,
  graph: Graph,
): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...params };
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.startsWith("graphref:")) {
      const nodeId = value.slice("graphref:".length);
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (node) {
        flat[key] = node.name;
        flat[`${key}File`] = node.file;
      }
    }
  }
  return flat;
}

function applyPatch(graph: Graph, patch: OpGraphPatch): Graph {
  const nodes: GraphNode[] = patch.removeNodes
    ? graph.nodes.filter((n) => !patch.removeNodes!.includes(n.id))
    : [...graph.nodes];
  if (patch.addNodes) nodes.push(...patch.addNodes);

  const edges: GraphEdge[] = patch.removeEdges
    ? graph.edges.filter((e) => !patch.removeEdges!.includes(e.id))
    : [...graph.edges];
  if (patch.addEdges) edges.push(...patch.addEdges);

  return { ...graph, nodes, edges };
}

function reversePatch(p: OpGraphPatch): OpGraphPatch {
  return {
    addNodes: p.removeNodes
      ? []
      : p.removeNodes,
    removeNodes: p.addNodes?.map((n) => n.id),
    addEdges: p.removeEdges ? [] : p.removeEdges,
    removeEdges: p.addEdges?.map((e) => e.id),
  };
}
