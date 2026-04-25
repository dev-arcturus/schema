import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = ".schema-cache";

// Hash by file path + content size + first/last byte of content.
// Portable across machines (no mtime), invalidates on substantive change.
export function hashRepo(rootDir: string, files: string[]): string {
  const h = crypto.createHash("sha256");
  for (const file of files.sort()) {
    const abs = path.join(rootDir, file);
    try {
      const buf = fs.readFileSync(abs);
      h.update(`${file}:${buf.length}:`);
      h.update(buf);
    } catch {
      h.update(`${file}:missing`);
    }
  }
  return h.digest("hex").slice(0, 16);
}

export function readCache<T>(rootDir: string, key: string): T | null {
  const file = path.join(rootDir, CACHE_DIR, `${key}.json`);
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCache(rootDir: string, key: string, value: unknown): void {
  const dir = path.join(rootDir, CACHE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(value, null, 2));
}
