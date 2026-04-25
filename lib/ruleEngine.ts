import type { Graph, GraphNode, EdgeRelation } from "@/extractor/types";
import type { NodeMatcher, Predicate, Rule, Violation } from "./rules";

export function matchNode(node: GraphNode, m: NodeMatcher): boolean {
  if (m.kind && node.kind !== m.kind) return false;
  if (m.name && node.name !== m.name) return false;
  if (m.nameContains && !node.name.includes(m.nameContains)) return false;
  if (m.file && node.file !== m.file) return false;
  if (m.fileContains && !node.file.includes(m.fileContains)) return false;
  if (m.httpMethod) {
    const method = (node.meta?.httpMethod ?? "").toUpperCase();
    if (method !== m.httpMethod.toUpperCase()) return false;
  }
  if (m.httpPathContains) {
    const path = node.meta?.httpPath ?? "";
    if (!path.includes(m.httpPathContains)) return false;
  }
  if (m.cluster && node.cluster !== m.cluster) return false;
  return true;
}

function selectNodes(graph: Graph, m: NodeMatcher): GraphNode[] {
  return graph.nodes.filter((n) => matchNode(n, m));
}

function findEdges(
  graph: Graph,
  source: GraphNode,
  target: GraphNode,
  relation: EdgeRelation | undefined,
) {
  return graph.edges.filter(
    (e) =>
      e.source === source.id &&
      e.target === target.id &&
      (!relation || e.relation === relation),
  );
}

export function evaluateRule(graph: Graph, rule: Rule): Violation | null {
  if (!rule.enabled) return null;
  const p = rule.predicate;
  const offendingNodeIds = new Set<string>();

  if (p.type === "no_edge") {
    const sources = selectNodes(graph, p.source);
    const targets = selectNodes(graph, p.target);
    for (const s of sources) {
      for (const t of targets) {
        if (s.id === t.id) continue;
        if (findEdges(graph, s, t, p.relation).length > 0) {
          offendingNodeIds.add(s.id);
        }
      }
    }
  }

  if (p.type === "must_have_edge") {
    const sources = selectNodes(graph, p.source);
    for (const s of sources) {
      const targets = selectNodes(graph, p.target);
      let found = false;
      for (const t of targets) {
        if (findEdges(graph, s, t, p.relation).length > 0) {
          found = true;
          break;
        }
      }
      if (!found) offendingNodeIds.add(s.id);
    }
  }

  if (p.type === "must_not_exist") {
    const matches = selectNodes(graph, p.matcher);
    for (const n of matches) offendingNodeIds.add(n.id);
  }

  if (offendingNodeIds.size === 0) return null;
  return {
    ruleId: rule.id,
    ruleTitle: rule.title,
    severity: rule.severity,
    nodeIds: Array.from(offendingNodeIds),
    message: explainViolation(rule, Array.from(offendingNodeIds), graph),
    suggestedPrompt: rule.prompt,
  };
}

export function evaluateRules(graph: Graph, rules: Rule[]): Violation[] {
  const out: Violation[] = [];
  for (const rule of rules) {
    const v = evaluateRule(graph, rule);
    if (v) out.push(v);
  }
  return out;
}

function explainViolation(rule: Rule, nodeIds: string[], graph: Graph): string {
  const names = nodeIds
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter((n): n is GraphNode => Boolean(n))
    .slice(0, 4)
    .map((n) =>
      n.meta?.httpMethod ? `${n.meta.httpMethod} ${n.meta.httpPath}` : n.name,
    );
  const tail = nodeIds.length > 4 ? ` +${nodeIds.length - 4} more` : "";
  return `${rule.title} — ${nodeIds.length} violation(s): ${names.join(", ")}${tail}`;
}
