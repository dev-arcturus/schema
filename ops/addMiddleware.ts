// AST transformation: insert a middleware identifier before the final handler argument
// of an Express route registration call, ensuring the middleware is imported.

import path from "node:path";
import { Node, type CallExpression, type SourceFile } from "ts-morph";
import { z } from "zod";
import { registerOp } from "./registry";
import type { Op, OpApplyResult, OpGraphPatch } from "./types";

const paramsSchema = z.object({
  middleware: z.string().min(1, "middleware function name required"),
  middlewareFile: z.string().min(1, "middleware source file required"),
});

const op: Op<typeof paramsSchema> = {
  name: "addMiddleware",
  description: "Apply a middleware to this route",
  category: "middleware",
  paramsSchema,
  paramsUI: [
    {
      name: "middleware",
      label: "Middleware",
      type: "graph-select",
      filter: { kind: "middleware" },
      valueShape: "name_and_file",
    },
  ],
  appliesTo: (target) =>
    target.kind === "node" &&
    target.node.kind === "route_handler" &&
    Boolean(target.node.meta?.httpMethod),
  async apply(target, params, project) {
    if (target.kind !== "node") throw new Error("expected node target");
    const route = target.node;
    const sourceFile = project.getSourceFileOrThrow(
      path.join(target.graph.rootDir, route.file),
    );

    const call = findRouteCall(sourceFile, route.range.start);
    if (!call) throw new Error("could not locate route registration call");

    const args = call.getArguments();
    if (args.length < 2) throw new Error("route call has no handler argument");

    const alreadyApplied = args
      .slice(1, -1)
      .some((a) => Node.isIdentifier(a) && a.getText() === params.middleware);
    if (alreadyApplied) {
      throw new Error(`${params.middleware} already applied to this route`);
    }

    const handlerIndex = args.length - 1;
    call.insertArgument(handlerIndex, params.middleware);

    ensureImport(sourceFile, params.middleware, params.middlewareFile, target.graph.rootDir);

    return {
      filesChanged: [route.file],
      description: `Apply ${params.middleware} to ${route.name}`,
    } satisfies OpApplyResult;
  },
  graphPatch(target, params): OpGraphPatch {
    if (target.kind !== "node") return {};
    const route = target.node;
    const middlewareNodeId = `fn:${params.middlewareFile}:${params.middleware}`;
    return {
      addEdges: [
        {
          id: `${route.id}->${middlewareNodeId}:mw:added`,
          source: route.id,
          target: middlewareNodeId,
          relation: "applies_middleware",
        },
      ],
    };
  },
};

function findRouteCall(sf: SourceFile, startPos: number): CallExpression | null {
  const node = sf.getDescendantAtPos(startPos);
  if (!node) return null;
  const call = node.getFirstAncestor((a) => Node.isCallExpression(a)) ?? node;
  return Node.isCallExpression(call) ? call : null;
}

function ensureImport(
  sf: SourceFile,
  identifier: string,
  fromFile: string,
  rootDir: string,
): void {
  const sfDir = path.dirname(sf.getFilePath());
  const targetAbs = path.resolve(rootDir, fromFile);
  let rel = path.relative(sfDir, targetAbs).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  rel = rel.replace(/\.ts$/, ".js");

  const existing = sf
    .getImportDeclarations()
    .find((d) => normalizeSpec(d.getModuleSpecifierValue()) === normalizeSpec(rel));

  if (existing) {
    const named = existing.getNamedImports().map((n) => n.getName());
    if (!named.includes(identifier)) {
      existing.addNamedImport(identifier);
    }
    return;
  }

  sf.addImportDeclaration({
    moduleSpecifier: rel,
    namedImports: [identifier],
  });
}

function normalizeSpec(spec: string): string {
  return spec.replace(/\.js$/, "").replace(/\.ts$/, "");
}

registerOp(op as unknown as Op);
