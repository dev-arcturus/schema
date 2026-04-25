"use client";

import { create } from "zustand";
import type { Graph, GraphEdge, GraphNode, NodeKind } from "@/extractor/types";
import type { OpDescriptor, OpGraphPatch } from "@/ops/types";
import type { Plan, Step, StepResult } from "@/lib/planSchema";

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
  | { phase: "thinking"; prompt: string }
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

  visibleKinds: Partial<Record<NodeKind, boolean>>;
  toggleKind: (kind: NodeKind) => void;

  planState: PlanState;
  chatHistory: ConversationTurn[];
  insights: Insight[];
  insightsLoading: boolean;
  submitPrompt: (prompt: string) => Promise<void>;
  approvePlan: () => Promise<void>;
  cancelPlan: () => void;
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
  insights: [],
  insightsLoading: false,

  async submitPrompt(prompt) {
    const { graph, chatHistory } = get();
    if (!graph || !prompt.trim()) return;
    set({ planState: { phase: "thinking", prompt } });
    try {
      const res = await fetch("/api/plan/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, graph, history: chatHistory.slice(-3) }),
      });
      const data = await res.json();
      if (!res.ok || !data.plan) {
        throw new Error(data.error ?? "plan generation failed");
      }
      const plan: Plan = data.plan;
      set({ planState: { phase: "preview", prompt, plan } });
    } catch (err) {
      set({
        planState: { phase: "idle" },
      });
      console.error("submitPrompt failed:", err);
      // Surface error inline via applyState (reuse existing failure UX)
      set((s) => ({
        applyState: {
          phase: "error",
          opName: "plan",
          diff: "",
          error: err instanceof Error ? err.message : "plan failed",
          filesChanged: [],
        },
      }));
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
        const res = await fetch("/api/plan/execute-step", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            repoPath: get().resolvedRepoPath,
            graph: workingGraph,
            step,
            intent: prompt,
          }),
        });
        const data = await res.json();
        const cur2 = get().planState;
        if (cur2.phase !== "running") return;
        const r2 = [...cur2.results];
        if (data.ok) {
          r2[i] = {
            status: "success",
            description: data.description ?? step.description,
            diff: data.diff,
            filesChanged: data.filesChanged,
            testOutput: data.testOutput,
            intentCheck: data.intentCheck,
          };
          if (data.graphPatch) {
            workingGraph = applyPatch(workingGraph, data.graphPatch);
            set({ graph: workingGraph });
          }
          appliedDescriptions.push(step.description);
        } else {
          ok = false;
          r2[i] = {
            status: "failure",
            description: step.description,
            diff: data.diff ?? "",
            filesChanged: data.filesChanged ?? [],
            testOutput: data.testOutput,
            error: data.error,
            explanation: data.explanation,
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
    set({
      planState: {
        phase: "done",
        prompt,
        plan,
        results: final.results,
        ok,
      },
      chatHistory: [
        ...get().chatHistory,
        { prompt, intent: plan.intent, appliedSteps: appliedDescriptions },
      ],
    });
  },

  cancelPlan() {
    set({ planState: { phase: "idle" } });
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
      });
      void get().loadInsights();
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
    });
    void fetchApplicableOps();
  },

  selectEdge: (id) => {
    set({
      selection: { kind: "edge", id },
      pendingOp: null,
      applyState: { phase: "idle" },
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
