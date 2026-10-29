import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow, ReactFlowProvider, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { Network, Plus, Image, FileJson, Maximize, AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { http, download } from "@/lib/api";
import { NODE_TYPES, PROTOCOLS, reviewArchitecture } from "@/lib/arch";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

const tmpId = () => `n-${Math.random().toString(36).slice(2, 9)}`;

function ComponentNode({ data, selected }) {
  const t = NODE_TYPES[data.type] || NODE_TYPES.external_api;
  const cfg = Object.entries(data.config || {}).slice(0, 2);
  return (
    <div className={`w-[220px] rounded-lg border bg-card text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-shadow ${selected ? "ring-2 ring-primary border-transparent" : "hairline"}`} data-testid={`arch-node-${data.name}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="grid h-6 w-6 place-items-center rounded" style={{ background: `${t.tint}1a`, color: t.tint }}><t.icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold leading-tight">{data.name}</div><div className="text-[10px] text-muted-foreground">{t.label}</div></div>
      </div>
      <div className="px-3 pt-2 pb-2.5 space-y-1">
        {data.technology && <div className="font-mono text-[11px] text-primary truncate">{data.technology}</div>}
        {data.responsibility && <div className="text-[11px] leading-snug text-muted-foreground line-clamp-2">{data.responsibility}</div>}
        {cfg.map(([k, v]) => <div key={k} className="font-mono text-[10px] text-muted-foreground truncate">{k}: {String(v)}</div>)}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { component: ComponentNode };

const toFlow = (c) => ({
  nodes: (c?.nodes || []).map((n) => ({ id: n.id, type: "component", position: { x: n.x, y: n.y }, data: { ...n } })),
  edges: (c?.edges || []).map((e) => ({ id: e.id || tmpId(), source: e.source, target: e.target, label: e.protocol, data: { protocol: e.protocol, label: e.label }, markerEnd: { type: MarkerType.ArrowClosed } })),
});
const fromFlow = (nodes, edges, summary) => ({
  summary,
  nodes: nodes.map((n) => ({ id: n.id, type: n.data.type, name: n.data.name, responsibility: n.data.responsibility || "", technology: n.data.technology || "", rationale: n.data.rationale || "", config: n.data.config || {}, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
  edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, protocol: e.data?.protocol || "HTTPS REST", label: e.data?.label || "" })),
});

function NodeSheet({ node, onChange, onDelete, onClose }) {
  const [cfgKey, setCfgKey] = useState("");
  if (!node) return null;
  const d = node.data;
  const set = (k) => (v) => onChange({ ...d, [k]: v });
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[440px] overflow-y-auto" data-testid="arch-node-panel">
        <SheetHeader><SheetTitle>Component details</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input value={d.name} onChange={(e) => set("name")(e.target.value)} data-testid="arch-node-name-input" /></div>
          <div className="space-y-1.5"><Label>Type</Label>
            <Select value={d.type} onValueChange={set("type")}><SelectTrigger data-testid="arch-node-type-select"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(NODE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Selected technology</Label><Input value={d.technology} onChange={(e) => set("technology")(e.target.value)} data-testid="arch-node-tech-input" /></div>
          <div className="space-y-1.5"><Label>Responsibility</Label><Textarea value={d.responsibility} onChange={(e) => set("responsibility")(e.target.value)} data-testid="arch-node-resp-input" /></div>
          <div className="space-y-1.5"><Label>Why this technology</Label><Textarea value={d.rationale} onChange={(e) => set("rationale")(e.target.value)} data-testid="arch-node-rationale-input" /></div>
          <div className="space-y-2"><Label>Configuration</Label>
            {Object.entries(d.config || {}).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate font-mono text-xs text-muted-foreground">{k}</span>
                <input className="inline-input text-xs font-mono" value={v} onChange={(e) => set("config")({ ...d.config, [k]: e.target.value })} />
                <button onClick={() => { const c = { ...d.config }; delete c[k]; set("config")(c); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ))}
            <div className="flex gap-2"><Input className="h-8 text-xs font-mono" placeholder="new key (e.g. region)" value={cfgKey} onChange={(e) => setCfgKey(e.target.value)} data-testid="arch-config-key-input" />
              <Button size="sm" variant="outline" className="h-8" onClick={() => { if (cfgKey.trim()) { set("config")({ ...d.config, [cfgKey.trim()]: "" }); setCfgKey(""); } }} data-testid="arch-config-add-btn">Add</Button></div>
          </div>
          <Button variant="ghost" className="w-full text-destructive" onClick={onDelete} data-testid="arch-delete-node-btn"><Trash2 className="h-4 w-4 mr-1.5" />Delete component</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EdgeSheet({ edge, names, onChange, onDelete, onClose }) {
  if (!edge) return null;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[400px]" data-testid="arch-edge-panel">
        <SheetHeader><SheetTitle>{names[edge.source]} → {names[edge.target]}</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5"><Label>Communication</Label>
            <Select value={edge.data?.protocol} onValueChange={(v) => onChange({ ...edge.data, protocol: v })}><SelectTrigger data-testid="arch-edge-protocol-select"><SelectValue /></SelectTrigger>
              <SelectContent>{PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={edge.data?.label || ""} onChange={(e) => onChange({ ...edge.data, label: e.target.value })} data-testid="arch-edge-label-input" /></div>
          <Button variant="ghost" className="w-full text-destructive" onClick={onDelete} data-testid="arch-delete-edge-btn"><Trash2 className="h-4 w-4 mr-1.5" />Delete connection</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Canvas() {
  const art = useArtifact("architecture");
  const { pid, setAiOpen } = useProject();
  const rf = useReactFlow();
  const wrap = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [summary, setSummary] = useState("");
  const [sel, setSel] = useState(null);
  const [brief, setBrief] = useState(null);

  const loaded = useRef(null);
  const live = useRef(null);
  useEffect(() => {
    if (loaded.current !== null && live.current !== loaded.current) return;
    const f = toFlow(art.content); setNodes(f.nodes); setEdges(f.edges); setSummary(art.content?.summary || "");
    loaded.current = JSON.stringify(fromFlow(f.nodes, f.edges, art.content?.summary || ""));
    live.current = loaded.current;
    if (f.nodes.length) setTimeout(() => rf.fitView({ duration: 300 }), 80);
  }, [art.content, rf]);
  useEffect(() => {
    const loadBrief = () => http.get(`/projects/${pid}/artifacts/brief`).then(({ data }) => setBrief(data.content));
    loadBrief();
    const onArt = (e) => e.detail?.kind === "brief" && loadBrief();
    window.addEventListener("bp:artifact", onArt);
    return () => window.removeEventListener("bp:artifact", onArt);
  }, [pid]);

  const content = useMemo(() => fromFlow(nodes, edges, summary), [nodes, edges, summary]);
  live.current = JSON.stringify(content);
  const original = useMemo(() => (art.content ? fromFlow(toFlow(art.content).nodes, toFlow(art.content).edges, art.content.summary || "") : null), [art.content]);
  const dirty = original && JSON.stringify(content) !== JSON.stringify(original);
  const issues = useMemo(() => reviewArchitecture(content.nodes, content.edges, brief), [content, brief]);
  const names = Object.fromEntries(nodes.map((n) => [n.id, n.data.name]));

  const onNodesChange = useCallback((ch) => setNodes((n) => applyNodeChanges(ch, n)), []);
  const onEdgesChange = useCallback((ch) => setEdges((e) => applyEdgeChanges(ch, e)), []);
  const onConnect = useCallback((c) => setEdges((e) => addEdge({ ...c, id: tmpId(), label: "HTTPS REST", data: { protocol: "HTTPS REST", label: "" }, markerEnd: { type: MarkerType.ArrowClosed } }, e)), []);
  const addNode = (type) => {
    const center = rf.screenToFlowPosition({ x: (wrap.current?.clientWidth || 800) / 2, y: (wrap.current?.clientHeight || 500) / 2 });
    const id = tmpId();
    setNodes((n) => [...n, { id, type: "component", position: center, data: { id, type, name: NODE_TYPES[type].label, responsibility: "", technology: "", rationale: "", config: {} } }]);
    setSel({ kind: "node", id });
  };
  const exportPng = async () => {
    const el = wrap.current?.querySelector(".react-flow__viewport")?.parentElement;
    if (!el) return;
    const url = await toPng(el, { backgroundColor: getComputedStyle(document.body).backgroundColor, filter: (n) => !n.classList?.contains("react-flow__controls") && !n.classList?.contains("react-flow__minimap") });
    const a = document.createElement("a"); a.href = url; a.download = "architecture.png"; a.click();
  };

  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;
  const selNode = sel?.kind === "node" && nodes.find((n) => n.id === sel.id);
  const selEdge = sel?.kind === "edge" && edges.find((e) => e.id === sel.id);
  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-8 gap-1.5" data-testid="arch-add-node-btn"><Plus className="h-3.5 w-3.5" />Component</Button></DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 overflow-y-auto">{Object.entries(NODE_TYPES).map(([k, v]) => (
        <DropdownMenuItem key={k} onClick={() => addNode(k)} data-testid={`arch-add-${k}`}><v.icon className="h-4 w-4 mr-2" />{v.label}</DropdownMenuItem>))}</DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 md:px-8 pt-6">
        <PageHeader eyebrow="Engineer" title="Architecture visualizer" description="Components, the technology behind each one, and how they talk to each other.">
          <ArtifactBar kind="architecture" art={art} workflow="architecture" dirty={dirty} onSave={() => art.save(content, { summary: "Edited architecture" })} extra={addMenu} />
        </PageHeader>
        <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />
      </div>
      {!nodes.length && !art.content?.nodes?.length ? (
        <div className="px-6 md:px-8"><EmptyState icon={Network} title="No architecture yet" body="Generate the diagram from your approved spec, or place components yourself." action="Generate with AI" onAction={() => setAiOpen({ workflow: "architecture" })} testid="arch-empty">{addMenu}</EmptyState></div>
      ) : (
        <div className="grid min-h-0 flex-1 xl:grid-cols-[1fr_290px] border-t hairline">
          <div ref={wrap} className="relative min-h-[520px] bg-muted/20" data-testid="arch-canvas">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
              onNodeClick={(_, n) => setSel({ kind: "node", id: n.id })} onEdgeClick={(_, e) => setSel({ kind: "edge", id: e.id })} fitView minZoom={0.2}
              defaultEdgeOptions={{ style: { strokeWidth: 1.5, stroke: "hsl(var(--primary) / 0.55)" } }} deleteKeyCode={["Delete", "Backspace"]}>
              <Background gap={18} size={1.2} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!bg-card !border hairline hidden md:block" maskColor="hsl(var(--muted) / 0.6)" />
            </ReactFlow>
            <div className="absolute right-3 top-3 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => rf.fitView({ duration: 300 })} data-testid="arch-fit-btn"><Maximize className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" className="h-7 bg-card gap-1" onClick={exportPng} data-testid="arch-export-png-btn"><Image className="h-3.5 w-3.5" />PNG</Button>
              <Button size="sm" variant="outline" className="h-7 bg-card gap-1" onClick={() => download("architecture.json", JSON.stringify(content, null, 2), "application/json")} data-testid="arch-export-json-btn"><FileJson className="h-3.5 w-3.5" />JSON</Button>
            </div>
          </div>
          <aside className="border-t xl:border-t-0 xl:border-l hairline overflow-y-auto p-5 space-y-6 bg-card/40" data-testid="arch-summary-panel">
            <div><div className="eyebrow mb-2">Summary</div>
              <textarea className="inline-input text-sm leading-relaxed resize-none min-h-[120px]" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Describe how the system fits together…" data-testid="arch-summary-input" /></div>
            <div><div className="eyebrow mb-2">Review ({issues.length})</div>
              <ul className="space-y-2 text-[13px]" data-testid="arch-issues">
                {!issues.length && <li className="text-muted-foreground">No missing components or obvious over-engineering detected.</li>}
                {issues.map((i, k) => (
                  <li key={k} className="flex gap-2"><AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${i.level === "missing" ? "text-destructive" : "text-[hsl(var(--warning))]"}`} />
                    <span><span className="font-mono text-[10px] uppercase text-muted-foreground mr-1">{i.level}</span>{i.text}</span></li>))}
              </ul></div>
            <div><div className="eyebrow mb-2">Connections</div>
              <ul className="space-y-1.5 text-xs">{edges.map((e) => (
                <li key={e.id}><button className="text-left hover:text-primary" onClick={() => setSel({ kind: "edge", id: e.id })}>{names[e.source]} → {names[e.target]} <span className="font-mono text-muted-foreground">{e.data?.protocol}</span></button></li>))}</ul></div>
          </aside>
        </div>
      )}
      <NodeSheet node={selNode} onClose={() => setSel(null)} onChange={(d) => setNodes((ns) => ns.map((n) => (n.id === selNode.id ? { ...n, data: d } : n)))}
        onDelete={() => { setNodes((ns) => ns.filter((n) => n.id !== selNode.id)); setEdges((es) => es.filter((e) => e.source !== selNode.id && e.target !== selNode.id)); setSel(null); }} />
      <EdgeSheet edge={selEdge} names={names} onClose={() => setSel(null)} onChange={(d) => setEdges((es) => es.map((e) => (e.id === selEdge.id ? { ...e, data: d, label: d.protocol } : e)))}
        onDelete={() => { setEdges((es) => es.filter((e) => e.id !== selEdge.id)); setSel(null); }} />
    </div>
  );
}

export default function Architecture() {
  return <ReactFlowProvider><Canvas /></ReactFlowProvider>;
}
