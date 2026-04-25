import path from "node:path";
import {
  Project,
  SyntaxKind,
  Node,
  type SourceFile,
  type CallExpression,
  type FunctionDeclaration,
  type VariableDeclaration,
  type ArrowFunction,
  type FunctionExpression,
  type Identifier,
} from "ts-morph";
import type {
  Graph,
  GraphEdge,
  GraphNode,
  NodeKind,
} from "./types";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "all",
]);

type FunctionLikeNode = FunctionDeclaration | ArrowFunction | FunctionExpression;

type SymbolEntry = {
  nodeId: string;
  file: string;
  fnNode: FunctionLikeNode;
  exportName?: string;
};

export type ExtractOptions = {
  rootDir: string;
  tsConfigFilePath?: string;
  globs?: string[];
};

export function extractGraph(opts: ExtractOptions): Graph {
  const project = new Project({
    tsConfigFilePath: opts.tsConfigFilePath,
    skipAddingFilesFromTsConfig: !opts.tsConfigFilePath,
  });
  const globs = opts.globs ?? [`${opts.rootDir}/src/**/*.ts`];
  project.addSourceFilesAtPaths(globs);

  const files = project
    .getSourceFiles()
    .filter((sf) => {
      const p = sf.getFilePath();
      if (p.includes("/node_modules/")) return false;
      const rel = relPath(opts.rootDir, p);
      if (rel.startsWith("test/") || rel.startsWith("tests/")) return false;
      if (/\.(test|spec)\.ts$/.test(rel)) return false;
      return true;
    });

  const symbolTable = new Map<string, SymbolEntry>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const mounts = new Map<string, string>(); // factoryName -> mount path prefix

  for (const sf of files) {
    collectFunctions(sf, opts.rootDir, nodes, symbolTable);
  }

  for (const sf of files) {
    collectMounts(sf, mounts);
  }

  for (const sf of files) {
    collectImports(sf, opts.rootDir, edges);
    collectExpressRoutes(sf, opts.rootDir, nodes, edges, symbolTable, mounts);
  }

  for (const entry of symbolTable.values()) {
    collectCalls(entry, opts.rootDir, edges, symbolTable);
  }

  return {
    nodes,
    edges: dedupeEdges(edges),
    clusters: [],
    rootDir: opts.rootDir,
  };
}

function collectMounts(sf: SourceFile, mounts: Map<string, string>): void {
  sf.forEachDescendant((d) => {
    if (!Node.isCallExpression(d)) return;
    const callee = d.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;
    if (callee.getName() !== "use") return;
    const args = d.getArguments();
    if (args.length < 2) return;
    const first = args[0];
    if (!first || !Node.isStringLiteral(first)) return;
    const mountPath = first.getLiteralValue();
    const second = args[1];
    if (!second) return;

    let factoryName: string | undefined;
    if (Node.isCallExpression(second)) {
      const expr = second.getExpression();
      if (Node.isIdentifier(expr)) factoryName = expr.getText();
    } else if (Node.isIdentifier(second)) {
      factoryName = second.getText();
    }
    if (!factoryName) return;
    mounts.set(factoryName, mountPath);
  });
}

function relPath(rootDir: string, file: string): string {
  return path.relative(rootDir, file);
}

function kindForFile(rel: string): NodeKind {
  if (rel.includes("/routes/") || rel.startsWith("routes/")) return "route_handler";
  if (rel.includes("/services/") || rel.startsWith("services/")) return "service";
  if (
    rel.includes("/repos/") ||
    rel.startsWith("repos/") ||
    rel.includes("/db/") ||
    rel.startsWith("db/") ||
    rel.includes("/data/")
  )
    return "data_access";
  if (rel.includes("/middleware/") || rel.startsWith("middleware/"))
    return "middleware";
  if (rel.includes("/models/") || rel.startsWith("models/")) return "model";
  return "utility";
}

