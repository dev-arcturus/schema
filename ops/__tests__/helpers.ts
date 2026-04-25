import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { Project } from "ts-morph";
import type { Graph, GraphNode } from "@/extractor/types";

export function makeInMemoryProject(files: Record<string, string>): {
  project: Project;
  rootDir: string;
} {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-op-"));
  fs.mkdirSync(rootDir, { recursive: true });
  const project = new Project({ useInMemoryFileSystem: false });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(rootDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    project.addSourceFileAtPath(abs);
  }
  return { project, rootDir };
}

export function makeNode(node: Partial<GraphNode> & {
  id: string;
  name: string;
  file: string;
}): GraphNode {
  return {
    kind: "service",
    range: { start: 0, end: 0 },
    ...node,
  };
}

export function makeGraph(rootDir: string, nodes: GraphNode[] = []): Graph {
  return { nodes, edges: [], clusters: [], rootDir };
}
