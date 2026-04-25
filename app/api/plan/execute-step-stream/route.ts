import path from "node:path";
import { Project } from "ts-morph";
import { resolveRepo } from "@/lib/resolveRepo";
import { explainFailure } from "@/lib/explainFailure";
import { Snapshot } from "@/executor/snapshot";
import { computeDiff } from "@/executor/diff";
import { runTests } from "@/executor/runTests";
import { applyFreeform } from "@/executor/freeform";
import { getOp } from "@/ops/registry";
import "@/ops";
import type { Graph } from "@/extractor/types";
import type { GraphTarget } from "@/ops/types";
import type { Step } from "@/lib/planSchema";
import { intentCheck } from "@/lib/intentCheck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  repoPath?: string;
  graph: Graph;
  step: Step;
  intent: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(enc.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const resolved = await resolveRepo({
          source: "local",
          value: body.repoPath ?? "fixtures/demo-app",
        });
        const repoPath = resolved.rootDir;
        const graph: Graph = { ...body.graph, rootDir: repoPath };

        send({ type: "phase", phase: "applying" });

        if (body.step.kind === "op") {
          await runOpStep(repoPath, graph, body.step, body.intent, send);
        } else {
          await runFreeformStep(repoPath, body.step, body.intent, send);
        }
      } catch (err) {
        send({
          type: "result",
          ok: false,
          error: err instanceof Error ? err.message : "execute-step failed",
          diff: "",
          filesChanged: [],
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}

type Send = (event: Record<string, unknown>) => void;

async function runOpStep(
  repoPath: string,
  graph: Graph,
  step: Extract<Step, { kind: "op" }>,
  intent: string,
  send: Send,
): Promise<void> {
  const op = getOp(step.opName);
  if (!op) {
    send({
      type: "result",
      ok: false,
      error: "unknown op: " + step.opName,
      diff: "",
      filesChanged: [],
      description: step.description,
    });
    return;
  }
  const node = graph.nodes.find((n) => n.id === step.targetId);
  if (!node) {
    send({
      type: "result",
      ok: false,
      error: "target not in graph: " + step.targetId,
      diff: "",
      filesChanged: [],
      description: step.description,
    });
    return;
  }
  const target: GraphTarget = { kind: "node", node, graph };

  const parsed = op.paramsSchema.safeParse(step.params);
  if (!parsed.success) {
    send({
      type: "result",
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
      diff: "",
      filesChanged: [],
      description: step.description,
    });
    return;
  }

  const project = new Project({
    tsConfigFilePath: path.join(repoPath, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });
  project.addSourceFilesAtPaths(`${repoPath}/src/**/*.ts`);

  const snapshot = new Snapshot();
  let applyResult;
  try {
    applyResult = await op.apply(target, parsed.data, project);
  } catch (err) {
    send({
      type: "result",
      ok: false,
      error: err instanceof Error ? err.message : "op failed before save",
      diff: "",
      filesChanged: [],
      description: step.description,
    });
    return;
  }

  // No-op: op detected nothing to change (idempotent) — skip tests, empty patch
  if (applyResult.filesChanged.length === 0) {
    send({
      type: "result",
      ok: true,
      diff: "",
      filesChanged: [],
      description: applyResult.description,
      graphPatch: { addNodes: [], removeNodes: [], addEdges: [], removeEdges: [] },
      testOutput: "",
      durationMs: 0,
    });
    return;
  }

  await snapshot.recordMany(repoPath, applyResult.filesChanged);
  await project.save();

  const diff = await computeDiff(snapshot, repoPath);
  send({ type: "diff", diff, filesChanged: applyResult.filesChanged });
  send({ type: "phase", phase: "testing" });

  const testRun = await runTests(repoPath, (chunk) => {
    send({ type: "test_output", chunk });
  });

  if (!testRun.passed) {
    await snapshot.rollback();
    const error = extractFirstFailure(testRun.output);
    const explanation = await explainFailure(error, testRun.output);
    send({
      type: "result",
      ok: false,
      error,
      explanation,
      diff,
      filesChanged: applyResult.filesChanged,
      description: applyResult.description,
      testOutput: testRun.output,
    });
    return;
  }

  const graphPatch = op.graphPatch(target, parsed.data, applyResult);
  send({ type: "phase", phase: "verifying_intent" });
  const intentMatch = await intentCheck({
    userIntent: intent,
    stepDescription: step.description,
    diff,
  });

  send({
    type: "result",
    ok: true,
    diff,
    filesChanged: applyResult.filesChanged,
    description: applyResult.description,
    graphPatch,
    testOutput: testRun.output,
    durationMs: testRun.durationMs,
    intentCheck: intentMatch,
  });
}

async function runFreeformStep(
  repoPath: string,
  step: Extract<Step, { kind: "freeform" }>,
  intent: string,
  send: Send,
): Promise<void> {
  const MAX_RETRIES = 3;
  const baseDescription = step.description;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      send({ type: "phase", phase: "applying" as const });
    }

    const snapshot = new Snapshot();

    let result;
    try {
      result = await applyFreeform(repoPath, step.files, step.description, snapshot);
    } catch (err) {
      await snapshot.rollback();
      const errMsg = err instanceof Error ? err.message : "freeform apply failed";
      if (attempt < MAX_RETRIES && process.env.ANTHROPIC_API_KEY) {
        step = {
          ...step,
          description: `${baseDescription}\n\nATTEMPT ${attempt + 1} FAILED during apply: ${errMsg}\nFix: make sure all imports reference existing packages and files. Do not invent helper functions without defining them.`,
        };
        continue;
      }
      send({
        type: "result",
        ok: false,
        error: errMsg,
        diff: "",
        filesChanged: [],
        description: step.description,
      });
      return;
    }

    if (result.filesChanged.length === 0) {
      send({
        type: "result",
        ok: true,
        diff: "",
        filesChanged: [],
        description: result.description,
        graphPatch: { addNodes: [], removeNodes: [], addEdges: [], removeEdges: [] },
        testOutput: "",
        durationMs: 0,
      });
      return;
    }

    const diff = await computeDiff(snapshot, repoPath);
    send({ type: "diff", diff, filesChanged: result.filesChanged });
    send({ type: "phase", phase: "testing" });

    const testRun = await runTests(repoPath, (chunk) => {
      send({ type: "test_output", chunk });
    });

    if (!testRun.passed) {
      await snapshot.rollback();

      if (attempt < MAX_RETRIES && process.env.ANTHROPIC_API_KEY) {
        const error = extractFirstFailure(testRun.output);
        const tail = testRun.output.split("\n").slice(-25).join("\n");
        step = {
          ...step,
          description: `${baseDescription}\n\nATTEMPT ${attempt + 1} FAILED. Tests broke with: ${error}\n\nTest output:\n${tail}\n\nIMPORTANT: Fix the specific error above. Common mistakes to avoid:\n- Do not reference functions that don't exist (like makeUserRepo/makeTodoRepo) unless you define them\n- Do not change import package names (bcryptjs must stay bcryptjs)\n- If you change a function signature, update ALL callers\n- Keep .js extensions in relative imports`,
        };
        continue;
      }

      const error = extractFirstFailure(testRun.output);
      const explanation = await explainFailure(error, testRun.output);
      send({
        type: "result",
        ok: false,
        error,
        explanation,
        diff,
        filesChanged: result.filesChanged,
        description: result.description,
        testOutput: testRun.output,
      });
      return;
    }

    // Tests passed!
    send({ type: "phase", phase: "verifying_intent" });
    const intentMatch = await intentCheck({
      userIntent: intent,
      stepDescription: step.description,
      diff,
    });

    send({
      type: "result",
      ok: true,
      diff,
      filesChanged: result.filesChanged,
      description: result.description,
      testOutput: testRun.output,
      durationMs: testRun.durationMs,
      intentCheck: intentMatch,
      graphPatch: { addNodes: [], removeNodes: [], addEdges: [], removeEdges: [] },
    });
    return;
  } // end retry loop
}

function extractFirstFailure(output: string): string {
  const lines = output.split("\n");
  const failLine = lines.find(
    (l) => /FAIL/.test(l) || /Error:/.test(l) || /AssertionError/.test(l),
  );
  return (failLine ?? lines[lines.length - 2] ?? "tests failed").trim();
}
