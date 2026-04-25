import path from "node:path";
import { computeCoveredNodeIds } from "../extractor/coverage";
import { extract } from "../extractor/extract";

async function main() {
  const repo = path.resolve(process.cwd(), "fixtures/demo-app");
  const result = await extract(repo, { skipCache: false });
  console.log(`graph nodes: ${result.graph.nodes.length}`);
  const covered = computeCoveredNodeIds(repo, result.graph);
  console.log(`covered: ${covered.size}/${result.graph.nodes.length}`);
}

main();
