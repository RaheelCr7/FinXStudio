"use client";
import { useCallback, useMemo, useState } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeChange, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Journey, LintIssue } from "@finx/journey-schema";
import { buildEdges, layout } from "@/lib/graph";
import { textOf } from "@/lib/edit";

type NodeData = { title: string; id: string; kind: string; blocks: number; selected: boolean; issues: number; entry: boolean };

function ScreenNode({ data }: NodeProps<Node<NodeData>>) {
  const cls = ["rf-node", data.kind === "branch" ? "branch" : data.kind === "terminal" ? "terminal" : "", data.selected ? "sel" : "", data.issues ? "bad" : ""].join(" ");
  return (
    <div className={cls}>
      <Handle type="target" position={Position.Top} style={{ background: "var(--border-strong)" }} />
      <div className="k">{data.entry ? "Start · " : ""}{data.kind === "screen" ? "Screen" : data.kind === "branch" ? "Branch" : "End"} · {data.id}</div>
      <div className="n">{data.title}</div>
      <div className="k" style={{ marginTop: 4 }}>{data.blocks} block{data.blocks === 1 ? "" : "s"}{data.issues ? ` · ${data.issues} issue${data.issues > 1 ? "s" : ""}` : ""}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--border-strong)" }} />
    </div>
  );
}
const nodeTypes = { screen: ScreenNode };
const EDGE_COLORS = { flow: "#8a93a0", rule: "#b8730a", error: "#c4361d" } as const;

export function FlowCanvas({ journey, selected, issues, onSelect }: { journey: Journey; selected: string; issues: LintIssue[]; onSelect: (id: string) => void }) {
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});
  const auto = useMemo(() => layout(journey), [journey]);

  const nodes: Node<NodeData>[] = useMemo(() => journey.screens.map((s) => ({
    id: s.id, type: "screen", position: moved[s.id] ?? auto[s.id] ?? { x: 0, y: 0 },
    data: { title: textOf(s.title), id: s.id, kind: s.kind ?? "screen", blocks: s.blocks.length, selected: s.id === selected, issues: issues.filter((i) => i.screen === s.id).length, entry: s.id === journey.entryScreen },
  })), [journey, selected, issues, moved, auto]);

  const edges: Edge[] = useMemo(() => buildEdges(journey).filter((e) => journey.screens.some((s) => s.id === e.to)).map((e) => ({
    id: e.id, source: e.from, target: e.to, type: "smoothstep",
    label: e.label.length > 30 ? e.label.slice(0, 29) + "…" : e.label,
    labelStyle: { fontSize: 11, fill: EDGE_COLORS[e.kind] }, labelBgStyle: { fill: "var(--bg)" }, labelBgPadding: [4, 2] as [number, number],
    style: { stroke: EDGE_COLORS[e.kind], strokeWidth: 1.6, strokeDasharray: e.kind === "flow" ? undefined : "5 4" },
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.kind] },
  })), [journey]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setMoved((m) => {
      let next = m;
      for (const c of changes) if (c.type === "position" && c.position) next = { ...next, [c.id]: c.position };
      return next;
    });
  }, []);

  return (
    <ReactFlow key={journey.screens.length} nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onNodeClick={(_, n) => onSelect(n.id)} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.3} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--border-strong)" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor={(n) => ((n.data as NodeData).kind === "terminal" ? "#4fd1a5" : (n.data as NodeData).kind === "branch" ? "#f5c066" : "#c3cad4")} />
    </ReactFlow>
  );
}
