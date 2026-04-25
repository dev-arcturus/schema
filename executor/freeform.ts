import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { Snapshot } from "./snapshot";

export type FreeformFile = { path: string; content: string };

export type FreeformResult = {
  filesChanged: string[];
  description: string;
};

/**
 * Agentic freeform executor.
 *
 * Key design: reads actual files from disk, finds dependent files (callers),
 * sends everything to Sonnet in one call so cross-file changes are coordinated.
 * Accepts an optional Snapshot to record ALL files before writing.
 */
export async function applyFreeform(
  repoPath: string,
  files: FreeformFile[],
  description: string,
  snapshot?: Snapshot,
): Promise<FreeformResult> {
  const targetPaths = files.map((f) => f.path);

  // Read actual content of every target file
  const fileContents = new Map<string, string | null>();
  for (const f of files) {
    try {
      fileContents.set(f.path, await fs.readFile(path.join(repoPath, f.path), "utf8"));
    } catch {
      fileContents.set(f.path, null); // new file
    }
  }

  // Find files that import from our targets (callers that need updating too)
  const dependentFiles = findDependentFiles(repoPath, targetPaths);
  for (const dep of dependentFiles) {
    if (!fileContents.has(dep)) {
      try {
        fileContents.set(dep, await fs.readFile(path.join(repoPath, dep), "utf8"));
      } catch { /* skip */ }
    }
  }

  // Snapshot ALL files we might touch BEFORE any writes
  if (snapshot) {
    await snapshot.recordMany(repoPath, [...fileContents.keys()]);
  }

  // No API key: fall back to planner-provided content (unreliable but best effort)
  if (!process.env.ANTHROPIC_API_KEY) {
    const changed: string[] = [];
    for (const f of files) {
      if (!f.content || f.content.trim().length === 0) continue;
      const abs = path.join(repoPath, f.path);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, f.content);
      changed.push(f.path);
    }
    return { filesChanged: changed, description };
  }

  // Generate coordinated changes via Sonnet
  const generated = await generateCoordinatedChanges(
    repoPath, fileContents, targetPaths, description,
  );

  // Validate and write
  for (const [filePath, content] of generated) {
    const errors = validateImports(repoPath, filePath, content);
    if (errors.length > 0) {
      throw new Error(`Bad imports in ${filePath}: ${errors.join("; ")}`);
    }
    const abs = path.join(repoPath, filePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }

  return { filesChanged: [...generated.keys()], description };
}

/**
 * Find .ts files under src/ that import from any of the given file paths.
 */
function findDependentFiles(repoPath: string, changedFiles: string[]): string[] {
  const srcDir = path.join(repoPath, "src");
  if (!fsSync.existsSync(srcDir)) return [];

  const dependents: string[] = [];
  const allFiles = collectTsFiles(srcDir, repoPath);

  for (const relPath of allFiles) {
    if (changedFiles.includes(relPath)) continue;
    try {
      const content = fsSync.readFileSync(path.join(repoPath, relPath), "utf8");
      const importRegex = /(?:import|from)\s+['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const spec = match[1]!;
        const resolved = path.join(path.dirname(relPath), spec).replace(/\\/g, "/");
        const resolvedNoExt = resolved.replace(/\.(js|ts)$/, "");
        for (const changed of changedFiles) {
          const changedNoExt = changed.replace(/\.ts$/, "");
          if (resolvedNoExt === changedNoExt) {
            dependents.push(relPath);
          }
        }
      }
    } catch { /* skip */ }
  }

  return [...new Set(dependents)];
}

function collectTsFiles(dir: string, repoPath: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fsSync.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        results.push(...collectTsFiles(full, repoPath));
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        results.push(path.relative(repoPath, full).replace(/\\/g, "/"));
      }
    }
  } catch { /* skip */ }
  return results;
}

/**
 * Single Sonnet call with ALL files so cross-file changes are coordinated.
 */
