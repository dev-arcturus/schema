import { NextResponse } from "next/server";
import { resolveRepo } from "@/lib/resolveRepo";
import { readRules } from "@/lib/rulesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { repoPath?: string };
    const resolved = await resolveRepo({
      source: "local",
      value: body.repoPath ?? "fixtures/demo-app",
    });
    const rules = readRules(resolved.rootDir);
    return NextResponse.json({ rules });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "rules read failed" },
      { status: 500 },
    );
  }
}
