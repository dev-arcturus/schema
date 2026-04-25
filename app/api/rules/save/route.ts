import { NextResponse } from "next/server";
import { resolveRepo } from "@/lib/resolveRepo";
import { addRule, removeRule, setRuleEnabled } from "@/lib/rulesStore";
import { ruleSchema } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body =
  | { action: "add"; repoPath?: string; rule: unknown }
  | { action: "remove"; repoPath?: string; id: string }
  | { action: "toggle"; repoPath?: string; id: string; enabled: boolean };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const resolved = await resolveRepo({
      source: "local",
      value: body.repoPath ?? "fixtures/demo-app",
    });
    if (body.action === "add") {
      const parsed = ruleSchema.safeParse(body.rule);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid rule: " + parsed.error.issues.map((i) => i.message).join("; ") },
          { status: 400 },
        );
      }
      addRule(resolved.rootDir, parsed.data);
    } else if (body.action === "remove") {
      removeRule(resolved.rootDir, body.id);
    } else if (body.action === "toggle") {
      setRuleEnabled(resolved.rootDir, body.id, body.enabled);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}
