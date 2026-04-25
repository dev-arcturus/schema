import fs from "node:fs/promises";
import path from "node:path";

const CANDIDATES = ["README.md", "README.MD", "Readme.md", "readme.md", "README"];
const MAX_LINES = 200;

export type RepoReadme = {
  found: boolean;
  file?: string;
  excerpt?: string;
  full?: string;
};

export async function readRepoReadme(rootDir: string): Promise<RepoReadme> {
  for (const name of CANDIDATES) {
    const candidate = path.join(rootDir, name);
    try {
      const content = await fs.readFile(candidate, "utf8");
      const lines = content.split("\n");
      return {
        found: true,
        file: name,
        excerpt: lines.slice(0, MAX_LINES).join("\n"),
        full: content,
      };
    } catch {
      continue;
    }
  }
  return { found: false };
}
