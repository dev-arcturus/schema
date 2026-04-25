import dagre from "@dagrejs/dagre";
import type { Graph } from "@/extractor/types";

const NODE_W = 220;
const NODE_H = 60;
const CLUSTER_PADDING = 28;

export type Positioned = {
  id: string;
  x: number;
  y: number;
};

export type ClusterRegion = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutResult = {
  positions: Map<string, Positioned>;
  clusters: ClusterRegion[];
};

export function layoutGraph(graph: Graph): LayoutResult {
  const positions = new Map<string, Positioned>();
  if (!graph.nodes.length) return { positions, clusters: [] };

  const g = new dagre.graphlib.Graph({ directed: true });
  g.setGraph({
    rankdir: "LR",
    ranksep: 90,
    nodesep: 24,
    edgesep: 12,
    marginx: 32,
    marginy: 32,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }

  const known = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (edge.relation === "imports") continue;
    if (edge.relation === "applies_middleware") continue;
    if (!known.has(edge.source) || !known.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    g.setEdge(edge.source, edge.target);
  }

  try {
    dagre.layout(g);
  } catch {
    return fallbackGrid(graph);
  }

  for (const node of graph.nodes) {
    const placed = g.node(node.id);
    if (!placed) continue;
    positions.set(node.id, {
      id: node.id,
      x: placed.x - NODE_W / 2,
      y: placed.y - NODE_H / 2,
    });
  }

  const clusters = computeClusterRegions(graph, positions);
  return { positions, clusters };
}

function computeClusterRegions(
  graph: Graph,
  positions: Map<string, Positioned>,
): ClusterRegion[] {
  if (graph.clusters.length === 0) return [];
  const regions: ClusterRegion[] = [];
  for (const cluster of graph.clusters) {
    const pts = cluster.nodeIds
      .map((id) => positions.get(id))
      .filter((p): p is Positioned => Boolean(p));
    if (pts.length < 2) continue;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    regions.push({
      id: cluster.id,
      name: cluster.name,
      x: minX - CLUSTER_PADDING,
      y: minY - CLUSTER_PADDING,
      width: maxX - minX + NODE_W + 2 * CLUSTER_PADDING,
      height: maxY - minY + NODE_H + 2 * CLUSTER_PADDING,
    });
  }
  return regions;
}

function fallbackGrid(graph: Graph): LayoutResult {
  const positions = new Map<string, Positioned>();
  graph.nodes.forEach((n, i) => {
    positions.set(n.id, {
      id: n.id,
      x: (i % 6) * (NODE_W + 32),
      y: Math.floor(i / 6) * (NODE_H + 32),
    });
  });
  return { positions, clusters: [] };
}
