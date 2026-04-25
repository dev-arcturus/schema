import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { Graph, GraphCluster, NodeKind } from "./types";

const KIND_VALUES = [
  "route_handler",
  "service",
  "data_access",
  "middleware",
  "model",
  "external",
  "utility",
] as const;

const clusterResponseSchema = z.object({
  summary: z
    .string()
    .min(8)
    .max(280)
    .describe(
      "Two crisp sentences describing what this codebase is and how it's organized.",
    ),
  clusters: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        nodeIds: z.array(z.string()).min(1),
      }),
    )
    .min(1)
    .max(8),
  nodeKinds: z.record(z.string(), z.enum(KIND_VALUES)),
});

export type ClusterResult = {
  summary: string;
  clusters: GraphCluster[];
  refinedKinds: Map<string, NodeKind>;
  source: "llm" | "fallback";
  reason?: string;
};

export async function runClusterPass(
  graph: Graph,
  fileSummaries: Map<string, string>,
  readmeExcerpt?: string,
): Promise<ClusterResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackClusters(graph, "no_api_key");
  }

  try {
    return await callLLM(graph, fileSummaries, readmeExcerpt);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "llm_error";
    return fallbackClusters(graph, reason);
  }
}

async function callLLM(
  graph: Graph,
  fileSummaries: Map<string, string>,
  readmeExcerpt: string | undefined,
): Promise<ClusterResult> {
  const prompt = buildPrompt(graph, fileSummaries, readmeExcerpt);

  const attempt = async (extra?: string) => {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: clusterResponseSchema,
      temperature: 0.1,
      prompt: extra ? `${prompt}\n\nValidation feedback:\n${extra}` : prompt,
    });
    return object;
  };

  let raw: z.infer<typeof clusterResponseSchema>;
  try {
    raw = await attempt();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "validation_failed";
    raw = await attempt(msg);
  }

  const validNodeIds = new Set(graph.nodes.map((n) => n.id));
  const clusters: GraphCluster[] = raw.clusters.map((c) => ({
    id: c.id,
    name: c.name,
    nodeIds: c.nodeIds.filter((id) => validNodeIds.has(id)),
  }));

  const assigned = new Set<string>();
  for (const c of clusters) for (const id of c.nodeIds) assigned.add(id);
  const orphaned = graph.nodes.filter((n) => !assigned.has(n.id));
  if (orphaned.length > 0) {
    clusters.push({
      id: "cluster:misc",
      name: "Misc",
      nodeIds: orphaned.map((n) => n.id),
    });
  }

  const refinedKinds = new Map<string, NodeKind>();
  for (const [id, kind] of Object.entries(raw.nodeKinds)) {
    if (validNodeIds.has(id)) refinedKinds.set(id, kind);
  }

  return { summary: raw.summary, clusters, refinedKinds, source: "llm" };
}

function buildPrompt(
  graph: Graph,
  fileSummaries: Map<string, string>,
  readmeExcerpt?: string,
): string {
  const nodes = graph.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    file: n.file,
    httpMethod: n.meta?.httpMethod,
    httpPath: n.meta?.httpPath,
  }));

  const summaries = Array.from(fileSummaries.entries()).map(
    ([file, summary]) => ({ file, summary }),
  );

  const lines = [
    "You are an expert software architect inspecting a TypeScript codebase.",
    "Output JSON with three fields:",
    "1. summary: TWO sentences describing what this codebase is and how it's organized. Keep it concrete (mention the framework if obvious).",
    "2. clusters: 2-6 logical architectural components. Each cluster represents a layer or feature group (e.g. 'Auth', 'Todos', 'Database').",
    "   Every node must belong to exactly one cluster. Prefer cluster names that match the README's vocabulary.",
    "3. nodeKinds: refine each node's kind from this enum:",
    "   route_handler | service | data_access | middleware | model | external | utility",
  ];

  if (readmeExcerpt && readmeExcerpt.trim().length > 0) {
    lines.push(
      "",
      "README excerpt (use this to pick names that match the project's domain language):",
      readmeExcerpt.slice(0, 4000),
    );
  }

  lines.push(
    "",
    "Nodes:",
    JSON.stringify(nodes, null, 2),
    "",
    "File summaries (top of each file):",
    JSON.stringify(summaries, null, 2),
    "",
    "Output JSON matching the schema exactly. Use stable kebab-case ids for clusters (e.g. 'cluster:auth').",
  );

  return lines.join("\n");
}

function fallbackClusters(graph: Graph, reason: string): ClusterResult {
  const groups = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const dir = directoryKey(node.file);
    const list = groups.get(dir) ?? [];
    list.push(node.id);
    groups.set(dir, list);
  }
  const clusters: GraphCluster[] = [];
  for (const [dir, nodeIds] of groups) {
    clusters.push({
      id: `cluster:${dir}`,
      name: prettyName(dir),
      nodeIds,
    });
  }
  return {
    summary: `${graph.nodes.length} nodes across ${clusters.length} top-level directories.`,
    clusters,
    refinedKinds: new Map(),
    source: "fallback",
    reason,
  };
}

function directoryKey(file: string): string {
  const parts = file.split("/");
  if (parts[0] === "src" && parts.length > 1) return parts[1] ?? "src";
  return parts[0] ?? "root";
}

function prettyName(dir: string): string {
  switch (dir) {
    case "routes":
      return "Routes";
    case "services":
      return "Services";
    case "repos":
      return "Data";
    case "db":
      return "Database";
    case "middleware":
      return "Middleware";
    case "models":
      return "Models";
    default:
      return dir.charAt(0).toUpperCase() + dir.slice(1);
  }
}
