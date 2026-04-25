import fs from "node:fs/promises";
import path from "node:path";
import { createTwoFilesPatch } from "diff";
import type { Snapshot } from "./snapshot";

export async function computeDiff(
  snapshot: Snapshot,
  rootDir: string,
): Promise<string> {
  const parts: string[] = [];
  for (const backup of snapshot.list()) {
    let after: string;
    try {
      after = await fs.readFile(backup.absPath, "utf8");
    } catch {
      after = "";
    }
    const before = backup.original ?? "";
    if (before === after) continue;
    const rel = path.relative(rootDir, backup.absPath) || backup.absPath;
    const label = backup.original === null ? `(new) ${rel}` : rel;
    const patch = createTwoFilesPatch(
      backup.original === null ? "/dev/null" : `a/${rel}`,
      `b/${rel}`,
      before,
      after,
      label,
      label,
    );
    parts.push(patch);
  }
  return parts.join("\n");
}
