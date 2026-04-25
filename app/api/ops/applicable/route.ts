import { NextResponse } from "next/server";
import "@/ops";
import { applicableOps, describeOp } from "@/ops";
import type { Graph } from "@/extractor/types";
import type { GraphTarget } from "@/ops/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  graph: Graph;
  target: { kind: "node"; id: string } | { kind: "edge"; id: string };
};

export async function POST(req: Request) {
  try {
    const { graph, target } = (await req.json()) as Body;
    if (!graph || !target) {
      return NextResponse.json({ error: "missing graph or target" }, { status: 400 });
    }

    let resolved: GraphTarget | null = null;
    if (target.kind === "node") {
      const node = graph.nodes.find((n) => n.id === target.id);
      if (node) resolved = { kind: "node", node, graph };
    } else {
      const edge = graph.edges.find((e) => e.id === target.id);
      if (edge) resolved = { kind: "edge", edge, graph };
    }
    if (!resolved) {
      return NextResponse.json({ ops: [] });
    }
    const ops = applicableOps(resolved).map(describeOp);
    return NextResponse.json({ ops });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "applicable failed" },
      { status: 500 },
    );
  }
}
