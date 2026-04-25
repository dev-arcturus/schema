"use client";

import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";
import type { OpDescriptor, ParamField } from "@/ops/types";
import type { Graph, GraphNode } from "@/extractor/types";

export function ParamsForm({ op }: { op: OpDescriptor }) {
  const params = useStore((s) => s.pendingOp?.params ?? {});
  const setParam = useStore((s) => s.setOpParam);
  const graph = useStore((s) => s.graph);
  if (!graph) return null;

  return (
    <div className="flex flex-col gap-3">
      {op.paramsUI.map((field) => (
        <FieldRow
          key={field.name}
          field={field}
          value={params[field.name]}
          onChange={(v) => setParam(field.name, v)}
          graph={graph}
        />
      ))}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  graph,
}: {
  field: ParamField;
  value: unknown;
  onChange: (v: unknown) => void;
  graph: Graph;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-2xs uppercase tracking-wider text-canvas-subtle">
        {field.label}
      </span>
      {renderInput(field, value, onChange, graph)}
    </label>
  );
}

function renderInput(
  field: ParamField,
  value: unknown,
  onChange: (v: unknown) => void,
  graph: Graph,
) {
  if (field.type === "text") {
    return (
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : Number(value ?? 0)}
        min={field.min}
        max={field.max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "graph-select") {
    const candidates: GraphNode[] = graph.nodes.filter((n) =>
      field.filter.kind ? n.kind === field.filter.kind : true,
    );
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">— select —</option>
        {candidates.map((n) => (
          <option key={n.id} value={`graphref:${n.id}`}>
            {n.name}  ·  {n.file}
          </option>
        ))}
      </select>
    );
  }
  return null;
}

const inputCls = cn(
  "w-full rounded border border-canvas-border bg-canvas-bg/60 px-2.5 py-1.5",
  "text-sm text-canvas-ink placeholder:text-canvas-subtle",
  "outline-none focus:border-accent",
);
