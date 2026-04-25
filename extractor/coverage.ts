import path from "node:path";
import fs from "node:fs";
import { Project } from "ts-morph";
import type { Graph } from "./types";

/**
 * Static "tested" detection. A node is considered covered if a test file
 * (test/**\/*.test.ts, *.spec.ts) reaches it via a chain of imports + call
 * edges. We don't run the tests — this is reachability-based and matches
 * roughly what a coverage report would show without the slower runtime.
 */
export function computeCoveredNodeIds(
  rootDir: string,
  graph: Graph,
): Set<string> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const testGlobs = [
    `${rootDir}/test/**/*.test.ts`,
    `${rootDir}/test/**/*.spec.ts`,
    `${rootDir}/tests/**/*.test.ts`,
    `${rootDir}/tests/**/*.spec.ts`,
    `${rootDir}/src/**/*.test.ts`,
    `${rootDir}/src/**/*.spec.ts`,
    `${rootDir}/test/**/*.test.tsx`,
    `${rootDir}/tests/**/*.test.tsx`,
  ];
  for (const g of testGlobs) {
    try {
      project.addSourceFilesAtPaths(g);
    } catch {
      // continue
    }
  }
  const testFiles = project
    .getSourceFiles()
    .filter((sf) => /\.(test|spec)\.tsx?$/.test(sf.getFilePath()));

  if (testFiles.length === 0) return new Set();

  // Step 1: starting from test files, walk imports recursively (BFS) using
  // the filesystem so we don't depend on ts-morph type resolution. Each
  // file we reach gets added to reachableFiles; nodes in those files are
  // directly tested.
  const reachableFiles = new Set<string>();
  const queue: string[] = testFiles.map((sf) => sf.getFilePath());
  while (queue.length) {
    const file = queue.pop()!;
    if (reachableFiles.has(file)) continue;
    reachableFiles.add(file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const importRe = /(?:from|import)\s+["']([^"']+)["']/g;
    const dir = path.dirname(file);
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(content))) {
      const spec = match[1]!;
      if (!spec.startsWith(".")) continue;
      const noExt = spec.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
      const candidates = [
        path.resolve(dir, noExt + ".ts"),
        path.resolve(dir, noExt + ".tsx"),
        path.resolve(dir, noExt + ".js"),
        path.resolve(dir, noExt, "index.ts"),
        path.resolve(dir, noExt, "index.tsx"),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c) && !reachableFiles.has(c)) queue.push(c);
      }
    }
  }

  // Mark nodes whose file is reachable.
  const directlyTested = new Set<string>();
  for (const node of graph.nodes) {
    const abs = path.resolve(rootDir, node.file);
    if (reachableFiles.has(abs)) directlyTested.add(node.id);
  }

  // Step 2: BFS over imports, calls, and registers_route from directly-tested
  // files. Functions transitively reachable are also considered covered.
  const visited = new Set<string>(directlyTested);
  // Also expand reachable files set by walking import edges.
  const reachableFileSet = new Set<string>(reachableFiles);
  let frontier = Array.from(reachableFiles);
  while (frontier.length) {
    const next: string[] = [];
    for (const fileAbs of frontier) {
      // For every file edge originating from fileAbs (file:<rel> -> file:<rel>),
      // include its target.
      const rel = path.relative(rootDir, fileAbs);
      for (const e of graph.edges) {
        if (e.relation !== "imports") continue;
        if (e.source !== `file:${rel}`) continue;
        const targetMatch = e.target.match(/^file:(.+)$/);
        if (!targetMatch) continue;
        const targetAbs = path.resolve(rootDir, targetMatch[1]!);
        if (reachableFileSet.has(targetAbs)) continue;
        reachableFileSet.add(targetAbs);
        next.push(targetAbs);
      }
    }
    frontier = next;
  }
  for (const node of graph.nodes) {
    const abs = path.resolve(rootDir, node.file);
    if (reachableFileSet.has(abs)) visited.add(node.id);
  }

  // Plus: anything reachable from already-covered nodes via calls
  const stack = Array.from(visited);
  while (stack.length) {
    const id = stack.pop()!;
    for (const edge of graph.edges) {
      if (edge.relation !== "calls" && edge.relation !== "registers_route")
        continue;
      if (edge.source !== id) continue;
      if (visited.has(edge.target)) continue;
      visited.add(edge.target);
      stack.push(edge.target);
    }
  }

  // Routes that apply tested middleware are also tested.
  for (const edge of graph.edges) {
    if (edge.relation !== "applies_middleware") continue;
    if (visited.has(edge.target) && !visited.has(edge.source)) {
      visited.add(edge.source);
    }
  }

  return visited;
}

export function readTestCount(rootDir: string): number {
  // Count .test.ts files as a coarse proxy.
  let count = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (/\.(test|spec)\.tsx?$/.test(entry.name)) {
        count++;
      }
    }
  };
  walk(rootDir);
  return count;
}
