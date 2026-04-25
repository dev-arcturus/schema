/**
 * Hand-written description of the ops registry for the LLM planner.
 * Updated when ops are added or their params change.
 */
export const OPS_REGISTRY_DESCRIPTION = `
Available ops:

addMiddleware
  Description: Inserts a middleware identifier before the final handler argument
    of an Express route registration call (e.g. router.get(...)). Auto-imports the
    middleware from its source file if needed.
  Targets: nodes with kind=route_handler AND meta.httpMethod set (Express routes).
  Params shape:
    {
      "middleware": "<middleware function name, e.g. requireAuth>",
      "middlewareFile": "<repo-relative file path of the middleware, e.g. src/middleware/auth.ts>"
    }

addCaching
  Description: Generates src/cache/memoize.ts (if missing) and emits a
    \`<name>Cached\` const wrapper next to the original function.
  Targets: any function-like node EXCEPT route_handler / middleware / external / model.
  Params shape:
    {
      "cacheKey": "<JS expression evaluated against args, e.g. 'args[0]' or 'JSON.stringify(args)'>",
      "ttlSeconds": <integer seconds, default 60>
    }

wrapTransformation
  Description: Renames the original function to <name>Inner, generates
    src/wrappers/index.ts (if missing), and re-exports a wrapped const named like
    the original (one of withLogging | withRetry | withTelemetry).
  Targets: any function-like node EXCEPT external / model. Avoid for route handlers.
  Params shape:
    {
      "variant": "logging" | "retry" | "telemetry",
      "retries": <integer 1-10, only meaningful for variant=retry, otherwise pass 3>
    }

extractModule
  Description: Moves an exported function declaration into a new file and
    rewrites every importer across the project. Preserves the public name.
  Targets: any non-route function node. Function MUST be a declared, exported
    \`function\` (not a const). New file path must end in .ts.
  Params shape:
    {
      "newFile": "<repo-relative new file path, e.g. src/utils/helpers.ts>"
    }

Notes for the planner:
- ALWAYS use the exact node "id" from the graph as targetId. Do not paraphrase
  or shorten it. The id format is either "fn:<file>:<name>" or
  "route:<file>:<METHOD>:<httpPath>:<line>".
- An op step may fail at runtime (e.g. middleware already applied, function
  already wrapped). Include those steps anyway if they correspond to user
  intent — the executor surfaces the failure cleanly.
- Use a freeform step ONLY when no registered op fits. Free-form steps emit
  full file contents; the executor parses them through TypeScript before
  writing and rolls back if the test suite fails.
`.trim();
