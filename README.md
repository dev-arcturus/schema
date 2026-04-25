# Schema

**The AI-native IDE for software architecture.**

You describe an architectural change in plain English. Schema turns the intent into a sequence of AST transformations, applies them through your repo's test suite, and shows the resulting graph mutate in real time. Tests gate every step. A red step rolls itself back, so the working tree never goes incoherent.

The thesis: today's AI tooling drops a chatbox into an editor designed before AI existed. Schema flips that — prompts are the foundation, the graph is the canvas, the test suite is the safety net.

## Run it

```bash
npm install
npm run dev          # canvas at http://localhost:3000
```

Optional, for the LLM clustering pass and one-line failure explanations:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env.local
```

Without the key, Schema falls back to directory-based clustering and a deterministic auth-asymmetry detector. Plan generation needs the key (the command bar is dimmed otherwise).

## The demo (60 seconds)

1. Empty state lists three sample repos and four sample prompts. Click *Express + JWT demo*, then *Extract architecture*. The bundled fixture loads instantly from cache; first-time extracts on real GitHub repos take ~25s.
2. The canvas comes up. The kind legend sits at the top, the prompt textbox at the bottom. The left rail surfaces eight architectural smells Sonnet found: missing middleware, asymmetric auth, hot functions without caching, files-in-the-wrong-place. Hover an insight to highlight the affected nodes.
3. Click `"Protect every unauthed resource route"` (or type your own). Sonnet streams a *Plan* — a numbered list of `addMiddleware` calls, each with a target node id, the middleware to apply, a risk badge, and a rationale.
4. Click *Apply plan*. Each step in turn: the executor opens a ts-morph project, runs the AST transformation in memory, snapshots the touched files, saves, spawns the repo's vitest suite, and waits. Test output streams into the panel as it runs. On green, Haiku double-checks that the diff matches the user's stated intent ("✓ intent verified"). On red, the snapshot rolls back, you see the attempted diff plus a one-line explanation, and the chain stops.
5. The graph picks up new edges. Newly-applied changes flash green. The conversation memory remembers what you just did so the next prompt can build on it.

## What's in the box

**Extractor** (`extractor/`) — ts-morph deterministic walk over `src/**/*.ts`. Functions, imports, call sites, Express route registrations with mount-prefix resolution (`POST /todos`, not `POST /`), middleware application detection, Next.js `app/.../page.tsx` and `app/.../route.ts` recognition. A second pass with Sonnet 4.6 clusters nodes into named components and refines kinds; falls back to directory-based clustering if the API key is missing.

**Executor** (`executor/`) — open ts-morph project → in-memory `op.apply` → snapshot affected files → write to disk → spawn vitest → on green return diff + graphPatch; on red restore files (delete any new ones) and surface attempted diff. The `execute-step-stream` endpoint pipes test stdout back as NDJSON so the UI shows live test output during the run.

**Ops** (`ops/`) — four AST transformations, each a small TypeScript module with a Zod params schema and an in-memory ts-morph unit test:
- `addMiddleware` — insert a middleware identifier before the final handler arg of a route registration. Auto-imports if needed.
- `addCaching` — generate `src/cache/memoize.ts` (if missing) and emit a `<name>Cached` const wrapper.
- `wrapTransformation` — rename original to `<name>Inner`, generate `src/wrappers/index.ts`, re-export a wrapped const (logging | retry | telemetry).
- `extractModule` — move a function to a new file, rewrite importers across the project.

**Planner** (`app/api/plan/`) — `/generate` accepts an intent + the graph + last-3-turn history and emits a Zod-validated Plan via `streamObject` so the UI can render the plan as it's being written. Each step is either an `op` call (preferred) or a `freeform` step that emits full file contents (last resort, parsed through ts-morph before write).

**Insights** (`app/api/insights/`) — Sonnet pass over the graph that surfaces architectural smells with one-click suggested prompts. Cached by graph hash. Falls back to a deterministic auth-asymmetry detector without the key.

**Renderer** (`app/`, `components/`, `state/`) — Next 15 + React Flow 12. Dagre LR layout, custom node types per kind, animated dashed edges for `applies_middleware`, ghost edges during plan preview, focus pulse on plan target nodes, animated green flash on graph mutation, color-coded minimap, kind filter, fuzzy node search (⌘K), README peek, repo summary banner, command bar at the bottom, plan panel above it, insights rail on the left, history rail in the inspector, keyboard cheat sheet (`?`).

## The bundled fixture

`fixtures/demo-app/` is a self-contained Express + TypeScript service backed by SQLite and protected by JWT, with a deliberate auth gap: `requireAuth` is defined and applied to `POST /todos` but not to `GET /todos` or `DELETE /todos/:id`. The natural prompt — *"protect every unauthed resource route"* — closes both gaps in a single multi-step plan.

The fixture's `.schema-cache/` is committed so the first extract is instant. 7/7 fixture tests stay green before and after the demo op.

## Tech

Next.js 15 + React 19, React Flow 12 + dagre, Tailwind, Zustand, ts-morph, Vercel AI SDK + Anthropic (Sonnet 4.6 for clustering / planning / insights, Haiku 4.5 for failure explanation and intent check), Zod, vitest, simple-git.

## Layout

```
app/                  Next.js App Router pages and API routes
  api/extract            POST — clone + parse + cluster + cache
  api/insights           POST — Sonnet finds architectural smells
  api/plan/generate      POST — streaming plan from prompt + graph
  api/plan/execute-step-stream  POST — run one step, stream test output
  api/source             POST — read a function's source via ts-morph range

components/canvas/    React Flow canvas, custom nodes/edges, panels, command bar
extractor/            ts-morph deterministic pass + Sonnet clustering pass + cache
executor/             snapshot, apply, run tests, rollback, freeform writer
ops/                  the architectural vocabulary (addMiddleware, ...)
state/                Zustand store
lib/                  resolveRepo, readme, layout, planSchema, intentCheck, …
fixtures/demo-app/    the bundled demo target (with .schema-cache pre-warmed)
scripts/              dump-graph, try-op, prewarm
```

## Status

Prototype. Single language (TypeScript), single framework family (Express + Next.js patterns recognized natively; other frameworks are still graphed at the function level), four ops, four sample prompts. No bidirectional sync — code edits made outside Schema while it's open do not flow back to the graph (yet).
