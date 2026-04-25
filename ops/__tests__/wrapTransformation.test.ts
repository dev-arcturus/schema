import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs";
import "@/ops/wrapTransformation";
import { getOp } from "@/ops/registry";
import { makeInMemoryProject, makeNode, makeGraph } from "./helpers";

const SERVICE_FILE = `export function loginUser(email: string, password: string): { token: string } {
  return { token: \`\${email}:\${password}\` };
}
`;

describe("wrapTransformation op", () => {
  it("renames the original to <name>Inner and re-exports a wrapped const", async () => {
    const { project, rootDir } = makeInMemoryProject({
      "src/services/authService.ts": SERVICE_FILE,
    });

    const node = makeNode({
      id: "fn:src/services/authService.ts:loginUser",
      name: "loginUser",
      file: "src/services/authService.ts",
      kind: "service",
    });
    const graph = makeGraph(rootDir, [node]);

    await getOp("wrapTransformation")!.apply(
      { kind: "node", node, graph },
      { variant: "logging", retries: 3 },
      project,
    );
    await project.save();

    const after = fs.readFileSync(
      path.join(rootDir, "src/services/authService.ts"),
      "utf8",
    );
    expect(after).toMatch(/function loginUserInner/);
    expect(after).not.toMatch(/export function loginUser\b/);
    expect(after).toMatch(/export const loginUser = withLogging\(loginUserInner/);
    expect(after).toMatch(/import \{ withLogging \}/);

    const wrappersModule = path.join(rootDir, "src/wrappers/index.ts");
    expect(fs.existsSync(wrappersModule)).toBe(true);
  });
});
