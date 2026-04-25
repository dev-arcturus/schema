import { NextResponse } from "next/server";
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
  try {
    const body = (await req.json()) as Body;
    const resolved = await resolveRepo({
      source: "local",
      value: body.repoPath ?? "fixtures/demo-app",
    });
    const repoPath = resolved.rootDir;
    const graph: Graph = { ...body.graph, rootDir: repoPath };

    if (body.step.kind === "op") {
      return NextResponse.json(await runOpStep(repoPath, graph, body.step, body.intent));
    } else {
      return NextResponse.json(await runFreeformStep(repoPath, body.step, body.intent));
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "execute-step failed",
        diff: "",
        filesChanged: [],
      },
      { status: 500 },
    );
  }
}

async function runOpStep(
  repoPath: string,
  graph: Graph,
  step: Extract<Step, { kind: "op" }>,
  intent: string,
) {
  const op = getOp(step.opName);
  if (!op) {
    return failure("unknown op: " + step.opName, [], step.description);
  }

  const node = graph.nodes.find((n) => n.id === step.targetId);
  if (!node) {
    return failure("target not in graph: " + step.targetId, [], step.description);
  }
  const target: GraphTarget = { kind: "node", node, graph };

  const parsed = op.paramsSchema.safeParse(step.params);
  if (!parsed.success) {
    return failure(
      parsed.error.issues.map((i) => i.message).join("; "),
      [],
      step.description,
    );
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
    return failure(
      err instanceof Error ? err.message : "op failed before save",
      [],
      step.description,
    );
  }

  // No-op: op detected nothing to change (idempotent) — skip tests, empty patch
  if (applyResult.filesChanged.length === 0) {
    return {
      ok: true,
      diff: "",
      filesChanged: [],
      description: applyResult.description,
      graphPatch: { addNodes: [], removeNodes: [], addEdges: [], removeEdges: [] },
      testOutput: "",
      durationMs: 0,
    };
  }

  await snapshot.recordMany(repoPath, applyResult.filesChanged);

  try {
    await project.save();
  } catch (err) {
    await snapshot.rollback();
    return failure(
      err instanceof Error ? err.message : "save failed",
      applyResult.filesChanged,
      step.description,
    );
  }

  const diff = await computeDiff(snapshot, repoPath);
  const testRun = await runTests(repoPath);

  if (!testRun.passed) {
    await snapshot.rollback();
    return {
      ok: false,
      error: extractFirstFailure(testRun.output),
      explanation: await explainFailure(
        extractFirstFailure(testRun.output),
        testRun.output,
      ),
      diff,
      filesChanged: applyResult.filesChanged,
      description: applyResult.description,
      testOutput: testRun.output,
    };
  }

  const graphPatch = op.graphPatch(target, parsed.data, applyResult);
  const intentMatch = await intentCheck({
    userIntent: intent,
    stepDescription: step.description,
    diff,
  });

  return {
    ok: true,
    diff,
    filesChanged: applyResult.filesChanged,
    description: applyResult.description,
    graphPatch,
    testOutput: testRun.output,
    durationMs: testRun.durationMs,
    intentCheck: intentMatch,
  };
}

async function runFreeformStep(
  repoPath: string,
  step: Extract<Step, { kind: "freeform" }>,
  intent: string,
) {
  const snapshot = new Snapshot();
  // Snapshot passed into applyFreeform so it covers ALL files (targets + dependents)

  let result;
  try {
    result = await applyFreeform(repoPath, step.files, step.description, snapshot);
  } catch (err) {
    await snapshot.rollback();
    return failure(
      err instanceof Error ? err.message : "freeform apply failed",
      [],
      step.description,
    );
  }

  const diff = await computeDiff(snapshot, repoPath);
  const testRun = await runTests(repoPath);

  if (!testRun.passed) {
    await snapshot.rollback();
    return {
      ok: false,
      error: extractFirstFailure(testRun.output),
      explanation: await explainFailure(
        extractFirstFailure(testRun.output),
        testRun.output,
      ),
      diff,
      filesChanged: result.filesChanged,
      description: result.description,
      testOutput: testRun.output,
    };
  }

  const intentMatch = await intentCheck({
    userIntent: intent,
    stepDescription: step.description,
    diff,
  });

  return {
    ok: true,
    diff,
    filesChanged: result.filesChanged,
    description: result.description,
    testOutput: testRun.output,
    durationMs: testRun.durationMs,
    intentCheck: intentMatch,
    graphPatch: { addNodes: [], removeNodes: [], addEdges: [], removeEdges: [] },
  };
}

function failure(error: string, filesChanged: string[], description: string) {
  return { ok: false, error, filesChanged, description, diff: "" };
}

function extractFirstFailure(output: string): string {
  const lines = output.split("\n");
  const failLine = lines.find(
    (l) => /FAIL/.test(l) || /Error:/.test(l) || /AssertionError/.test(l),
  );
  return (failLine ?? lines[lines.length - 2] ?? "tests failed").trim();
}
