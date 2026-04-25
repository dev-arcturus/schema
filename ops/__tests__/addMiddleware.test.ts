import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import "@/ops/addMiddleware";
import { getOp } from "@/ops/registry";
import { makeInMemoryProject, makeNode, makeGraph } from "./helpers";

const ROUTES_FILE = `import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

export function todosRouter(): Router {
  const router = Router();
  router.get("/", (req, res) => res.json({ todos: [] }));
  router.post("/", requireAuth, (req, res) => res.status(201).end());
  return router;
}
`;

const MIDDLEWARE_FILE = `import type { Request, Response, NextFunction } from "express";
export function requireAuth(_req: Request, _res: Response, next: NextFunction) {
  next();
}
`;

describe("addMiddleware op", () => {
  it("inserts middleware before the handler argument", async () => {
    const { project, rootDir } = makeInMemoryProject({
      "src/routes/todos.ts": ROUTES_FILE,
      "src/middleware/auth.ts": MIDDLEWARE_FILE,
    });

    const sf = project.getSourceFileOrThrow(
      path.join(rootDir, "src/routes/todos.ts"),
    );
    const getCall = sf
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((c) => c.getText().startsWith("router.get"));
    const start = getCall ? getCall.getStart() : 0;

    const node = makeNode({
      id: "route:src/routes/todos.ts:GET:/:6",
      name: "GET /",
      file: "src/routes/todos.ts",
      kind: "route_handler",
      range: { start, end: start + 1 },
      meta: { httpMethod: "GET", httpPath: "/" },
    });
    const graph = makeGraph(rootDir, [node]);

    const op = getOp("addMiddleware");
    expect(op).toBeDefined();

    await op!.apply(
      { kind: "node", node, graph },
      { middleware: "requireAuth", middlewareFile: "src/middleware/auth.ts" },
      project,
    );
    await project.save();

    const after = fs.readFileSync(
      path.join(rootDir, "src/routes/todos.ts"),
      "utf8",
    );
    expect(after).toMatch(/router\.get\("\/", requireAuth, \(req, res\)/);
    expect(after).toMatch(/router\.post\("\/", requireAuth/);

    const reparsed = sf.getProject().createSourceFile("scratch.ts", after, {
      overwrite: true,
    });
    expect(reparsed.getPreEmitDiagnostics().filter((d) => d.getCategory() === 1 && d.getCode() < 2000).length).toBe(0);
  });

  it("rejects when middleware already applied to the route", async () => {
    const { project, rootDir } = makeInMemoryProject({
      "src/routes/todos.ts": ROUTES_FILE,
      "src/middleware/auth.ts": MIDDLEWARE_FILE,
    });
    const sf = project.getSourceFileOrThrow(
      path.join(rootDir, "src/routes/todos.ts"),
    );
    const postCall = sf
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((c) => c.getText().startsWith("router.post"));
    const start = postCall ? postCall.getStart() : 0;

    const node = makeNode({
      id: "route:src/routes/todos.ts:POST:/:7",
      name: "POST /",
      file: "src/routes/todos.ts",
      kind: "route_handler",
      range: { start, end: start + 1 },
      meta: { httpMethod: "POST", httpPath: "/" },
    });
    const graph = makeGraph(rootDir, [node]);

    const op = getOp("addMiddleware")!;
    await expect(
      op.apply(
        { kind: "node", node, graph },
        { middleware: "requireAuth", middlewareFile: "src/middleware/auth.ts" },
        project,
      ),
    ).rejects.toThrow(/already applied/);
  });
});
