import type { Project } from "ts-morph";
import type { z } from "zod";
import type { Graph, GraphEdge, GraphNode } from "@/extractor/types";

export type GraphTarget =
  | { kind: "node"; node: GraphNode; graph: Graph }
  | { kind: "edge"; edge: GraphEdge; graph: Graph };

export type OpApplyResult = {
  filesChanged: string[];
  description: string;
};

export type OpGraphPatch = {
  addNodes?: Graph["nodes"];
  removeNodes?: string[];
  addEdges?: Graph["edges"];
  removeEdges?: string[];
};

export type ParamField =
  | {
      name: string;
      label: string;
      type: "text";
      placeholder?: string;
      defaultValue?: string;
    }
  | {
      name: string;
      label: string;
      type: "number";
      defaultValue?: number;
      min?: number;
      max?: number;
    }
  | {
      name: string;
      label: string;
      type: "select";
      options: { value: string; label: string }[];
      defaultValue?: string;
    }
  | {
      name: string;
      label: string;
      type: "graph-select";
      filter: { kind?: string };
      valueShape: "name" | "name_and_file";
    };

export type Op<P extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  description: string;
  category: "middleware" | "caching" | "transform" | "extract";
  paramsSchema: P;
  paramsUI: ParamField[];
  appliesTo: (target: GraphTarget) => boolean;
  apply: (
    target: GraphTarget,
    params: z.infer<P>,
    project: Project,
  ) => Promise<OpApplyResult>;
  graphPatch: (
    target: GraphTarget,
    params: z.infer<P>,
    apply: OpApplyResult,
  ) => OpGraphPatch;
};

export type OpDescriptor = {
  name: string;
  description: string;
  category: Op["category"];
  paramsUI: ParamField[];
};

export function describeOp<P extends z.ZodTypeAny>(op: Op<P>): OpDescriptor {
  return {
    name: op.name,
    description: op.description,
    category: op.category,
    paramsUI: op.paramsUI,
  };
}