function collectFunctions(
  sf: SourceFile,
  rootDir: string,
  nodes: GraphNode[],
  symbols: Map<string, SymbolEntry>,
): void {
  const file = relPath(rootDir, sf.getFilePath());
  const kind = kindForFile(file);

  for (const fn of sf.getFunctions()) {
    if (!fn.getName()) continue;
    const id = makeId(file, fn.getName()!);
    const node: GraphNode = {
      id,
      kind,
      name: fn.getName()!,
      file,
      range: { start: fn.getStart(), end: fn.getEnd() },
      meta: { isExported: fn.isExported() },
    };
    nodes.push(node);
    symbols.set(id, { nodeId: id, file, fnNode: fn });
    symbols.set(fn.getName()!, { nodeId: id, file, fnNode: fn });
  }

  for (const v of sf.getVariableDeclarations()) {
    const init = v.getInitializer();
    if (!init) continue;
    if (
      init.getKind() === SyntaxKind.ArrowFunction ||
      init.getKind() === SyntaxKind.FunctionExpression
    ) {
      const fn = init as ArrowFunction | FunctionExpression;
      const id = makeId(file, v.getName());
      const node: GraphNode = {
        id,
        kind,
        name: v.getName(),
        file,
        range: { start: v.getStart(), end: v.getEnd() },
        meta: { isExported: isExportedVar(v) },
      };
      nodes.push(node);
      symbols.set(id, { nodeId: id, file, fnNode: fn });
      symbols.set(v.getName(), { nodeId: id, file, fnNode: fn });
    }
  }
}

function isExportedVar(v: VariableDeclaration): boolean {
  const stmt = v.getVariableStatement();
  return stmt?.isExported() ?? false;
}

function collectImports(
  sf: SourceFile,
  rootDir: string,
  edges: GraphEdge[],
): void {
  const file = relPath(rootDir, sf.getFilePath());
  for (const imp of sf.getImportDeclarations()) {
    const target = imp.getModuleSpecifierSourceFile();
    if (!target) continue;
    const targetFile = relPath(rootDir, target.getFilePath());
    if (targetFile === file) continue;
    edges.push({
      id: `import:${file}->${targetFile}:${imp.getStartLineNumber()}`,
      source: `file:${file}`,
      target: `file:${targetFile}`,
      relation: "imports",
      location: { file, line: imp.getStartLineNumber() },
    });
  }
}

function collectExpressRoutes(
  sf: SourceFile,
  rootDir: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  symbols: Map<string, SymbolEntry>,
  mounts: Map<string, string>,
): void {
  const file = relPath(rootDir, sf.getFilePath());

  sf.forEachDescendant((d) => {
    if (!Node.isCallExpression(d)) return;
    const callee = d.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;
    const method = callee.getName().toLowerCase();
    if (!HTTP_METHODS.has(method) && method !== "use") return;

    const receiver = callee.getExpression();
    const receiverText = receiver.getText();
    const args = d.getArguments();
    if (args.length === 0) return;

    if (HTTP_METHODS.has(method)) {
      const enclosingFn = d.getFirstAncestor(
        (a) => Node.isFunctionDeclaration(a) || Node.isFunctionExpression(a),
      );
      let mountPrefix = "";
      if (enclosingFn && Node.isFunctionDeclaration(enclosingFn)) {
        const fnName = enclosingFn.getName();
        if (fnName) mountPrefix = mounts.get(fnName) ?? "";
      }
      handleRouteRegistration(
        d,
        method,
        args,
        receiverText,
        file,
        mountPrefix,
        nodes,
        edges,
        symbols,
      );
      return;
    }

    if (method === "use") {
      handleRouterMount(d, args, receiverText, file, edges, symbols);
    }
  });
}

