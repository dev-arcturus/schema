// AST transformation: move a top-level function declaration into a new module file
// and update import sites across the project.

import path from "node:path";
import { z } from "zod";
import { Node } from "ts-morph";
import { registerOp } from "./registry";
import type { Op, OpApplyResult, OpGraphPatch } from "./types";

const paramsSchema = z.object({
  newFile: z
    .string()
    .min(1)
    .regex(/\.ts$/, "destination file must end in .ts"),
});

const op: Op<typeof paramsSchema> = {
  name: "extractModule",
  description: "Move this function into its own module",
  category: "extract",
  paramsSchema,
  paramsUI: [
    {
      name: "newFile",
      label: "New file (relative to repo root)",
      type: "text",
      placeholder: "e.g. src/utils/helpers.ts",
    },
  ],
  appliesTo: (target) =>
    target.kind === "node" && !target.node.id.startsWith("route:"),
  async apply(target, params, project) {
    if (target.kind !== "node") throw new Error("expected node target");
    const fnNode = target.node;
    const rootDir = target.graph.rootDir;

    const sourceAbs = path.join(rootDir, fnNode.file);
    const sourceFile = project.getSourceFileOrThrow(sourceAbs);
    const fnDecl = sourceFile.getFunction(fnNode.name);
    if (!fnDecl) {
      throw new Error(`function ${fnNode.name} not found in ${fnNode.file}`);
    }
    if (!fnDecl.isExported()) {
      throw new Error(`extract requires an exported function`);
    }

    const destRel = params.newFile.startsWith("/")
      ? params.newFile.slice(1)
      : params.newFile;
    const destAbs = path.join(rootDir, destRel);

    const destFile =
      project.getSourceFile(destAbs) ?? project.createSourceFile(destAbs, "", {
        overwrite: false,
      });

    const usedIdentifiers = new Set<string>();
    fnDecl.forEachDescendant((d) => {
      if (Node.isIdentifier(d)) usedIdentifiers.add(d.getText());
    });

    for (const imp of sourceFile.getImportDeclarations()) {
      const referenced = imp
        .getNamedImports()
        .some((n) => usedIdentifiers.has(n.getName()));
      const defaultRef =
        imp.getDefaultImport() && usedIdentifiers.has(imp.getDefaultImport()!.getText());
      if (referenced || defaultRef) {
        destFile.addImportDeclaration({
          moduleSpecifier: rewriteSpecifier(
            imp.getModuleSpecifierValue(),
            sourceFile.getFilePath(),
            destFile.getFilePath(),
          ),
          namedImports: imp.getNamedImports().map((n) => n.getName()),
          defaultImport: imp.getDefaultImport()?.getText(),
        });
      }
    }

    destFile.addFunction({
      name: fnNode.name,
      isExported: true,
      parameters: fnDecl.getParameters().map((p) => ({
        name: p.getName(),
        type: p.getTypeNode()?.getText(),
        hasQuestionToken: p.hasQuestionToken(),
        initializer: p.getInitializer()?.getText(),
      })),
      returnType: fnDecl.getReturnTypeNode()?.getText(),
      isAsync: fnDecl.isAsync(),
      statements: fnDecl.getBodyText() ?? "",
    });

    fnDecl.remove();

    let newRel = path.relative(path.dirname(sourceAbs), destAbs).replace(/\\/g, "/");
    if (!newRel.startsWith(".")) newRel = "./" + newRel;
    newRel = newRel.replace(/\.ts$/, ".js");
    sourceFile.addImportDeclaration({
      moduleSpecifier: newRel,
      namedImports: [fnNode.name],
    });

    for (const sf of project.getSourceFiles()) {
      if (sf === sourceFile || sf === destFile) continue;
      const imp = sf
        .getImportDeclarations()
        .find((d) =>
          d
            .getNamedImports()
            .some((n) => n.getName() === fnNode.name) &&
          isSameTargetFile(d.getModuleSpecifierValue(), sf.getFilePath(), sourceFile.getFilePath()),
        );
      if (!imp) continue;
      const named = imp.getNamedImports().find((n) => n.getName() === fnNode.name);
      named?.remove();
      let rel = path.relative(path.dirname(sf.getFilePath()), destAbs).replace(/\\/g, "/");
      if (!rel.startsWith(".")) rel = "./" + rel;
      rel = rel.replace(/\.ts$/, ".js");
      sf.addImportDeclaration({ moduleSpecifier: rel, namedImports: [fnNode.name] });
      if (imp.getNamedImports().length === 0 && !imp.getDefaultImport() && !imp.getNamespaceImport()) {
        imp.remove();
      }
    }

    return {
      filesChanged: [fnNode.file, destRel],
      description: `Extract ${fnNode.name} into ${destRel}`,
    } satisfies OpApplyResult;
  },
  graphPatch(target, params): OpGraphPatch {
    if (target.kind !== "node") return {};
    const node = target.node;
    return {
      addNodes: [
        {
          id: `fn:${params.newFile}:${node.name}`,
          kind: node.kind,
          name: node.name,
          file: params.newFile,
          range: node.range,
          cluster: node.cluster,
        },
      ],
      removeNodes: [node.id],
    };
  },
};

function rewriteSpecifier(spec: string, fromFile: string, toFile: string): string {
  if (!spec.startsWith(".")) return spec;
  const fromDir = path.dirname(fromFile);
  const toDir = path.dirname(toFile);
  const abs = path.resolve(fromDir, spec);
  let rel = path.relative(toDir, abs).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function isSameTargetFile(spec: string, importerFile: string, candidateFile: string): boolean {
  if (!spec.startsWith(".")) return false;
  const importerDir = path.dirname(importerFile);
  const abs = path.resolve(importerDir, spec.replace(/\.js$/, ""));
  const candidate = candidateFile.replace(/\.ts$/, "");
  return abs === candidate;
}

registerOp(op as unknown as Op);
