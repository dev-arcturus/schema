import { NextResponse } from "next/server";
import { extract } from "@/extractor/extract";
import { resolveRepo, type RepoSource } from "@/lib/resolveRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  source?: "local" | "github";
  value?: string;
  token?: string;
  // legacy
  repoPath?: string;
  skipCache?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const skipCache = Boolean(body.skipCache);

    const input: RepoSource =
      body.source === "github"
        ? { source: "github", value: body.value ?? "", token: body.token }
        : { source: "local", value: body.value ?? body.repoPath ?? "fixtures/demo-app" };

    const resolved = await resolveRepo(input);
    const result = await extract(resolved.rootDir, { skipCache });

    return NextResponse.json({
      ...result,
      repoPath: resolved.rootDir,
      origin: resolved.origin,
      cloned: resolved.cloned,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "extract failed" },
      { status: 500 },
    );
  }
}
