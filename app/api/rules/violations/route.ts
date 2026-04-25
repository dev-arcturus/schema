import { NextResponse } from "next/server";
import { resolveRepo } from "@/lib/resolveRepo";
import { readRules } from "@/lib/rulesStore";
import { evaluateRules } from "@/lib/ruleEngine";
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
    const rules = readRules(resolved.rootDir);
    const violations = evaluateRules(body.graph, rules);
    return NextResponse.json({ rules, violations });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "violations failed" },
      { status: 500 },
    );
  }
}
