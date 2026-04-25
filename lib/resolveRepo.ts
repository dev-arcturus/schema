import path from "node:path";
import fs from "node:fs/promises";
import simpleGit from "simple-git";

export type RepoSource =
  | { source: "local"; value: string }
  | { source: "github"; value: string; token?: string };

export type ResolvedRepo = {
  rootDir: string;
  origin: { kind: "local" } | { kind: "github"; owner: string; repo: string; url: string };
  cloned: boolean;
};

const CLONES_DIR = ".schema-clones";

export async function resolveRepo(input: RepoSource): Promise<ResolvedRepo> {
  if (input.source === "local") {
    const target = input.value.trim() || "fixtures/demo-app";
    const abs = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target);
    await assertDir(abs);
    return { rootDir: abs, origin: { kind: "local" }, cloned: false };
  }

  const parsed = parseGithubUrl(input.value);
  if (!parsed) throw new Error(`unable to parse GitHub URL: ${input.value}`);

  const cloneRoot = path.resolve(process.cwd(), CLONES_DIR);
  await fs.mkdir(cloneRoot, { recursive: true });
  const dest = path.join(cloneRoot, `${parsed.owner}__${parsed.repo}`);

  const cloneUrl = input.token
    ? `https://x-access-token:${input.token}@github.com/${parsed.owner}/${parsed.repo}.git`
    : `https://github.com/${parsed.owner}/${parsed.repo}.git`;

  let cloned = false;
  if (await pathExists(dest)) {
    try {
      await simpleGit(dest).fetch().catch(() => null);
    } catch {
      // best effort
    }
  } else {
    await simpleGit().clone(cloneUrl, dest, ["--depth", "1"]);
    cloned = true;
  }

  return {
    rootDir: dest,
    origin: {
      kind: "github",
      owner: parsed.owner,
      repo: parsed.repo,
      url: `https://github.com/${parsed.owner}/${parsed.repo}`,
    },
    cloned,
  };
}

export function parseGithubUrl(raw: string): { owner: string; repo: string } | null {
  const trimmed = raw.trim();
  const patterns = [
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s.]+)(?:\.git)?\/?$/,
    /^git@github\.com:([^/\s]+)\/([^/\s.]+)(?:\.git)?$/,
    /^([^/\s]+)\/([^/\s.]+)$/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1] && m[2]) return { owner: m[1], repo: m[2] };
  }
  return null;
}

async function assertDir(p: string): Promise<void> {
  const stat = await fs.stat(p).catch(() => null);
  if (!stat) throw new Error(`path does not exist: ${p}`);
  if (!stat.isDirectory()) throw new Error(`path is not a directory: ${p}`);
}

async function pathExists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false);
}