function handleRouteRegistration(
  call: CallExpression,
  method: string,
  args: ReturnType<CallExpression["getArguments"]>,
  receiverText: string,
  file: string,
  mountPrefix: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  symbols: Map<string, SymbolEntry>,
): void {
  const first = args[0];
  if (!first || !Node.isStringLiteral(first)) return;
  const localPath = first.getLiteralValue();
  const fullPath = joinPaths(mountPrefix, localPath);

  const handlerArgs = args.slice(1);
  if (handlerArgs.length === 0) return;
  const handler = handlerArgs[handlerArgs.length - 1];
  const middlewares = handlerArgs.slice(0, -1);

  const line = call.getStartLineNumber();
  const routeId = `route:${file}:${method.toUpperCase()}:${fullPath}:${line}`;
  const node: GraphNode = {
    id: routeId,
    kind: "route_handler",
    name: `${method.toUpperCase()} ${fullPath}`,
    file,
    range: { start: call.getStart(), end: call.getEnd() },
    meta: {
      httpMethod: method.toUpperCase(),
      httpPath: fullPath,
      routerName: receiverText,
    },
  };
  nodes.push(node);

  if (Node.isIdentifier(handler)) {
    const handlerSymbol = resolveIdentifier(handler, symbols);
    if (handlerSymbol) {
      edges.push({
        id: `${routeId}->${handlerSymbol.nodeId}:reg`,
        source: routeId,
        target: handlerSymbol.nodeId,
        relation: "registers_route",
        location: { file, line },
      });
    }
  }

  for (const mw of middlewares) {
    if (Node.isIdentifier(mw)) {
      const mwSymbol = resolveIdentifier(mw, symbols);
      if (mwSymbol) {
        edges.push({
          id: `${routeId}->${mwSymbol.nodeId}:mw`,
          source: routeId,
          target: mwSymbol.nodeId,
          relation: "applies_middleware",
          location: { file, line },
        });
      }
    }
  }
}

function handleRouterMount(
  call: CallExpression,
  args: ReturnType<CallExpression["getArguments"]>,
  receiverText: string,
  file: string,
  edges: GraphEdge[],
  symbols: Map<string, SymbolEntry>,
): void {
  if (args.length < 2) return;
  const first = args[0];
  if (!first || !Node.isStringLiteral(first)) return;

  const second = args[1];
  if (!second) return;
  let factory: Identifier | null = null;
  if (Node.isCallExpression(second)) {
    const expr = second.getExpression();
    if (Node.isIdentifier(expr)) factory = expr;
  } else if (Node.isIdentifier(second)) {
    factory = second;
  }
  if (!factory) return;

  const factorySymbol = resolveIdentifier(factory, symbols);
  if (!factorySymbol) return;

  edges.push({
    id: `mount:${file}:${call.getStartLineNumber()}->${factorySymbol.nodeId}`,
    source: `file:${file}`,
    target: factorySymbol.nodeId,
    relation: "registers_route",
    location: { file, line: call.getStartLineNumber() },
  });
  void receiverText;
}

function collectCalls(
  entry: SymbolEntry,
  rootDir: string,
  edges: GraphEdge[],
  symbols: Map<string, SymbolEntry>,
): void {
  const fn = entry.fnNode;
  fn.forEachDescendant((d) => {
    if (!Node.isCallExpression(d)) return;
    const expr = d.getExpression();
    let target: SymbolEntry | undefined;
    if (Node.isIdentifier(expr)) {
      target = resolveIdentifier(expr, symbols);
    } else if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      target = symbols.get(name);
    }
    if (!target || target.nodeId === entry.nodeId) return;
    edges.push({
      id: `call:${entry.nodeId}->${target.nodeId}:${d.getStartLineNumber()}`,
      source: entry.nodeId,
      target: target.nodeId,
      relation: "calls",
      location: { file: relPath(rootDir, fn.getSourceFile().getFilePath()), line: d.getStartLineNumber() },
    });
  });
}

function resolveIdentifier(
  ident: Identifier,
  symbols: Map<string, SymbolEntry>,
): SymbolEntry | undefined {
  const direct = symbols.get(ident.getText());
  if (direct) return direct;
  const defs = ident.getDefinitionNodes();
  for (const def of defs) {
    if (Node.isFunctionDeclaration(def) && def.getName()) {
      const id = makeId(
        def.getSourceFile().getFilePath(),
        def.getName()!,
      );
      const e = symbols.get(id) ?? symbols.get(def.getName()!);
      if (e) return e;
    }
    if (Node.isVariableDeclaration(def)) {
      const e = symbols.get(def.getName());
      if (e) return e;
    }
  }
  return undefined;
}

function makeId(file: string, name: string): string {
  return `fn:${file}:${name}`;
}

function joinPaths(mount: string, local: string): string {
  if (!mount) return local;
  const m = mount.replace(/\/+$/, "");
  const l = local.startsWith("/") ? local : "/" + local;
  if (l === "/") return m || "/";
  return m + l;
}

function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const out: GraphEdge[] = [];
  for (const e of edges) {
    const key = `${e.source}|${e.target}|${e.relation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
