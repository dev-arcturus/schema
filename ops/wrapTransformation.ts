// AST transformation: rebind a function declaration to a higher-order wrapper
// (logging | retry | telemetry), generating a wrappers module on first use.

import path from "node:path";
import fs from "node:fs";
import { Node, SyntaxKind, VariableDeclarationKind, type SourceFile } from "ts-morph";
import { z } from "zod";
import { registerOp } from "./registry";
import type { Op, OpApplyResult, OpGraphPatch } from "./types";

const variants = ["logging", "retry", "telemetry"] as const;
const paramsSchema = z.object({
  variant: z.enum(variants),
  retries: z.number().int().min(1).max(10).default(3),
});

const WRAPPERS_MODULE_REL = "src/wrappers/index.ts";

const op: Op<typeof paramsSchema> = {
  name: "wrapTransformation",
  description: "Wrap with logging, retry, or telemetry",
  category: "transform",
  paramsSchema,
  paramsUI: [
    {
      name: "variant",
      label: "Variant",
      type: "select",
      options: [
        { value: "logging", label: "Logging" },
        { value: "retry", label: "Retry" },
        { value: "telemetry", label: "Telemetry" },
      ],
      defaultValue: "logging",
    },
    {
      name: "retries",
      label: "Retries (only for retry variant)",
      type: "number",
      defaultValue: 3,
      min: 1,
      max: 10,
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

    ensureWrappersModule(rootDir);
    project.addSourceFileAtPathIfExists(path.join(rootDir, WRAPPERS_MODULE_REL));

    const sf = project.getSourceFileOrThrow(path.join(rootDir, fnNode.file));
    const fnDecl = sf.getFunction(fnNode.name);
    if (!fnDecl) {
      throw new Error(
        `wrapTransformation requires a top-level function declaration named ${fnNode.name}`,
      );
    }
    if (!fnDecl.isExported()) {
      throw new Error(`${fnNode.name} must be exported to be wrapped`);
    }

    const innerName = `${fnNode.name}Inner`;
    const exportedName = fnNode.name;

    if (sf.getVariableDeclaration(exportedName) || sf.getVariableDeclaration(innerName)) {
      throw new Error(`${fnNode.name} appears already wrapped`);
    }

    fnDecl.rename(innerName);
    fnDecl.setIsExported(false);

    ensureWrapperImport(sf, rootDir, params.variant);

    const wrapperCall =
      params.variant === "retry"
        ? `withRetry(${innerName}, { attempts: ${params.retries} })`
        : params.variant === "logging"
          ? `withLogging(${innerName}, "${exportedName}")`
          : `withTelemetry(${innerName}, "${exportedName}")`;

    sf.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: exportedName, initializer: wrapperCall }],
    });

    return {
      filesChanged: [fnNode.file, WRAPPERS_MODULE_REL],
      description: `Wrap ${fnNode.name} with ${params.variant}`,
    } satisfies OpApplyResult;
  },
  graphPatch(target, params): OpGraphPatch {
    if (target.kind !== "node") return {};
    const node = target.node;
    return {
      addNodes: [
        {
          id: `fn:${node.file}:${node.name}Inner`,
          kind: node.kind,
          name: `${node.name}Inner`,
          file: node.file,
          range: node.range,
          cluster: node.cluster,
          meta: { summary: `original (pre-wrap)` },
        },
      ],
      addEdges: [
        {
          id: `wrap:${node.id}->inner:${params.variant}`,
          source: node.id,
          target: `fn:${node.file}:${node.name}Inner`,
          relation: "calls",
        },
      ],
    };
  },
};

function ensureWrappersModule(rootDir: string): void {
  const abs = path.join(rootDir, WRAPPERS_MODULE_REL);
  if (fs.existsSync(abs)) return;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(
    abs,
    `// Higher-order wrappers used by Schema's wrapTransformation op.
export function withLogging<A extends unknown[], R>(
  fn: (...args: A) => R,
  label: string,
): (...args: A) => R {
  return (...args: A): R => {
    console.log(\`[\${label}] call\`, args);
    try {
      const out = fn(...args);
      if (out instanceof Promise) {
        return out.then(
          (v) => {
            console.log(\`[\${label}] ok\`);
            return v;
          },
          (e) => {
            console.error(\`[\${label}] error\`, e);
            throw e;
          },
        ) as R;
      }
      console.log(\`[\${label}] ok\`);
      return out;
    } catch (e) {
      console.error(\`[\${label}] error\`, e);
      throw e;
    }
  };
}

export function withRetry<A extends unknown[], R>(
  fn: (...args: A) => R,
  opts: { attempts: number },
): (...args: A) => R {
  return (...args: A): R => {
    let lastErr: unknown;
    for (let i = 0; i < opts.attempts; i++) {
      try {
        return fn(...args);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  };
}

export function withTelemetry<A extends unknown[], R>(
  fn: (...args: A) => R,
  label: string,
): (...args: A) => R {
  return (...args: A): R => {
    const start = Date.now();
    try {
      const out = fn(...args);
      console.log(\`[telemetry:\${label}] ok in \${Date.now() - start}ms\`);
      return out;
    } catch (e) {
      console.log(\`[telemetry:\${label}] err in \${Date.now() - start}ms\`);
      throw e;
    }
  };
}
`,
  );
}

function ensureWrapperImport(
  sf: SourceFile,
  rootDir: string,
  variant: (typeof variants)[number],
): void {
  const named =
    variant === "retry" ? "withRetry" : variant === "logging" ? "withLogging" : "withTelemetry";
  const sfDir = path.dirname(sf.getFilePath());
  const targetAbs = path.join(rootDir, WRAPPERS_MODULE_REL);
  let rel = path.relative(sfDir, targetAbs).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  rel = rel.replace(/\.ts$/, ".js");

  const existing = sf
    .getImportDeclarations()
    .find(
      (d) =>
        d.getModuleSpecifierValue().replace(/\.js$/, "") ===
        rel.replace(/\.js$/, ""),
    );
  if (existing) {
    if (!existing.getNamedImports().some((n) => n.getName() === named)) {
      existing.addNamedImport(named);
    }
    return;
  }
  sf.addImportDeclaration({ moduleSpecifier: rel, namedImports: [named] });
}

void Node;
void SyntaxKind;

registerOp(op as unknown as Op);