async function generateCoordinatedChanges(
  repoPath: string,
  fileContents: Map<string, string | null>,
  targetPaths: string[],
  description: string,
): Promise<Map<string, string>> {
  const { anthropic } = await import("@ai-sdk/anthropic");
  const { generateText } = await import("ai");

  let depsInfo = "";
  try {
    const pkg = JSON.parse(fsSync.readFileSync(path.join(repoPath, "package.json"), "utf8"));
    depsInfo = `Installed packages: ${Object.keys(pkg.dependencies ?? {}).join(", ")}`;
  } catch { /* ignore */ }

  const targetSet = new Set(targetPaths);
  const fileSection: string[] = [];
  for (const [fp, content] of fileContents) {
    const tag = targetSet.has(fp) ? "MODIFY" : "UPDATE IF CALLERS BREAK";
    if (content === null) {
      fileSection.push(`=== ${fp} [${tag} — NEW FILE] ===\n(does not exist yet)`);
    } else {
      fileSection.push(`=== ${fp} [${tag}] ===\n${content}`);
    }
  }

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    temperature: 0,
    maxTokens: 8000,
    system: [
      "You apply coordinated changes across TypeScript files. You receive current file contents and a change description.",
      "",
      "OUTPUT FORMAT — for each file you change, output exactly:",
      "=== filepath ===",
      "(complete file content)",
      "",
      "RULES:",
      "- Output EVERY file that needs changes — both the targets AND their callers/importers.",
      "- If you change a function signature, you MUST also output updated versions of files that call that function.",
      "- Do NOT output files that need zero changes.",
      "- Preserve import package names exactly (bcryptjs stays bcryptjs).",
      "- Preserve .js extensions in relative imports.",
      "- Do NOT add async/await to synchronous functions unless the change explicitly requires it.",
      "- Keep changes minimal.",
      "- Output complete file contents, not diffs.",
      "- No markdown. No code fences. No explanation. Just === filepath === blocks.",
      depsInfo,
    ].join("\n"),
    prompt: `Change: ${description}\n\nFiles:\n${fileSection.join("\n\n")}\n\nOutput modified files:`,
  });

  return parseOutput(text);
}

function parseOutput(text: string): Map<string, string> {
  const result = new Map<string, string>();
  // Split on === lines
  const parts = text.split(/^===\s*/m);

  for (const part of parts) {
    if (!part.trim()) continue;
    const nl = part.indexOf("\n");
    if (nl === -1) continue;

    // Extract filepath from header, stripping trailing === and [...] tags
    let header = part.slice(0, nl).trim();
    header = header.replace(/\s*===\s*$/, "");
    header = header.replace(/\s*\[.*\]\s*$/, "");
    header = header.replace(/\s*\(.*\)\s*$/, "");
    header = header.trim();

    let content = part.slice(nl + 1);
    // Strip code fences
    content = content.replace(/^```\w*\n?/, "").replace(/\n?```\s*$/, "");

    if (header && content.trim()) {
      result.set(header, content.trimEnd() + "\n");
    }
  }

  return result;
}

function validateImports(repoPath: string, filePath: string, content: string): string[] {
  const errors: string[] = [];
  const importRegex = /(?:import|from)\s+['"]([^./][^'"]*)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const pkg = match[1]!.split("/")[0]!;
    const fullPkg = match[1]!.startsWith("@") ? match[1]!.split("/").slice(0, 2).join("/") : pkg;
    if (fullPkg.startsWith("node:")) continue;
    const builtins = ["fs", "path", "crypto", "http", "https", "url", "util", "stream", "os", "child_process", "events", "assert", "buffer", "net", "tls", "zlib", "querystring"];
    if (builtins.includes(pkg)) continue;
    if (!fsSync.existsSync(path.join(repoPath, "node_modules", fullPkg))) {
      errors.push(`'${fullPkg}' not installed`);
    }
  }
  return errors;
}
