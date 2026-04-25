import { NextResponse } from "next/server";
import { execute } from "@/executor/execute";
import "@/ops";
import { resolveRepoPath } from "@/lib/repoPath";
import { explainFailure } from "@/lib/explainFailure";
import type { Graph } from "@/extractor/types";
import type { GraphTarget } from "@/ops/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  repoPath?: string;
  graph: Graph;
  opName: string;
  target: { kind: "node"; id: string } | { kind: "edge"; id: string };
  params: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const repoPath = resolveRepoPath(body.repoPath);
    const graph = body.graph;

    let target: GraphTarget | null = null;
    if (body.target.kind === "node") {
      const node = graph.nodes.find((n) => n.id === body.target.id);
      if (node) target = { kind: "node", node, graph: { ...graph, rootDir: repoPath } };
    } else {
      const edge = graph.edges.find((e) => e.id === body.target.id);
      if (edge) target = { kind: "edge", edge, graph: { ...graph, rootDir: repoPath } };
    }
    if (!target) {
      return NextResponse.json({ ok: false, error: "target not found" }, { status: 400 });
    }

    const result = await execute({
      repoPath,
      graph: { ...graph, rootDir: repoPath },
      opName: body.opName,
      target,
      params: body.params,
    });

    if (!result.ok) {
      const explanation = await explainFailure(result.error, result.testRun?.output);
      return NextResponse.json({ ...result, explanation });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "apply failed",
        diff: "",
        filesChanged: [],
        description: "",
      },
      { status: 500 },
    );
  }
}
