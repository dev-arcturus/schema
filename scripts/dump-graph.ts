import path from "node:path";
import { extract } from "../extractor/extract";

async function main() {
  const repo = path.resolve(
    process.cwd(),
    process.argv[2] ?? "fixtures/demo-app",
  );
  const result = await extract(repo, { skipCache: true });
  const graph = result.graph;
  console.log(
    `# cluster source: ${result.clusterSource}${result.clusterReason ? ` (${result.clusterReason})` : ""}`,
  );
  console.log(`# clusters: ${graph.clusters.length}`);
  for (const c of graph.clusters) {
    console.log(`  - ${c.name} (${c.nodeIds.length} nodes)`);
  }

console.log(`# nodes: ${graph.nodes.length}`);
for (const n of graph.nodes) {
  const meta = n.meta?.httpMethod
    ? ` [${n.meta.httpMethod} ${n.meta.httpPath}]`
    : "";
  console.log(`  - ${n.kind.padEnd(14)} ${n.name}${meta}  (${n.file})`);
}

console.log(`\n# edges: ${graph.edges.length}`);
const counts: Record<string, number> = {};
for (const e of graph.edges) {
  counts[e.relation] = (counts[e.relation] ?? 0) + 1;
}
console.log("by relation:", counts);

const interesting = graph.edges.filter(
  (e) => e.relation === "applies_middleware" || e.relation === "registers_route",
);
for (const e of interesting) {
  console.log(`  ${e.relation.padEnd(20)} ${e.source}  ->  ${e.target}`);
}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
