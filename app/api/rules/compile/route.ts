import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { predicateSchema } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const compiledSchema = z.object({
  title: z.string().min(2).max(80),
  predicate: predicateSchema,
  notes: z.string().optional(),
});

type Body = { prompt: string };

const SYSTEM = `You compile a single architectural constraint, written in plain English by an engineer, into a structured Predicate that Schema's rule engine can evaluate against a TypeScript codebase graph.

Predicate types:
- no_edge: source nodes must not have an edge of <relation> to target nodes. Example use: "services don't call data layer directly" -> source.kind=service, target.kind=data_access, relation=calls.
- must_have_edge: every source node must have an edge of <relation> to ANY target. Example use: "every protected route must apply requireAuth" -> source.kind=route_handler & httpMethod set, target.name=requireAuth, relation=applies_middleware.
- must_not_exist: no node may match the matcher. Example use: "no console.log calls" -> matcher.nameContains=console.log (rare).

NodeMatcher fields (combine with AND):
  kind, name (exact), nameContains, file (exact), fileContains, httpMethod, httpPathContains, cluster.

Output a concise title (under 80 chars) and the matching predicate. Use the simplest matcher that covers the rule.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.prompt?.trim()) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY missing — rule compilation requires Sonnet." },
        { status: 400 },
      );
    }

    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-6"),
      schema: compiledSchema,
      temperature: 0.1,
      maxTokens: 800,
      system: SYSTEM,
      prompt: `Rule (English): ${body.prompt.trim()}`,
    });

    return NextResponse.json({
      title: object.title,
      predicate: object.predicate,
      notes: object.notes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "compile failed" },
      { status: 500 },
    );
  }
}
