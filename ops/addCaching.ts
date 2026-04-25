// AST transformation: wrap a function call site with a memoizing cache wrapper,
// generating a cache module on first use.

import path from "node:path";
import fs from "node:fs";
import { Node, VariableDeclarationKind, type SourceFile } from "ts-morph";
import { z } from "zod";
import { registerOp } from "./registry";
import type { Op, OpApplyResult, OpGraphPatch } from "./types";

const paramsSchema = z.object({
  cacheKey: z
    .string()
    .min(1, "cache key expression required (e.g. 'userId' or 'JSON.stringify(args)')"),
  ttlSeconds: z.number().int().positive().default(60),
});

const CACHE_MODULE_REL = "src/cache/memoize.ts";

const op: Op<typeof paramsSchema> = {
  name: "addCaching",
  description: "Wrap a function with TTL memoization",
  category: "caching",
  paramsSchema,
  paramsUI: [
    {
      name: "cacheKey",
      label: "Cache key expression",
      type: "text",
      placeholder: "e.g. args[0] or JSON.stringify(args)",
      defaultValue: "args[0]",
    },
    {
      name: "ttlSeconds",
      label: "TTL (seconds)",
      type: "number",
      defaultValue: 60,
      min: 1,
      max: 3600,
    },
  ],
  appliesTo: (target) =>
    target.kind === "node" &&
    (target.node.kind === "service" || target.node.kind === "data_access") &&
    !target.node.id.startsWith("route:"),
  async apply(target, params, project) {
    if (target.kind !== "node") throw new Error("expected node target");
    const fnNode = target.node;
    const rootDir = target.graph.rootDir;

    ensureCacheModule(rootDir);
    const cacheModuleAbs = path.join(rootDir, CACHE_MODULE_REL);
    project.addSourceFileAtPathIfExists(cacheModuleAbs);

    const sf = project.getSourceFileOrThrow(path.join(rootDir, fnNode.file));
    const targetFn = findFunctionOrVarByName(sf, fnNode.name);
    if (!targetFn) throw new Error(`could not find ${fnNode.name} in ${fnNode.file}`);

    const wrapperName = `${fnNode.name}Cached`;
    const exists = sf
      .getVariableDeclarations()
      .some((v) => v.getName() === wrapperName);
    if (exists) {
      throw new Error(`${wrapperName} already exists in ${fnNode.file}`);
    }

    ensureMemoizeImport(sf, rootDir);

    sf.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: wrapperName,
          initializer: `memoize(${fnNode.name}, { ttlMs: ${params.ttlSeconds * 1000}, key: (...args) => String(${params.cacheKey}) })`,
        },
      ],
    });

    return {
      filesChanged: [fnNode.file, CACHE_MODULE_REL],
      description: `Wrap ${fnNode.name} with TTL=${params.ttlSeconds}s cache`,
    } satisfies OpApplyResult;
  },
  graphPatch(target, _params): OpGraphPatch {
    if (target.kind !== "node") return {};
    const node = target.node;
    return {
      addNodes: [
        {
          id: `fn:${node.file}:${node.name}Cached`,
          kind: "utility",
          name: `${node.name}Cached`,
          file: node.file,
          range: node.range,
          cluster: node.cluster,
          meta: { summary: `cached ${node.name}` },
        },
      ],
      addEdges: [
        {
          id: `cache:${node.id}->wraps`,
          source: `fn:${node.file}:${node.name}Cached`,
          target: node.id,
          relation: "calls",
        },
      ],
    };
  },
};

function ensureCacheModule(rootDir: string): void {
  const abs = path.join(rootDir, CACHE_MODULE_REL);
  if (fs.existsSync(abs)) return;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(
    abs,
    `// Tiny TTL memoizer used by Schema's addCaching op.
type Entry<V> = { value: V; expires: number };

export function memoize<A extends unknown[], R>(
  fn: (...args: A) => R,
  opts: { ttlMs: number; key: (...args: A) => string },
): (...args: A) => R {
  const store = new Map<string, Entry<R>>();
  return (...args: A): R => {
    const k = opts.key(...args);
    const now = Date.now();
    const hit = store.get(k);
    if (hit && hit.expires > now) return hit.value;
    const value = fn(...args);
    store.set(k, { value, expires: now + opts.ttlMs });
    return value;
  };
}
`,
  );
}

function ensureMemoizeImport(sf: SourceFile, rootDir: string): void {
  const sfDir = path.dirname(sf.getFilePath());
  const targetAbs = path.join(rootDir, CACHE_MODULE_REL);
  let rel = path.relative(sfDir, targetAbs).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  rel = rel.replace(/\.ts$/, ".js");

  const existing = sf
    .getImportDeclarations()
    .find((d) =>
      d.getModuleSpecifierValue().replace(/\.js$/, "") === rel.replace(/\.js$/, ""),
    );
  if (existing) {
    if (!existing.getNamedImports().some((n) => n.getName() === "memoize")) {
      existing.addNamedImport("memoize");
    }
    return;
  }
  sf.addImportDeclaration({ moduleSpecifier: rel, namedImports: ["memoize"] });
}

function findFunctionOrVarByName(sf: SourceFile, name: string) {
  const fn = sf.getFunction(name);
  if (fn) return fn;
  const v = sf.getVariableDeclaration(name);
  return v ?? null;
}

registerOp(op as unknown as Op);
