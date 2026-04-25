import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { Graph } from "@/extractor/types";
import { readCache, writeCache } from "@/extractor/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function graphHash(graph: Graph): string {
  const nodes = graph.nodes
    .map((n) => `${n.id}:${n.kind}`)
    .sort()
    .join(",");
  const edges = graph.edges
    .map((e) => `${e.source}->${e.target}:${e.relation}`)
    .sort()
    .join(",");
  return crypto.createHash("sha256").update(nodes + "|" + edges).digest("hex").slice(0, 16);
}

const insightSchema = z.object({
  insights: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z
          .string()
          .min(4)
          .max(80)
          .describe("Short, concrete headline (max 80 chars)."),
        rationale: z
          .string()
          .min(8)
          .max(240)
          .describe("Why this is worth fixing (max 240 chars)."),
        severity: z.enum(["low", "medium", "high"]),
        targetIds: z
          .array(z.string())
          .max(20)
          .describe("Node ids most relevant to the insight."),
        suggestedPrompt: z
          .string()
          .min(8)
          .max(160)
          .describe(
            "A natural-language prompt the user could feed back to Schema's command bar to fix it.",
          ),
      }),
    )
    .max(8),
});

type Body = { graph: Graph };

export async function POST(req: Request) {
  try {
    const { graph } = (await req.json()) as Body;
    if (!graph) {
      return NextResponse.json({ error: "graph required" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ insights: deterministicInsights(graph) });
    }

    const cacheKey = `insights-${graphHash(graph)}`;
    const cached = readCache<{ insights: z.infer<typeof insightSchema>["insights"] }>(
      graph.rootDir,
      cacheKey,
    );
    if (cached?.insights) {
      return NextResponse.json({ insights: cached.insights });
    }

    const llm = await callLLM(graph);
    writeCache(graph.rootDir, cacheKey, { insights: llm.insights });
    return NextResponse.json({ insights: llm.insights });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "insights failed" },
      { status: 500 },
    );
  }
}

async function callLLM(graph: Graph) {
  const compactNodes = graph.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    file: n.file,
    httpMethod: n.meta?.httpMethod,
    httpPath: n.meta?.httpPath,
  }));
  const compactEdges = graph.edges
    .filter((e) => e.relation !== "imports")
    .map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.relation,
    }));

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: insightSchema,
    temperature: 0.2,
    maxTokens: 2500,
    system: [
      "You are an experienced software architect doing a quick code review on an architecture graph.",
      "Surface up to 8 ARCHITECTURAL smells worth a one-click fix from a registry of ops",
      "(addMiddleware, addCaching, wrapTransformation, extractModule).",
      "Examples of good insights:",
      "- Asymmetric middleware application (some routes auth-protected, others not).",
      "- Hot service called from many places without caching.",
      "- A function in the wrong file (would benefit from extractModule).",
      "- High-fanin or high-fanout nodes that look like coupling hubs.",
      "Skip generic advice. Each insight should be repairable by a small plan.",
      "Prompts should be terse imperative sentences.",
    ].join("\n"),
    prompt: [
      "Graph nodes:",
      JSON.stringify(compactNodes, null, 2),
      "",
      "Architectural edges:",
      JSON.stringify(compactEdges, null, 2),
    ].join("\n"),
  });
  return object;
}

function deterministicInsights(graph: Graph) {
  // Cheap fallback: detect asymmetric middleware on routes.
  const out: z.infer<typeof insightSchema>["insights"] = [];
  const routes = graph.nodes.filter(
    (n) => n.kind === "route_handler" && n.meta?.httpMethod,
  );
  const routesWithMw = new Set<string>();
  for (const e of graph.edges) {
    if (e.relation === "applies_middleware") routesWithMw.add(e.source);
  }
  const unprotected = routes.filter((r) => !routesWithMw.has(r.id));
  if (unprotected.length > 0 && routesWithMw.size > 0) {
    out.push({
      id: "insight:auth-asymmetry",
      title: `${unprotected.length} route(s) have no middleware while siblings do`,
      rationale:
        "Inconsistent middleware application is a common architectural bug — usually an oversight when adding new routes.",
      severity: "high",
      targetIds: unprotected.map((r) => r.id),
      suggestedPrompt: "Apply requireAuth middleware to every route that doesn't already have it.",
    });
  }
  return out;
}
