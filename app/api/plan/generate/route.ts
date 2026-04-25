import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, streamObject } from "ai";
import { planSchema, type Plan } from "@/lib/planSchema";
import { OPS_REGISTRY_DESCRIPTION } from "@/lib/opsRegistryDescription";
import { readCache, writeCache } from "@/extractor/cache";
import { resolveRepo } from "@/lib/resolveRepo";
import type { Graph } from "@/extractor/types";

function planHash(prompt: string, graph: Graph): string {
  const compact = graph.nodes
    .map((n) => `${n.id}:${n.kind}`)
    .sort()
    .join(",");
  return crypto
    .createHash("sha256")
    .update(prompt + "|" + compact)
    .digest("hex")
    .slice(0, 16);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Turn = { prompt: string; intent?: string; appliedSteps?: string[] };

type Body = {
  prompt: string;
  graph: Graph;
  history?: Turn[];
  stream?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.prompt || !body?.graph) {
      return NextResponse.json(
        { error: "prompt and graph required" },
        { status: 400 },
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY missing — the command bar requires Sonnet to plan steps.",
        },
        { status: 400 },
      );
    }

    // Cache hit short-circuit (no streaming, no Anthropic round-trip)
    const cacheKey = `plan-${planHash(body.prompt, body.graph)}`;
    const repoPathInput = body.graph.rootDir;
    let cachedPlan: { plan: Plan } | null = null;
    if (repoPathInput) {
      try {
        const resolved = await resolveRepo({ source: "local", value: repoPathInput });
        cachedPlan = readCache<{ plan: Plan }>(resolved.rootDir, cacheKey);
      } catch {
        cachedPlan = null;
      }
    }
    if (cachedPlan?.plan) {
      if (body.stream) {
        return cachedStreamingResponse(cachedPlan.plan);
      }
      return NextResponse.json({ plan: cachedPlan.plan });
    }

    if (body.stream) {
      return streamingResponse(body, cacheKey);
    }

    const plan = await generatePlan(body.prompt, body.graph, body.history ?? []);
    const sanitized = sanitizePlan(plan, body.graph);
    if (repoPathInput) {
      try {
        const resolved = await resolveRepo({ source: "local", value: repoPathInput });
        writeCache(resolved.rootDir, cacheKey, { plan: sanitized });
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ plan: sanitized });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "plan generation failed" },
      { status: 500 },
    );
  }
}

function streamingResponse(body: Body, cacheKey: string): Response {
  const { systemPrompt, userPrompt } = buildPrompts(
    body.prompt,
    body.graph,
    body.history ?? [],
  );

  const result = streamObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: planSchema,
    temperature: 0.1,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
  });

  const enc = new TextEncoder();
  const repoPath = body.graph.rootDir;
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const partial of result.partialObjectStream) {
          controller.enqueue(
            enc.encode(JSON.stringify({ type: "partial", plan: partial }) + "\n"),
          );
        }
        const final = await result.object;
        const sanitized = sanitizePlan(final, body.graph);
        controller.enqueue(
          enc.encode(JSON.stringify({ type: "final", plan: sanitized }) + "\n"),
        );
        if (repoPath) {
          try {
            const resolved = await resolveRepo({ source: "local", value: repoPath });
            writeCache(resolved.rootDir, cacheKey, { plan: sanitized });
          } catch {
            // ignore
          }
        }
      } catch (err) {
        controller.enqueue(
          enc.encode(
            JSON.stringify({
              type: "error",
              error: err instanceof Error ? err.message : "stream failed",
            }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}

function cachedStreamingResponse(plan: Plan): Response {
  const enc = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(
        enc.encode(JSON.stringify({ type: "partial", plan }) + "\n"),
      );
      controller.enqueue(
        enc.encode(JSON.stringify({ type: "final", plan }) + "\n"),
      );
      controller.close();
    },
  });
  return new Response(readable, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}

async function generatePlan(
  prompt: string,
  graph: Graph,
  history: Turn[],
): Promise<Plan> {
  const { systemPrompt, userPrompt } = buildPrompts(prompt, graph, history);
  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: planSchema,
    temperature: 0.1,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
  });
  return object;
}

