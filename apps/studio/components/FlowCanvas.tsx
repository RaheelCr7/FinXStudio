"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, useNodesInitialized, useReactFlow, useStore, type Edge, type Node, type NodeChange, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Flag, GitBranch, LayoutGrid, Play, Smartphone } from "lucide-react";
import type { Journey, LintIssue } from "@finx/journey-schema";
import { buildEdges, layout } from "@/lib/graph";
import { textOf } from "@/lib/edit";
import { BLOCK_ICONS } from "@/lib/blocks-ui";

type NodeData = { title: string; id: string; kind: string; types: string[]; selected: boolean; issues: number; entry: boolean };

function ScreenNode({ data }: NodeProps<Node<NodeData>>) {
  const cls = ["rf-node", data.kind === "branch" ? "branch" : data.kind === "terminal" ? "terminal" : "", data.entry ? "start" : "", data.selected ? "sel" : "", data.issues ? "bad" : ""].join(" ");
  const Kind = data.entry ? Play : data.kind === "branch" ? GitBranch : data.kind === "terminal" ? Flag : Smartphone;
  const label = data.entry ? "Start" : data.kind === "branch" ? "Branch" : data.kind === "terminal" ? "End" : "Screen";
  const shown = data.types.slice(0, 5);
  return (
    <div className={cls}>
      <Handle type="target" position={Position.Top} />
      {data.issues ? <span className="warn" title={`${data.issues} problem${data.issues > 1 ? "s" : ""}`}>{data.issues}</span> : null}
      <div className="top"><span className="ki"><Kind size={13} aria-hidden /></span><span className="k">{label} · {data.id}</span></div>
      <div className="n">{data.title}</div>
      <div className="blocks">
        {shown.map((t, i) => { const Icon = BLOCK_ICONS[t]; return <i key={i} title={t}>{Icon ? <Icon size={12} aria-hidden /> : null}</i>; })}
        <span>{data.types.length === 0 ? "No blocks" : data.types.length > shown.length ? `+${data.types.length - shown.length}` : `${data.types.length} block${data.types.length === 1 ? "" : "s"}`}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { screen: ScreenNode };

/** Fits the whole flow into view again whenever the canvas changes size (a panel opens, the window resizes). */
function Refit() {
  const rf = useReactFlow();
  const fit = useRef(rf.fitView);
  fit.current = rf.fitView; // its identity changes with the store, so keep the latest in a ref instead of a dependency
  const w = useStore((s) => s.width), h = useStore((s) => s.height);
  const ready = useNodesInitialized();
  useEffect(() => {
    // fitView does nothing until the nodes are measured; `ready` re-runs this once they are
    const t = setTimeout(() => { fit.current({ padding: "12%", maxZoom: 1, duration: 200 }); }, 120);
    return () => clearTimeout(t);
  }, [w, h, ready]);
  return null;
}
const EDGE_COLORS = { flow: "var(--text-3)", rule: "var(--warning)", error: "var(--negative)" } as const;

export function FlowCanvas({ journey, selected, issues, onSelect }: { journey: Journey; selected: string; issues: LintIssue[]; onSelect: (id: string) => void }) {
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});
  const [fitKey, setFitKey] = useState(0);
  const auto = useMemo(() => layout(journey), [journey]);

  const nodes: Node<NodeData>[] = useMemo(() => journey.screens.map((s) => ({
    id: s.id, type: "screen", position: moved[s.id] ?? auto[s.id] ?? { x: 0, y: 0 },
    data: { title: textOf(s.title), id: s.id, kind: s.kind ?? "screen", types: s.blocks.map((b: any) => b.type), selected: s.id === selected, issues: issues.filter((i) => i.screen === s.id).length, entry: s.id === journey.entryScreen },
  })), [journey, selected, issues, moved, auto]);

  const edges: Edge[] = useMemo(() => buildEdges(journey).filter((e) => journey.screens.some((s) => s.id === e.to)).map((e) => ({
    id: e.id, source: e.from, target: e.to, type: "smoothstep",
    label: e.label.length > 30 ? e.label.slice(0, 29) + "…" : e.label,
    labelStyle: { fontSize: 11, fontWeight: 600, fill: EDGE_COLORS[e.kind] }, labelBgStyle: { fill: "var(--bg)" }, labelBgPadding: [6, 3] as [number, number], labelBgBorderRadius: 6,
    style: { stroke: EDGE_COLORS[e.kind], strokeWidth: 1.7, strokeDasharray: e.kind === "flow" ? undefined : "5 4" },
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.kind] },
  })), [journey]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setMoved((m) => {
      let next = m;
      for (const c of changes) if (c.type === "position" && c.position) next = { ...next, [c.id]: c.position };
      return next;
    });
  }, []);
  const tidy = () => { setMoved({}); setFitKey((k) => k + 1); };

  return (
    <>
      <div className="float tl" aria-label="Legend">
        <div className="legend"><span><i style={{ borderColor: "var(--text-3)" }} />Flow</span><span><i className="dash" style={{ borderColor: "var(--warning)" }} />Rule</span><span><i className="dash" style={{ borderColor: "var(--negative)" }} />Error</span></div>
      </div>
      <div className="float tr"><button className="btn sm ghost" onClick={tidy} title="Reset the layout and fit the flow"><LayoutGrid size={14} aria-hidden />Tidy up</button></div>
      <ReactFlow key={`${journey.screens.length}:${fitKey}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
        onNodeClick={(_, n) => onSelect(n.id)} minZoom={0.25} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--border-strong)" />
        <Refit />
        <Controls showInteractive={false} position="bottom-left" />
        {journey.screens.length > 10 ? <MiniMap pannable zoomable position="bottom-right" nodeColor={(n) => ((n.data as NodeData).kind === "terminal" ? "#4fd1a5" : (n.data as NodeData).kind === "branch" ? "#f5c066" : "#aab3c2")} /> : null}
      </ReactFlow>
    </>
  );
}
