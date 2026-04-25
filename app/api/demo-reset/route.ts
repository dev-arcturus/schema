import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const repoRoot = process.cwd();
    const fixtureDir = path.join(repoRoot, "fixtures/demo-app");

    // Restore all fixture source files to their committed state
    execSync("git checkout HEAD -- fixtures/demo-app/src/", {
      cwd: repoRoot,
      stdio: "pipe",
    });

    // Remove any generated files that didn't exist in the original
    const cacheDir = path.join(fixtureDir, "src/cache");
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
    const wrappersDir = path.join(fixtureDir, "src/wrappers");
    if (fs.existsSync(wrappersDir)) {
      fs.rmSync(wrappersDir, { recursive: true, force: true });
    }

    // Clear stale plan caches (keep graph/insights caches — they're keyed by content hash)
    const schemaCacheDir = path.join(fixtureDir, ".schema-cache");
    if (fs.existsSync(schemaCacheDir)) {
      for (const f of fs.readdirSync(schemaCacheDir)) {
        if (f.startsWith("plan-")) {
          fs.unlinkSync(path.join(schemaCacheDir, f));
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "reset failed" },
      { status: 500 },
    );
  }
}
