import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import { ReactFlow, Background, Controls, Handle, Position, applyNodeChanges, ReactFlowProvider, useReactFlow, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { Database, Plus, Copy, Download, AlertCircle, CheckCircle2, Key, Maximize, Image } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { http, download } from "@/lib/api";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import TableSheet, { KIND_LABEL, tmpId } from "@/components/erd/TableSheet";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

function TableNode({ data, selected }) {
  const fks = new Set(data.fks);
  return (
    <div className={`min-w-[230px] rounded-lg border bg-card text-left overflow-hidden ${selected ? "ring-2 ring-primary border-transparent" : data.error ? "border-destructive/60" : "hairline"}`} data-testid={`erd-table-${data.name}`}>
      <Handle id="h-t" type="target" position={Position.Left} style={{ top: 18 }} />
      <Handle id="h-s" type="source" position={Position.Right} style={{ top: 18 }} />
      <div className="flex items-center gap-2 bg-muted/60 px-3 py-2">
        <Database className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-[13px] font-semibold">{data.name}</span>
        {data.error && <AlertCircle className="h-3.5 w-3.5 text-destructive ml-auto" />}
      </div>
      <div className="py-1">
        {data.fields.map((f) => (
          <div key={f.id} className="relative flex items-center gap-2 px-3 py-[3px] text-[11.5px] font-mono">
            <Handle id={`t-${f.id}`} type="target" position={Position.Left} className="!h-1.5 !w-1.5 !min-w-0 !border" />
            <span className="w-3">{f.primary_key ? <Key className="h-3 w-3 text-[hsl(var(--warning))]" /> : fks.has(f.id) ? <span className="text-primary text-[9px]">FK</span> : null}</span>
            <span className={`flex-1 ${f.primary_key ? "font-semibold" : ""}`}>{f.name}{f.nullable && !f.primary_key ? <span className="text-muted-foreground">?</span> : ""}</span>
            <span className="text-muted-foreground">{f.type}</span>
            {f.unique && !f.primary_key && <span className="text-[9px] text-primary">UQ</span>}
            <Handle id={`s-${f.id}`} type="source" position={Position.Right} className="!h-1.5 !w-1.5 !min-w-0 !border" />
          </div>
        ))}
        {data.timestamps && <div className="px-3 py-[3px] pl-8 text-[11px] font-mono text-muted-foreground/70">created_at · updated_at</div>}
      </div>
    </div>
  );
}
const nodeTypes = { table: TableNode };

function CodePanel({ code, issues }) {
  const errors = issues.filter((i) => i.level === "error");
  const copy = (t) => navigator.clipboard.writeText(t).then(() => toast.success("Copied"));
  return (
    <Tabs defaultValue="validate" className="flex h-full flex-col">
      <TabsList className="m-3 mb-0 self-start">
        <TabsTrigger value="validate" data-testid="erd-tab-validate">Validation {issues.length > 0 && <span className={`ml-1.5 font-mono text-[10px] ${errors.length ? "text-destructive" : "text-[hsl(var(--warning))]"}`}>{issues.length}</span>}</TabsTrigger>
        <TabsTrigger value="sql" data-testid="erd-tab-sql">SQL</TabsTrigger>
        <TabsTrigger value="prisma" data-testid="erd-tab-prisma">Prisma</TabsTrigger>
      </TabsList>
      <TabsContent value="validate" className="flex-1 overflow-y-auto px-4 pb-4" data-testid="erd-issues">
        {!issues.length ? <div className="flex items-center gap-2 text-sm text-[hsl(var(--success))] pt-3"><CheckCircle2 className="h-4 w-4" />Schema is valid.</div> : (
          <ul className="space-y-2 pt-2 text-[13px]">{issues.map((i, k) => (
            <li key={k} className="flex gap-2"><AlertCircle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${i.level === "error" ? "text-destructive" : "text-[hsl(var(--warning))]"}`} />{i.message}</li>))}</ul>)}
      </TabsContent>
      {["sql", "prisma"].map((k) => (
        <TabsContent key={k} value={k} className="relative flex-1 min-h-0 overflow-hidden">
          <div className="absolute right-3 top-2 z-10 flex gap-1">
            <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => copy(code[k])} data-testid={`erd-copy-${k}-btn`}><Copy className="h-3 w-3" /></Button>
            <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => download(k === "sql" ? "schema.sql" : "schema.prisma", code[k])} data-testid={`erd-download-${k}-btn`}><Download className="h-3 w-3" /></Button>
          </div>
          <pre className="h-full overflow-auto px-4 py-3 text-[11px] leading-relaxed font-mono" data-testid={`erd-code-${k}`}>{code[k]}</pre>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Designer() {
  const art = useArtifact("schema");
  const { pid, setAiOpen } = useProject();
  const rf = useReactFlow();
  const wrap = useRef(null);
  const [schema, setSchema] = useDraft(art.content, (c) => c || { entities: [], relationships: [] });
  const [nodes, setNodes] = useState([]);
  const [sel, setSel] = useState(null);
  const [code, setCode] = useState({ sql: "", prisma: "", issues: [] });
  const [links, setLinks] = useState({ api: [], features: [], tasks: [] });

  useEffect(() => {
    const loadLinks = () =>
      Promise.all(["api", "features", "roadmap"].map((k) => http.get(`/projects/${pid}/artifacts/${k}`))).then(([a, f, r]) =>
        setLinks({ api: a.data.content?.endpoints || [], features: f.data.content?.features || [], tasks: r.data.content?.tasks || [] }));
    loadLinks();
    const onArt = (e) => {
      if (["api", "features", "roadmap"].includes(e.detail?.kind)) loadLinks();
      if (e.detail?.kind === "schema") setTimeout(() => rf.fitView({ duration: 300 }), 80);
    };
    window.addEventListener("bp:artifact", onArt);
    return () => window.removeEventListener("bp:artifact", onArt);
  }, [pid, rf]);
  useEffect(() => {
    const t = setTimeout(() => http.post(`/projects/${pid}/schema/preview`, { content: schema }).then(({ data }) => setCode(data)).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [schema, pid]);

  const errIds = useMemo(() => new Set(code.issues.filter((i) => i.level === "error").map((i) => i.entity_id)), [code.issues]);
  useEffect(() => {
    const fks = schema.relationships.map((r) => r.source_field).filter(Boolean);
    setNodes((prev) => schema.entities.map((e) => {
      const p = prev.find((n) => n.id === e.id);
      return { id: e.id, type: "table", position: p?.position || { x: e.x, y: e.y }, selected: p?.selected, data: { ...e, fks, error: errIds.has(e.id) } };
    }));
  }, [schema, errIds]);
  const edges = useMemo(() => schema.relationships.map((r) => ({
    id: r.id, source: r.source_entity, target: r.target_entity,
    sourceHandle: r.source_field ? `s-${r.source_field}` : "h-s", targetHandle: r.target_field ? `t-${r.target_field}` : "h-t",
    label: KIND_LABEL[r.kind], type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 1.4, stroke: r.kind === "many_to_many" ? "hsl(var(--warning))" : "hsl(var(--primary) / 0.6)", strokeDasharray: r.kind === "many_to_many" ? "5 4" : undefined },
  })), [schema.relationships]);

  const onNodesChange = useCallback((ch) => {
    setNodes((n) => applyNodeChanges(ch, n));
    const moved = ch.filter((c) => c.type === "position" && c.position && !c.dragging);
    if (moved.length) setSchema((s) => ({ ...s, entities: s.entities.map((e) => { const m = moved.find((c) => c.id === e.id); return m ? { ...e, x: Math.round(m.position.x), y: Math.round(m.position.y) } : e; }) }));
  }, []);
  const onConnect = useCallback((c) => {
    if (!c.sourceHandle?.startsWith("s-") || !c.targetHandle?.startsWith("t-") || c.source === c.target) return toast("Drag from a foreign-key column to the column it references");
    setSchema((s) => ({ ...s, relationships: [...s.relationships, { id: tmpId(), source_entity: c.source, source_field: c.sourceHandle.slice(2), target_entity: c.target, target_field: c.targetHandle.slice(2), kind: "one_to_many", on_delete: "CASCADE" }] }));
  }, []);
  const addTable = () => {
    const pos = rf.screenToFlowPosition({ x: (wrap.current?.clientWidth || 600) / 2, y: 120 });
    const e = { id: tmpId(), name: `table_${schema.entities.length + 1}`, purpose: "", timestamps: true, x: Math.round(pos.x), y: Math.round(pos.y), fields: [{ id: tmpId(), name: "id", type: "uuid", primary_key: true, nullable: false, unique: false, indexed: false, default: "gen_random_uuid()" }] };
    setSchema({ ...schema, entities: [...schema.entities, e] });
    setSel(e.id);
  };
  const exportPng = async () => {
    const el = wrap.current?.querySelector(".react-flow");
    const url = await toPng(el, { backgroundColor: getComputedStyle(document.body).backgroundColor, filter: (n) => !n.classList?.contains("react-flow__controls") });
    const a = document.createElement("a"); a.href = url; a.download = "erd.png"; a.click();
  };

  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;
  const dirty = art.content && JSON.stringify(schema) !== JSON.stringify(art.content);
  const entity = schema.entities.find((e) => e.id === sel);
  const usage = entity ? {
    endpoints: links.api.filter((e) => (e.entity_ids || []).includes(entity.id)).map((e) => `${e.method} ${e.path}`),
    features: [...new Set(links.api.filter((e) => (e.entity_ids || []).includes(entity.id) && e.feature_id).map((e) => links.features.find((f) => f.id === e.feature_id)?.title).filter(Boolean))],
    tasks: links.tasks.filter((t) => (t.entity_ids || []).includes(entity.id)).map((t) => t.title),
  } : null;
  const hasErrors = code.issues.some((i) => i.level === "error");
  const save = () => (hasErrors ? toast.error("Fix validation errors before saving a version") : art.save(schema, { summary: "Edited schema" }));
  const addBtn = <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={addTable} data-testid="erd-add-table-btn"><Plus className="h-3.5 w-3.5" />Table</Button>;

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 md:px-8 pt-6">
        <PageHeader eyebrow="Engineer" title="Database designer" description="One structured model generates the diagram, PostgreSQL DDL and Prisma schema. Approved schemas only change through a reviewed diff.">
          <ArtifactBar kind="schema" art={art} workflow="schema" dirty={dirty} onSave={save} extra={addBtn} />
        </PageHeader>
        <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />
      </div>
      {!schema.entities.length ? (
        <div className="px-6 md:px-8"><EmptyState icon={Database} title="No tables yet" body="Generate a normalized schema from approved features, or add tables yourself." action="Generate with AI" onAction={() => setAiOpen({ workflow: "schema" })} testid="erd-empty">{addBtn}</EmptyState></div>
      ) : (
        <div className="grid min-h-0 flex-1 xl:grid-cols-[1fr_360px] border-t hairline">
          <div ref={wrap} className="relative min-h-[540px] bg-muted/20" data-testid="erd-canvas">
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onConnect={onConnect}
              onNodeClick={(_, n) => setSel(n.id)} onEdgeClick={(_, e) => setSel(schema.relationships.find((r) => r.id === e.id)?.source_entity)} fitView minZoom={0.2}>
              <Background gap={18} size={1.2} />
              <Controls showInteractive={false} />
            </ReactFlow>
            <div className="absolute right-3 top-3 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 bg-card" onClick={() => rf.fitView({ duration: 300 })} data-testid="erd-fit-btn"><Maximize className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" className="h-7 bg-card gap-1" onClick={exportPng} data-testid="erd-export-png-btn"><Image className="h-3.5 w-3.5" />PNG</Button>
            </div>
          </div>
          <aside className="min-h-[380px] border-t xl:border-t-0 xl:border-l hairline bg-card/40" data-testid="erd-code-panel"><CodePanel code={code} issues={code.issues} /></aside>
        </div>
      )}
      <TableSheet entity={entity} schema={schema} usage={usage || { endpoints: [], features: [], tasks: [] }} onClose={() => setSel(null)} onSchema={setSchema}
        onChange={(ne) => setSchema({ ...schema, entities: schema.entities.map((e) => (e.id === ne.id ? ne : e)) })} />
    </div>
  );
}

export default function DatabaseDesigner() {
  return <ReactFlowProvider><Designer /></ReactFlowProvider>;
}
