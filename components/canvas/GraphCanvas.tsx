"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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

const nodeTypes: NodeTypes = {
  route: RouteNode,
  function: FunctionNode,
};

export function GraphCanvas() {
  const graph = useStore((s) => s.graph);
  const selection = useStore((s) => s.selection);
  const failureFlash = useStore((s) => s.failureFlash);
  const selectNode = useStore((s) => s.selectNode);
  const selectEdge = useStore((s) => s.selectEdge);
  const clearSelection = useStore((s) => s.clearSelection);

  const positions = useMemo(
    () => (graph ? layoutGraph(graph) : new Map()),
    [graph],
  );

  const flowNodes: Node[] = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.map((n) => {
      const pos = positions.get(n.id) ?? { x: 0, y: 0 };
      const isRoute = n.kind === "route_handler" && n.meta?.httpMethod;
      const failed =
        failureFlash &&
        failureFlash.targetId === n.id &&
        failureFlash.until > Date.now();
      return {
        id: n.id,
        type: isRoute ? "route" : "function",
        position: { x: pos.x, y: pos.y },
        data: { node: n, failed },
        selected: selection?.kind === "node" && selection.id === n.id,
        draggable: true,
      };
    });
  }, [graph, positions, selection, failureFlash]);

  const flowEdges: Edge[] = useMemo(() => {
    if (!graph) return [];
    const known = new Set(graph.nodes.map((n) => n.id));
    return graph.edges
      .filter((e) => {
        const style = RELATION_STYLE[e.relation];
        if (style.hidden) return false;
        return known.has(e.source) && known.has(e.target);
      })
      .map((e) => {
        const style = RELATION_STYLE[e.relation];
        const isSelected = selection?.kind === "edge" && selection.id === e.id;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep",
          animated: e.relation === "applies_middleware",
          label: style.label,
          labelStyle: { fill: "hsl(220 8% 60%)", fontSize: 10 },
          labelBgStyle: { fill: "hsl(220 14% 7%)" },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          style: {
            stroke: style.stroke,
            strokeWidth: style.width,
            ...(style.dash ? { strokeDasharray: style.dash } : {}),
            opacity: isSelected ? 1 : 0.85,
          },
          data: { relation: e.relation },
        };
      });
  }, [graph, selection]);

  // Force a redraw shortly after a failure flash so it can clear
  useEffect(() => {
    if (!failureFlash) return;
    const t = setTimeout(() => useStore.setState({ failureFlash: null }), 4000);
    return () => clearTimeout(t);
  }, [failureFlash]);

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
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
          maskColor="hsl(220 14% 4% / 0.7)"
          maskStrokeColor="hsl(220 14% 18%)"
          maskStrokeWidth={1}
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
          nodeStrokeColor="transparent"
          nodeStrokeWidth={0}
        />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
