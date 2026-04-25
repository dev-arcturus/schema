"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useStore } from "@/state/store";
import { layoutGraph } from "@/lib/layout";
import { RELATION_STYLE } from "./edges/relationStyle";
import { RouteNode } from "./nodes/RouteNode";
import { FunctionNode } from "./nodes/FunctionNode";
import { GraphBeforeAfterToggle } from "./GraphBeforeAfterToggle";

const nodeTypes: NodeTypes = {
  route: RouteNode,
  function: FunctionNode,
};

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner() {
  const graph = useStore((s) => s.graph);
  const selection = useStore((s) => s.selection);
  const failureFlash = useStore((s) => s.failureFlash);
  const recentlyAdded = useStore((s) => s.recentlyAdded);
  const focusTargetIds = useStore((s) => s.focusTargetIds);
  const hoverHighlightIds = useStore((s) => s.hoverHighlightIds);
  const violations = useStore((s) => s.violations);
  const violationNodeIds = useMemo(() => {
    const s = new Set<string>();
    for (const v of violations) for (const id of v.nodeIds) s.add(id);
    return s;
  }, [violations]);
  const coveredNodeIds = useStore((s) => s.coveredNodeIds);
  const coverageVisible = useStore((s) => s.coverageVisible);
  const visibleKinds = useStore((s) => s.visibleKinds);
  const changedNodeIds = useStore((s) => s.changedNodeIds);
  const changedEdgeIds = useStore((s) => s.changedEdgeIds);
  const selectNode = useStore((s) => s.selectNode);
  const selectEdge = useStore((s) => s.selectEdge);
  const clearSelection = useStore((s) => s.clearSelection);
  const rf = useReactFlow();

  const planState = useStore((s) => s.planState);
  const executingTargetId = useStore((s) => s.executingTargetId);

  // C: Before/after toggle
  const showGraphBefore = useStore((s) => s.showGraphBefore);
  const graphSnapshot = useStore((s) => s.graphSnapshot);
  const activeGraph = showGraphBefore && graphSnapshot ? graphSnapshot : graph;

  const ghostEdges = useMemo(() => {
    if (!activeGraph) return [] as { id: string; source: string; target: string }[];
    if (planState.phase !== "preview") return [];
    const edges: { id: string; source: string; target: string }[] = [];
    for (const step of planState.plan.steps) {
      if (step.kind !== "op") continue;
      if (step.opName === "addMiddleware") {
        const mw = step.params as { middleware?: string; middlewareFile?: string };
        if (mw.middleware && mw.middlewareFile) {
          edges.push({
            id: `ghost:mw:${step.targetId}->${mw.middleware}`,
            source: step.targetId,
            target: `fn:${mw.middlewareFile}:${mw.middleware}`,
          });
        }
      }
    }
    return edges;
  }, [activeGraph, planState]);

  const filteredGraph = useMemo(() => {
    if (!activeGraph) return null;
    const visibleSet = new Set(
      activeGraph.nodes
        .filter((n) => visibleKinds[n.kind] !== false)
        .map((n) => n.id),
    );
    return {
      ...activeGraph,
      nodes: activeGraph.nodes.filter((n) => visibleSet.has(n.id)),
      edges: activeGraph.edges.filter(
        (e) => visibleSet.has(e.source) && visibleSet.has(e.target),
      ),
      clusters: activeGraph.clusters.map((c) => ({
        ...c,
        nodeIds: c.nodeIds.filter((id) => visibleSet.has(id)),
      })),
    };
  }, [activeGraph, visibleKinds]);

  const layout = useMemo(
    () =>
      filteredGraph
        ? layoutGraph(filteredGraph)
        : { positions: new Map(), clusters: [] as ReturnType<typeof layoutGraph>["clusters"] },
    [filteredGraph],
  );

  const flowNodes: Node[] = useMemo(() => {
    if (!filteredGraph) return [];
    const out: Node[] = [];
    for (const n of filteredGraph.nodes) {
      const pos = layout.positions.get(n.id) ?? { x: 0, y: 0 };
      const isRoute = n.kind === "route_handler" && n.meta?.httpMethod;
      const failed = !!(
        failureFlash &&
        failureFlash.targetId === n.id &&
        failureFlash.until > Date.now()
      );
      const isNew = !!(
        recentlyAdded &&
        recentlyAdded.nodeIds.has(n.id) &&
        recentlyAdded.until > Date.now()
      );
      const isFocus = focusTargetIds.includes(n.id);
      const isHovered = hoverHighlightIds.includes(n.id);
      const isViolating = violationNodeIds.has(n.id);
      const isExecuting = executingTargetId === n.id;
      const isChanged = changedNodeIds.has(n.id) && !isNew;
      const isUncovered =
        coverageVisible && !coveredNodeIds.has(n.id) && n.kind !== "external";
      const dimmed =
        hoverHighlightIds.length > 0 && !isHovered;
      const baseCls = isExecuting
        ? "schema-node-executing"
        : isNew
          ? "schema-node-new"
          : isChanged
            ? "schema-node-changed"
            : isFocus
              ? "schema-node-focus"
              : isHovered
                ? "schema-node-hover"
                : isViolating
                  ? "schema-node-violation"
                  : dimmed
                    ? "schema-node-dim"
                    : "";
      const cls = isUncovered
        ? `${baseCls} schema-node-uncovered`.trim()
        : baseCls;
      out.push({
        id: n.id,
        type: isRoute ? "route" : "function",
        position: { x: pos.x, y: pos.y },
        data: { node: n, failed, isNew, isFocus, isViolating, isUncovered, isExecuting },
        selected: selection?.kind === "node" && selection.id === n.id,
        draggable: true,
        className: cls,
        width: 220,
        height: 60,
      });
    }
    return out;
  }, [
    filteredGraph,
    layout,
    selection,
    failureFlash,
    recentlyAdded,
    focusTargetIds,
    hoverHighlightIds,
    violationNodeIds,
    coveredNodeIds,
    coverageVisible,
    executingTargetId,
    changedNodeIds,
  ]);

  const flowEdges: Edge[] = useMemo(() => {
    if (!filteredGraph) return [];
    const known = new Set(filteredGraph.nodes.map((n) => n.id));
    return filteredGraph.edges
      .filter((e) => {
        const style = RELATION_STYLE[e.relation];
        if (style.hidden) return false;
        return known.has(e.source) && known.has(e.target);
      })
      .map((e) => {
        const style = RELATION_STYLE[e.relation];
        const isSelected = selection?.kind === "edge" && selection.id === e.id;
        const isNew = !!(
          recentlyAdded &&
          recentlyAdded.edgeIds.has(e.id) &&
          recentlyAdded.until > Date.now()
        );
        const isChanged = changedEdgeIds.has(e.id) && !isNew;
        const highlighted = isNew || isChanged;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep",
          animated: e.relation === "applies_middleware" || highlighted,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: highlighted ? "hsl(142 70% 60%)" : style.stroke,
          },
          style: {
            stroke: highlighted ? "hsl(142 70% 60%)" : style.stroke,
            strokeWidth: (highlighted ? style.width + 1 : style.width) + (isSelected ? 0.5 : 0),
            ...(style.dash ? { strokeDasharray: style.dash } : {}),
            opacity: isSelected || highlighted ? 1 : 0.9,
          },
          className: isNew ? "schema-edge-animate" : undefined,
          data: { relation: e.relation },
        };
      });
  }, [filteredGraph, selection, recentlyAdded, changedEdgeIds]);

  const allEdges: Edge[] = useMemo(() => {
    const known = new Set((filteredGraph?.nodes ?? []).map((n) => n.id));
    const ghosts: Edge[] = ghostEdges
      .filter((g) => known.has(g.source) && known.has(g.target))
      .map((g) => ({
        id: g.id,
        source: g.source,
        target: g.target,
        type: "smoothstep",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: "hsl(214 95% 67%)",
        },
        style: {
          stroke: "hsl(214 95% 67%)",
          strokeWidth: 1.5,
          strokeDasharray: "2 5",
          opacity: 0.85,
        },
      }));
    return [...flowEdges, ...ghosts];
  }, [flowEdges, ghostEdges, filteredGraph]);

  // Force a redraw shortly after a failure flash so it can clear
  useEffect(() => {
    if (!failureFlash) return;
    const t = setTimeout(() => useStore.setState({ failureFlash: null }), 4000);
    return () => clearTimeout(t);
  }, [failureFlash]);

  // Auto-clear recentlyAdded
  useEffect(() => {
    if (!recentlyAdded) return;
    const ms = recentlyAdded.until - Date.now();
    if (ms <= 0) {
      useStore.setState({ recentlyAdded: null });
      return;
    }
    const t = setTimeout(
      () => useStore.setState({ recentlyAdded: null }),
      ms,
    );
    return () => clearTimeout(t);
  }, [recentlyAdded]);

  // Auto-zoom to focus targets when a plan starts running
  useEffect(() => {
    if (focusTargetIds.length === 0 || !activeGraph) return;
    const targets = focusTargetIds
      .map((id) => layout.positions.get(id))
      .filter((p): p is { x: number; y: number; id: string } => Boolean(p));
    if (targets.length === 0) return;
    const xs = targets.map((p) => p.x);
    const ys = targets.map((p) => p.y);
    const minX = Math.min(...xs) - 80;
    const minY = Math.min(...ys) - 80;
    const maxX = Math.max(...xs) + 300;
    const maxY = Math.max(...ys) + 140;
    rf.fitBounds(
      { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      { duration: 600, padding: 0.1 },
    );
  }, [focusTargetIds, activeGraph, layout, rf]);

  // C: Auto-zoom to executing target
  useEffect(() => {
    if (!executingTargetId || !activeGraph) return;
    const pos = layout.positions.get(executingTargetId);
    if (!pos) return;
    rf.fitBounds(
      { x: pos.x - 100, y: pos.y - 80, width: 420, height: 220 },
      { duration: 400, padding: 0.2 },
    );
  }, [executingTargetId, activeGraph, layout, rf]);

  return (
    <>
      <ReactFlow
        nodes={flowNodes}
        edges={allEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.0, minZoom: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        onNodeClick={(_, node) => selectNode(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => clearSelection()}
        nodesDraggable
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="hsl(220 14% 14%)"
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!bg-canvas-panel"
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          bgColor="hsl(220 14% 6%)"
          maskColor="hsl(220 14% 4% / 0.55)"
          maskStrokeColor="hsl(220 14% 22%)"
          maskStrokeWidth={2}
          nodeColor={(n) => {
            const k = (n.data as { node?: { kind?: string } })?.node?.kind;
            switch (k) {
              case "route_handler":
                return "hsl(214 95% 67%)";
              case "service":
                return "hsl(160 70% 55%)";
              case "data_access":
                return "hsl(45 95% 60%)";
              case "middleware":
                return "hsl(280 70% 70%)";
              default:
                return "hsl(220 14% 35%)";
            }
          }}
          nodeStrokeColor="hsl(220 14% 8%)"
          nodeStrokeWidth={1}
          nodeBorderRadius={2}
          ariaLabel="minimap"
        />
      </ReactFlow>
      <GraphBeforeAfterToggle />
    </>
  );
}
