import path from "node:path";

const ROOT = process.cwd();

export function resolveRepoPath(input: string | undefined): string {
  const target = input?.trim() || "fixtures/demo-app";
  return path.isAbsolute(target) ? target : path.resolve(ROOT, target);
}

export function defaultDemoRepo(): string {
  return path.resolve(ROOT, "fixtures/demo-app");
}
