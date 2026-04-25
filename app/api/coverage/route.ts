import { NextResponse } from "next/server";
import { resolveRepo } from "@/lib/resolveRepo";
import { computeCoveredNodeIds, readTestCount } from "@/extractor/coverage";
import type { Graph } from "@/extractor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { repoPath?: string; graph: Graph };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.graph) {
      return NextResponse.json({ error: "graph required" }, { status: 400 });
    }
    const resolved = await resolveRepo({
      source: "local",
      value: body.repoPath ?? "fixtures/demo-app",
    });
    const ids = computeCoveredNodeIds(resolved.rootDir, body.graph);
    const testFileCount = readTestCount(resolved.rootDir);
    return NextResponse.json({
      coveredNodeIds: Array.from(ids),
      testFileCount,
      totalNodes: body.graph.nodes.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "coverage failed" },
      { status: 500 },
    );
  }
}
