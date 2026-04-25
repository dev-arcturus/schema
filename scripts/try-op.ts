import path from "node:path";
import { extract } from "../extractor/extract";
import { execute } from "../executor/execute";

async function main() {
  const repo = path.resolve(process.cwd(), "fixtures/demo-app");
  const { graph } = await extract(repo, { skipCache: true });

  const route = graph.nodes.find(
    (n) =>
      n.kind === "route_handler" &&
      n.meta?.httpMethod === "GET" &&
      n.meta?.httpPath === "/todos",
  );
  if (!route) {
    console.error("could not locate GET /todos route node");
    process.exit(1);
  }

  console.log("applying addMiddleware to:", route.name);
  const result = await execute({
    repoPath: repo,
    graph,
    opName: "addMiddleware",
    target: { kind: "node", node: route, graph },
    params: {
      middleware: "requireAuth",
      middlewareFile: "src/middleware/auth.ts",
    },
  });

  if (result.ok) {
    console.log("\n=== SUCCESS ===");
    console.log(result.description);
    console.log("\n--- diff ---");
    console.log(result.diff);
    console.log(`\n--- test run (${result.testRun.durationMs}ms) ---`);
    console.log(result.testRun.output.split("\n").slice(-15).join("\n"));
  } else {
    console.log("\n=== FAILURE ===");
    console.log(result.error);
    if (result.diff) {
      console.log("\n--- attempted diff ---");
      console.log(result.diff);
    }
    if (result.testRun) {
      console.log("\n--- test output ---");
      console.log(result.testRun.output.split("\n").slice(-20).join("\n"));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
