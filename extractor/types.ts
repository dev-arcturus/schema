export type NodeKind =
  | "route_handler"
  | "service"
  | "data_access"
  | "middleware"
  | "model"
  | "external"
  | "utility";

export type EdgeRelation =
  | "imports"
  | "calls"
  | "registers_route"
  | "applies_middleware";

export type GraphNode = {
  id: string;
  kind: NodeKind;
  name: string;
  file: string;
  range: { start: number; end: number };
  cluster?: string;
  meta?: {
    httpMethod?: string;
    httpPath?: string;
    routerName?: string;
    isExported?: boolean;
    summary?: string;
  };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
  location?: { file: string; line: number };
};

export type GraphCluster = {
  id: string;
  name: string;
  nodeIds: string[];
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  rootDir: string;
};
