import type { Graph, GraphNode } from "@/extractor/types";

const COL_WIDTH = 280;
const ROW_GAP = 88;
const ROUTE_X = 0;
const MIDDLEWARE_X = -340;
const SERVICE_X = COL_WIDTH;
const DATA_X = COL_WIDTH * 2;
const MISC_X = COL_WIDTH * 3;

export type Positioned = {
  id: string;
  x: number;
  y: number;
};

export function layoutGraph(graph: Graph): Map<string, Positioned> {
  const out = new Map<string, Positioned>();
  if (!graph.nodes.length) return out;

  const groups: Record<string, GraphNode[]> = {
    route: [],
    middleware: [],
    service: [],
    data: [],
    misc: [],
  };

  for (const node of graph.nodes) {
    if (node.kind === "route_handler" && node.meta?.httpMethod) {
      groups.route!.push(node);
    } else if (node.kind === "middleware") {
      groups.middleware!.push(node);
    } else if (node.kind === "service") {
      groups.service!.push(node);
    } else if (node.kind === "data_access") {
      groups.data!.push(node);
    } else {
      groups.misc!.push(node);
    }
  }

  // sort each group: routes by path, others by file then name
  groups.route!.sort((a, b) => {
    const ap = `${a.meta?.httpPath ?? a.name}#${a.meta?.httpMethod ?? ""}`;
    const bp = `${b.meta?.httpPath ?? b.name}#${b.meta?.httpMethod ?? ""}`;
    return ap.localeCompare(bp);
  });
  for (const k of ["middleware", "service", "data", "misc"] as const) {
    groups[k]!.sort((a, b) => `${a.file}::${a.name}`.localeCompare(`${b.file}::${b.name}`));
  }

  place(groups.route!, ROUTE_X, out);
  place(groups.middleware!, MIDDLEWARE_X, out);
  place(groups.service!, SERVICE_X, out);
  place(groups.data!, DATA_X, out);
  place(groups.misc!, MISC_X, out);

  return out;
}

function place(nodes: GraphNode[], x: number, out: Map<string, Positioned>): void {
  nodes.forEach((node, i) => {
    out.set(node.id, { id: node.id, x, y: i * ROW_GAP });
  });
}
