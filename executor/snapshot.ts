import fs from "node:fs/promises";
import path from "node:path";

export type FileBackup = { absPath: string; original: string | null };

export class Snapshot {
  private files = new Map<string, FileBackup>();

  async record(absPath: string): Promise<void> {
    if (this.files.has(absPath)) return;
    let original: string | null;
    try {
      original = await fs.readFile(absPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        original = null;
      } else {
        throw err;
      }
    }
    this.files.set(absPath, { absPath, original });
  }

  async recordMany(rootDir: string, relPaths: string[]): Promise<void> {
    await Promise.all(
      relPaths.map((rel) => this.record(path.join(rootDir, rel))),
    );
  }

  list(): FileBackup[] {
    return Array.from(this.files.values());
  }

  async rollback(): Promise<void> {
    await Promise.all(
      this.list().map(async (b) => {
        if (b.original === null) {
          await fs.rm(b.absPath, { force: true });
        } else {
          await fs.mkdir(path.dirname(b.absPath), { recursive: true });
          await fs.writeFile(b.absPath, b.original);
        }
      }),
    );
  }
}
