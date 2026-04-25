import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { resolveRepo } from "@/lib/resolveRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  repoPath?: string;
  file: string;
  startLine?: number;
  endLine?: number;
  range?: { start: number; end: number };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const resolved = await resolveRepo({
      source: "local",
      value: body.repoPath ?? "fixtures/demo-app",
    });
    const abs = path.join(resolved.rootDir, body.file);
    const content = await fs.readFile(abs, "utf8");

    let snippet = content;
    let startLine = 1;
    let endLine = content.split("\n").length;

    if (body.range) {
      const before = content.slice(0, body.range.start);
      const startIdx = before.split("\n").length;
      const inside = content.slice(body.range.start, body.range.end);
      snippet = inside;
      startLine = startIdx;
      endLine = startIdx + inside.split("\n").length - 1;
    } else if (
      typeof body.startLine === "number" &&
      typeof body.endLine === "number"
    ) {
      const lines = content.split("\n");
      snippet = lines
        .slice(body.startLine - 1, body.endLine)
        .join("\n");
      startLine = body.startLine;
      endLine = body.endLine;
    }

    return NextResponse.json({
      file: body.file,
      snippet,
      startLine,
      endLine,
      totalLines: content.split("\n").length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "source read failed" },
      { status: 500 },
    );
  }
}
