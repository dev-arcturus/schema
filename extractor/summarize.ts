import fs from "node:fs";
import path from "node:path";
import type { Graph } from "./types";

const SUMMARY_LINES = 25;

export function summarizeFiles(graph: Graph): Map<string, string> {
  const out = new Map<string, string>();
  const files = new Set(graph.nodes.map((n) => n.file));
  for (const file of files) {
    const abs = path.join(graph.rootDir, file);
    try {
      const content = fs.readFileSync(abs, "utf8");
      const top = content.split("\n").slice(0, SUMMARY_LINES).join("\n");
      out.set(file, top);
    } catch {
      out.set(file, "");
    }
  }
  return out;
}
