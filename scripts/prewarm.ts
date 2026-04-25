import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { extract } from "../extractor/extract";
import { writeCache } from "../extractor/cache";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const insightSchema = z.object({
  insights: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(4).max(80),
        rationale: z.string().min(8).max(240),
        severity: z.enum(["low", "medium", "high"]),
        targetIds: z.array(z.string()).max(20),
        suggestedPrompt: z.string().min(8).max(160),
      }),
    )
    .max(8),
});

async function main() {
  const repo = path.resolve(process.cwd(), "fixtures/demo-app");
  console.log("extracting from", repo);
  const result = await extract(repo, { skipCache: true });
  console.log(
    `graph: ${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges, source=${result.clusterSource}`,
  );
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("no api key — skipping insights prewarm");
    return;
  }

  const compact = result.graph.nodes.map((n) => `${n.id}:${n.kind}`).sort().join(",");
  const hash = crypto.createHash("sha256").update(compact).digest("hex").slice(0, 16);
  const compactNodes = result.graph.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    file: n.file,
    httpMethod: n.meta?.httpMethod,
    httpPath: n.meta?.httpPath,
  }));
  const compactEdges = result.graph.edges
    .filter((e) => e.relation !== "imports")
    .map((e) => ({ source: e.source, target: e.target, relation: e.relation }));

  console.log("calling Sonnet for insights…");
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

  writeCache(repo, `insights-${hash}`, { insights: object.insights });
  console.log(`wrote ${object.insights.length} insights to cache`);

  // Verify
  const files = fs.readdirSync(path.join(repo, ".schema-cache"));
  console.log("cache files:", files);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