function buildPrompts(prompt: string, graph: Graph, history: Turn[]) {
  const compactNodes = graph.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    kind: n.kind,
    file: n.file,
    httpMethod: n.meta?.httpMethod,
    httpPath: n.meta?.httpPath,
    cluster: n.cluster,
  }));

  const compactEdges = graph.edges
    .filter((e) => e.relation !== "imports")
    .map((e) => ({
      relation: e.relation,
      source: e.source,
      target: e.target,
    }));

  const compactClusters = graph.clusters.map((c) => ({
    id: c.id,
    name: c.name,
    nodeIds: c.nodeIds,
  }));

  const historyText =
    history.length > 0
      ? "\nPrior turns (newest last):\n" +
        history
          .slice(-3)
          .map(
            (t, i) =>
              `[${i + 1}] user: ${t.prompt}\n    intent: ${t.intent ?? "?"}\n    applied: ${(t.appliedSteps ?? []).join(", ") || "(nothing)"}`,
          )
          .join("\n")
      : "";

  const systemPrompt = [
    "You are an architectural planner editing a TypeScript codebase through Schema.",
    "You translate the user's intent into a Plan: an ordered list of steps that the executor can run.",
    "Each step is either a registered Op call (STRONGLY preferred) or a freeform edit (for things ops can't do).",
    "",
    OPS_REGISTRY_DESCRIPTION,
    "",
    "PLANNING RULES:",
    "",
    "1. PREFER OPS over freeform. Use ops whenever possible — they are tested and reliable.",
    "",
    "2. FREEFORM STEPS: The executor reads actual files from disk, finds all callers/dependents, and uses an LLM to apply coordinated changes. For freeform steps:",
    "   - Write a CLEAR, SPECIFIC description of what to change.",
    "   - List ALL file paths that need to change in the SAME step. Do NOT split a refactor across multiple freeform steps — put all related files in one step so the executor can coordinate them.",
    "   - File content can be empty string — the executor generates content from real files.",
    "   - The executor automatically finds and updates callers/importers of changed files.",
    "   - NEVER change import package names (e.g. bcryptjs → bcrypt).",
    "   - NEVER invent helper functions (like makeUserRepo) without including the file that defines them.",
    "",
    "3. targetId must be one of the provided node ids VERBATIM.",
    "4. params shapes must match the op exactly. No placeholder values.",
    "5. Order steps so each one is testable independently.",
    "6. Keep plans small — prefer 1-4 steps.",
  ].join("\n");

  const userPrompt = [
    `User intent: ${prompt}`,
    historyText,
    "",
    "Graph nodes:",
    JSON.stringify(compactNodes, null, 2),
    "",
    "Architectural edges (no imports):",
    JSON.stringify(compactEdges, null, 2),
    "",
    "Clusters:",
    JSON.stringify(compactClusters, null, 2),
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function sanitizePlan(plan: Plan, graph: Graph): Plan {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const sanitized: Plan["steps"] = [];

  for (const step of plan.steps) {
    if (step.kind === "op") {
      if (!nodeIds.has(step.targetId)) {
        sanitized.push({
          ...step,
          rationale:
            step.rationale +
            ` (warning: targetId not found in graph; will fail at exec time)`,
          risk: "high",
        });
      } else {
        sanitized.push(step);
      }
    } else {
      // freeform — light validation
      const cleanFiles = step.files.filter((f) => f.path && !f.path.includes(".."));
      if (cleanFiles.length === 0) continue;
      sanitized.push({ ...step, files: cleanFiles });
    }
  }

  return { ...plan, steps: sanitized };
}
