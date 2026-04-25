import path from "node:path";
import fs from "node:fs";
import { extractGraph, type ExtractOptions } from "./deterministic";
import { runClusterPass } from "./cluster";
import { summarizeFiles } from "./summarize";
import { hashRepo, readCache, writeCache } from "./cache";
import { readRepoReadme, type RepoReadme } from "@/lib/readme";
import type { Graph } from "./types";

export type ExtractResult = {
  graph: Graph;
  clusterSource: "llm" | "fallback";
  clusterReason?: string;
  cached: boolean;
  readme: RepoReadme;
  summary?: string;
};

export async function extract(
  rootDir: string,
  opts?: { skipCache?: boolean; tsConfigFilePath?: string },
): Promise<ExtractResult> {
  const candidate =
    opts?.tsConfigFilePath ?? path.join(rootDir, "tsconfig.json");
  const tsConfigFilePath = fs.existsSync(candidate) ? candidate : undefined;

  const extractOpts: ExtractOptions = tsConfigFilePath
    ? { rootDir, tsConfigFilePath }
    : { rootDir, globs: [`${rootDir}/**/*.{ts,tsx}`] };
  const det = extractGraph(extractOpts);

  const readme = await readRepoReadme(rootDir);

  const files = Array.from(new Set(det.nodes.map((n) => n.file))).sort();
  const cacheKey = hashRepo(rootDir, files);

  if (!opts?.skipCache) {
    const cachedGraph = readCache<Graph>(rootDir, cacheKey);
    const cachedSummary = readCache<{ summary: string }>(rootDir, `${cacheKey}-summary`);
    if (cachedGraph) {
      return {
        graph: cachedGraph,
        clusterSource: cachedGraph.clusters.length > 0 ? "llm" : "fallback",
        cached: true,
        readme,
        summary: cachedSummary?.summary,
      };
    }
  }

  const summaries = summarizeFiles(det);
  const cluster = await runClusterPass(det, summaries, readme.excerpt);

  const refined = applyCluster(det, cluster.clusters, cluster.refinedKinds);
  writeCache(rootDir, cacheKey, refined);
  if (cluster.summary) {
    writeCache(rootDir, `${cacheKey}-summary`, { summary: cluster.summary });
  }

  return {
    graph: refined,
    clusterSource: cluster.source,
    clusterReason: cluster.reason,
    cached: false,
    readme,
    summary: cluster.summary,
  };
}

function applyCluster(
  base: Graph,
  clusters: Graph["clusters"],
  refinedKinds: Map<string, Graph["nodes"][number]["kind"]>,
): Graph {
  const clusterByNode = new Map<string, string>();
  for (const c of clusters) {
    for (const id of c.nodeIds) clusterByNode.set(id, c.id);
  }
  const nodes = base.nodes.map((n) => ({
    ...n,
    kind: refinedKinds.get(n.id) ?? n.kind,
    cluster: clusterByNode.get(n.id),
  }));
  return { ...base, nodes, clusters };
}
