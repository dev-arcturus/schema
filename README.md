# Schema

Brownfield architectural editor for TypeScript codebases.

Schema reverse-engineers the architecture of an existing TypeScript repo into a graph you can directly edit. Click a node or edge, pick an architectural operation, and Schema applies the change as an AST transformation, gated by the repo's test suite, with atomic rollback on failure.

The thesis: architecture should be a directly manipulable artifact, not a chat target.

## Run it

```bash
npm install
npm run dev          # canvas at http://localhost:3000
```

Optional, for the LLM clustering pass and one-line failure explanations:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
```

Without the key, Schema falls back to directory-based clustering (one cluster per top-level dir under `src/`).

## What it does

1. Point at a TypeScript repo (a GitHub URL like `owner/repo` or a local path).
2. Schema clones the repo (if remote), reads its README, and runs a static-analysis pass over its source via [ts-morph](https://github.com/dsherret/ts-morph), extracting functions, imports, calls, Express route registrations, and middleware applications.
3. A second pass with Claude Sonnet 4.6 clusters the nodes into named architectural components, using the README's vocabulary as a hint.
4. The graph renders on a canvas. Click a node or edge to see the architectural operations that apply at that location.
5. Pick an op, parameterize it, hit *Apply*. Schema runs the AST transformation in memory, snapshots the affected files, writes them, spawns the repo's vitest suite, and either keeps the changes or rolls back to the snapshot on red. The graph updates to reflect the new structure.

## Ops

Four ops in v1:

- **addMiddleware** — apply a middleware to a route registration; auto-imports if needed.
- **addCaching** — wrap a service or data-access function with a TTL memoizer; generates `src/cache/memoize.ts` on first use.
- **wrapTransformation** — rebind an exported function to a higher-order wrapper (logging, retry, telemetry); generates `src/wrappers/index.ts` on first use.
- **extractModule** — move a function into a new file; rewrites importers across the project.

Each op declares a Zod schema for its parameters and a small UI metadata block for form rendering. The op never trusts itself for safety — the executor handles snapshot, save, test, and rollback atomically.

## The bundled demo

`fixtures/demo-app/` is a self-contained Express + sqlite + JWT app with a deliberate auth gap: `requireAuth` is defined and applied to `POST /todos` but not to `GET /todos` or `DELETE /todos/:id`. Click the unprotected route, apply the middleware op, watch the gap close — and watch the test suite stay green.

## Layout

```
app/                  Next.js App Router pages and API routes
components/canvas/    React Flow canvas, custom nodes/edges, panels
extractor/            ts-morph deterministic pass + Sonnet clustering pass
executor/             snapshot, apply, run tests, rollback
ops/                  the architectural vocabulary (addMiddleware, ...)
state/                Zustand store
lib/                  small utilities (resolveRepo, readme, layout)
fixtures/demo-app/    the bundled demo target
scripts/              CLI helpers (dump-graph, try-op)
```

## Tech

Next.js 15 + React 19, React Flow 12, Tailwind, Zustand, ts-morph, Vercel AI SDK + Anthropic, Zod, vitest, simple-git.

## Status

Prototype. Single language (TypeScript), single framework family (Express patterns are recognized natively; other frameworks are still graphed at the function level), four ops. No bidirectional sync — code edits made outside Schema while it's open do not flow back to the graph.
