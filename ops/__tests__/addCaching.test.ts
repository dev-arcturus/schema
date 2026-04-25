import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs";
import "@/ops/addCaching";
import { getOp } from "@/ops/registry";
import { makeInMemoryProject, makeNode, makeGraph } from "./helpers";

const SERVICE_FILE = `export function getTodos(userId: number): { id: number }[] {
  return [{ id: userId }];
}
`;

describe("addCaching op", () => {
  it("emits a cached wrapper alongside the original function", async () => {
    const { project, rootDir } = makeInMemoryProject({
      "src/services/todoService.ts": SERVICE_FILE,
    });

    const node = makeNode({
      id: "fn:src/services/todoService.ts:getTodos",
      name: "getTodos",
      file: "src/services/todoService.ts",
      kind: "service",
    });
    const graph = makeGraph(rootDir, [node]);

    await getOp("addCaching")!.apply(
      { kind: "node", node, graph },
      { cacheKey: "args[0]", ttlSeconds: 30 },
      project,
    );
    await project.save();

    const after = fs.readFileSync(
      path.join(rootDir, "src/services/todoService.ts"),
      "utf8",
    );
    expect(after).toMatch(/export function getTodos/);
    expect(after).toMatch(/export const getTodosCached = memoize\(getTodos/);
    expect(after).toMatch(/ttlMs: 30000/);
    expect(after).toMatch(/import \{ memoize \} from/);

    const cacheModule = path.join(rootDir, "src/cache/memoize.ts");
    expect(fs.existsSync(cacheModule)).toBe(true);
  });
});
