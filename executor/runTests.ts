import { spawn } from "node:child_process";

export type TestRunResult = {
  passed: boolean;
  exitCode: number | null;
  output: string;
  durationMs: number;
};

export async function runTests(
  repoPath: string,
  onChunk?: (chunk: string) => void,
): Promise<TestRunResult> {
  const start = Date.now();
  return new Promise<TestRunResult>((resolve, reject) => {
    const child = spawn("npm", ["test", "--silent"], {
      cwd: repoPath,
      env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
    });
    let buffer = "";
    const handle = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      buffer += text;
      onChunk?.(text);
    };
    child.stdout.on("data", handle);
    child.stderr.on("data", handle);
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      resolve({
        passed: code === 0,
        exitCode: code,
        output: buffer,
        durationMs: Date.now() - start,
      });
    });
  });
}
