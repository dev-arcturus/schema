import path from "node:path";
import fs from "node:fs/promises";
import { Project } from "ts-morph";

export type FreeformFile = { path: string; content: string };

export type FreeformResult = {
  filesChanged: string[];
  description: string;
};

export async function applyFreeform(
  repoPath: string,
  files: FreeformFile[],
  description: string,
): Promise<FreeformResult> {
  // Validate every TypeScript file parses before we write anything.
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  for (const f of files) {
    if (!/\.(ts|tsx)$/.test(f.path)) continue;
    if (f.content.trim().length === 0) continue;
    try {
      project.createSourceFile(`__freeform__/${f.path}`, f.content, {
        overwrite: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "parse failed";
      throw new Error(`freeform parse failed for ${f.path}: ${msg}`);
    }
  }

  const changed: string[] = [];
  for (const f of files) {
    const abs = path.join(repoPath, f.path);
    if (f.content.trim().length === 0) {
      try {
        await fs.rm(abs, { force: true });
        changed.push(f.path);
      } catch {
        /* ignore */
      }
      continue;
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content);
    changed.push(f.path);
  }

  return { filesChanged: changed, description };
}
