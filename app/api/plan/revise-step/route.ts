import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { stepSchema, type Step } from "@/lib/planSchema";
import { OPS_REGISTRY_DESCRIPTION } from "@/lib/opsRegistryDescription";
import type { Graph } from "@/extractor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  repoPath?: string;
  graph: Graph;
  step: Step;
  error: string;
  explanation?: string;
  testOutput?: string;
  originalPrompt: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.step || !body?.graph || !body?.error) {
      return NextResponse.json(
        { error: "step, graph, and error required" },
        { status: 400 },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY missing" },
        { status: 400 },
      );
    }

    const compactNodes = body.graph.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      file: n.file,
      httpMethod: n.meta?.httpMethod,
      httpPath: n.meta?.httpPath,
    }));

    const systemPrompt = [
      "You are an architectural planner for Schema, a TypeScript architecture editor.",
      "A plan step has FAILED. Your job is to produce a REVISED version of the step that fixes the issue.",
      "The revised step must accomplish the same goal but with corrections based on the error.",
      "",
      OPS_REGISTRY_DESCRIPTION,
      "",
      "Rules:",
      "- Keep the same kind (op or freeform) if possible, but switch if the op clearly can't work.",
      "- targetId must be one of the provided node ids.",
      "- For freeform steps, output the FULL new content of each file.",
      "- Be conservative — fix only what's needed to make the step pass.",
    ].join("\n");

    const userPrompt = [
      `Original user intent: ${body.originalPrompt}`,
      "",
      "Failed step:",
      JSON.stringify(body.step, null, 2),
      "",
      `Error: ${body.error}`,
      body.explanation ? `Explanation: ${body.explanation}` : "",
      body.testOutput ? `Test output (last 40 lines):\n${body.testOutput}` : "",
      "",
      "Available graph nodes:",
      JSON.stringify(compactNodes, null, 2),
      "",
      "Produce a REVISED step that fixes the issue and accomplishes the same goal.",
    ].join("\n");

    const { object: revisedStep } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: stepSchema,
      temperature: 0.2,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 3000,
    });

    return NextResponse.json({ step: revisedStep });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "revision failed" },
      { status: 500 },
    );
  }
}
