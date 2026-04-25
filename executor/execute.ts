import path from "node:path";
import { Project } from "ts-morph";
import { getOp } from "@/ops/registry";
import "@/ops"; // side-effect register
import type { GraphTarget, OpApplyResult, OpGraphPatch } from "@/ops/types";
import type { Graph } from "@/extractor/types";
import { Snapshot } from "./snapshot";
import { computeDiff } from "./diff";
import { runTests, type TestRunResult } from "./runTests";

export type ExecuteSuccess = {
  ok: true;
  diff: string;
  filesChanged: string[];
  description: string;
  graphPatch: OpGraphPatch;
  testRun: TestRunResult;
};

export type ExecuteFailure = {
  ok: false;
  diff: string;
  description: string;
  error: string;
  testRun?: TestRunResult;
  filesChanged: string[];
};

export type ExecuteResult = ExecuteSuccess | ExecuteFailure;

export type ExecuteInput = {
  repoPath: string;
  graph: Graph;
  opName: string;
  target: GraphTarget;
  params: unknown;
  onTestChunk?: (chunk: string) => void;
};

export async function execute(input: ExecuteInput): Promise<ExecuteResult> {
  const op = getOp(input.opName);
  if (!op) {
    return failure({
      filesChanged: [],
      description: input.opName,
      diff: "",
      error: `unknown op: ${input.opName}`,
    });
  }

  const parsed = op.paramsSchema.safeParse(input.params);
  if (!parsed.success) {
    return failure({
      filesChanged: [],
      description: op.name,
      diff: "",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    });
  }

  const project = new Project({
    tsConfigFilePath: path.join(input.repoPath, "tsconfig.json"),
    skipAddingFilesFromTsConfig: false,
  });
  project.addSourceFilesAtPaths(`${input.repoPath}/src/**/*.ts`);

  const snapshot = new Snapshot();
  let applyResult: OpApplyResult;
  try {
    applyResult = await op.apply(input.target, parsed.data, project);
  } catch (err) {
    return failure({
      filesChanged: [],
      description: op.name,
      diff: "",
      error: err instanceof Error ? err.message : "op failed before save",
    });
  }

  await snapshot.recordMany(input.repoPath, applyResult.filesChanged);

  try {
    await project.save();
  } catch (err) {
    await snapshot.rollback();
    return failure({
      filesChanged: applyResult.filesChanged,
      description: applyResult.description,
      diff: "",
      error: err instanceof Error ? err.message : "save failed",
    });
  }

  const diff = await computeDiff(snapshot, input.repoPath);

  const testRun = await runTests(input.repoPath, input.onTestChunk);

  if (!testRun.passed) {
    await snapshot.rollback();
    return {
      ok: false,
      filesChanged: applyResult.filesChanged,
      description: applyResult.description,
      diff,
      error: extractFirstFailure(testRun.output),
      testRun,
    } satisfies ExecuteFailure;
  }

  const graphPatch = op.graphPatch(input.target, parsed.data, applyResult);
  return {
    ok: true,
    diff,
    filesChanged: applyResult.filesChanged,
    description: applyResult.description,
    graphPatch,
    testRun,
  } satisfies ExecuteSuccess;
}

function failure(f: Omit<ExecuteFailure, "ok">): ExecuteFailure {
  return { ok: false, ...f };
}

function extractFirstFailure(output: string): string {
  const lines = output.split("\n");
  const failLine = lines.find(
    (l) => /FAIL/.test(l) || /Error:/.test(l) || /AssertionError/.test(l),
  );
  return (failLine ?? lines[lines.length - 2] ?? "tests failed").trim();
}
