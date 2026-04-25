import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs";
import "@/ops/extractModule";
import { getOp } from "@/ops/registry";
import { makeInMemoryProject, makeNode, makeGraph } from "./helpers";

const SOURCE = `export function multiply(a: number, b: number): number {
  return a * b;
}

export function square(n: number): number {
  return multiply(n, n);
}
`;

const CALLER = `import { multiply } from "../math.js";
export function double(x: number): number {
  return multiply(x, 2);
}
`;

describe("extractModule op", () => {
  it("moves a function into a new file and updates importers", async () => {
    const { project, rootDir } = makeInMemoryProject({
      "src/math.ts": SOURCE,
      "src/util/double.ts": CALLER,
    });

    const node = makeNode({
      id: "fn:src/math.ts:multiply",
      name: "multiply",
      file: "src/math.ts",
      kind: "utility",
    });
    const graph = makeGraph(rootDir, [node]);

    await getOp("extractModule")!.apply(
      { kind: "node", node, graph },
      { newFile: "src/math/multiply.ts" },
      project,
    );
    await project.save();

    const newFile = path.join(rootDir, "src/math/multiply.ts");
    expect(fs.existsSync(newFile)).toBe(true);
    expect(fs.readFileSync(newFile, "utf8")).toMatch(/export function multiply/);

    const oldFile = fs.readFileSync(path.join(rootDir, "src/math.ts"), "utf8");
    expect(oldFile).not.toMatch(/export function multiply/);
    expect(oldFile).toMatch(/import \{ multiply \} from "\.\/math\/multiply\.js"/);

    const caller = fs.readFileSync(
      path.join(rootDir, "src/util/double.ts"),
      "utf8",
    );
    expect(caller).toMatch(/from "\.\.\/math\/multiply\.js"/);
  });
});
