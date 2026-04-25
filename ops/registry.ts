import type { Op, GraphTarget } from "./types";

const registry = new Map<string, Op>();

export function registerOp(op: Op): void {
  registry.set(op.name, op);
}

export function getOp(name: string): Op | undefined {
  return registry.get(name);
}

export function listOps(): Op[] {
  return Array.from(registry.values());
}

export function applicableOps(target: GraphTarget): Op[] {
  return listOps().filter((op) => op.appliesTo(target));
}
