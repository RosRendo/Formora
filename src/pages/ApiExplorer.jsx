import { useEffect, useMemo, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import { Braces, Plus, Search, AlertTriangle, Trash2, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { http } from "@/lib/api";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import ListEditor from "@/components/ListEditor";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

export const METHOD_CLS = { GET: "text-[hsl(var(--success))]", POST: "text-primary", PUT: "text-[hsl(var(--warning))]", PATCH: "text-[hsl(var(--warning))]", DELETE: "text-destructive" };
const tmpId = () => `e-${Math.random().toString(36).slice(2, 9)}`;
const blank = () => ({ id: tmpId(), method: "GET", path: "/api/", purpose: "", auth_required: true, role: "", request_schema: "", response_schema: "", validation: [], errors: [], rate_limit: "", entity_ids: [], feature_id: null, test_cases: [], needs_review: false, review_reason: null });

function Chips({ options, value, onChange, testid }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testid}>
      {options.map((o) => {
        const on = (value || []).includes(o.id);
        return <button key={o.id} onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...(value || []), o.id])}
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${on ? "border-primary bg-accent text-accent-foreground" : "hairline text-muted-foreground hover:bg-muted"}`}>{o.label}</button>;
      })}
      {!options.length && <span className="text-xs text-muted-foreground">None defined yet</span>}
    </div>
  );
}

function Editor({ ep, onChange, onDelete, entities, features, onResolve }) {
  const set = (k) => (v) => onChange({ ...ep, [k]: v });
  return (
    <div className="space-y-6 fade-up" key={ep.id} data-testid="endpoint-editor">
      {ep.needs_review && (
        <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-xs" data-testid="endpoint-needs-review">
          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" /><span className="flex-1">{ep.review_reason}</span>
          <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={onResolve} data-testid="endpoint-resolve-btn">Mark reviewed</Button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Select value={ep.method} onValueChange={set("method")}><SelectTrigger className={`w-28 font-mono font-semibold ${METHOD_CLS[ep.method]}`} data-testid="endpoint-method-select"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.keys(METHOD_CLS).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
        <Input className="font-mono" value={ep.path} onChange={(e) => set("path")(e.target.value)} data-testid="endpoint-path-input" />
      </div>
      <textarea rows={2} className="inline-input text-[15px] resize-none [field-sizing:content]" placeholder="Purpose" value={ep.purpose} onChange={(e) => set("purpose")(e.target.value)} data-testid="endpoint-purpose-input" />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={ep.auth_required} onCheckedChange={set("auth_required")} data-testid="endpoint-auth-switch" />Auth required</label>
        <div className="space-y-1"><Label className="text-xs">Role / permission</Label><Input className="h-8" value={ep.role} onChange={(e) => set("role")(e.target.value)} data-testid="endpoint-role-input" /></div>
        <div className="space-y-1"><Label className="text-xs">Rate limit</Label><Input className="h-8" value={ep.rate_limit} onChange={(e) => set("rate_limit")(e.target.value)} data-testid="endpoint-ratelimit-input" /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[["request_schema", "Request"], ["response_schema", "Response"]].map(([k, l]) => (
          <div key={k} className="space-y-1"><div className="eyebrow">{l} schema</div>
            <textarea className="w-full min-h-[110px] rounded-md bg-muted/40 p-3 font-mono text-[11.5px] outline-none focus:ring-1 focus:ring-ring" value={ep[k]} onChange={(e) => set(k)(e.target.value)} data-testid={`endpoint-${k}-input`} /></div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div><div className="eyebrow mb-1">Validation rules</div><ListEditor items={ep.validation} onChange={set("validation")} testid="endpoint-validation" /></div>
        <div><div className="eyebrow mb-1">Expected errors</div><ListEditor items={ep.errors} onChange={set("errors")} mono testid="endpoint-errors" /></div>
      </div>
      <div><div className="eyebrow mb-2">Related tables</div><Chips options={entities.map((e) => ({ id: e.id, label: e.name }))} value={ep.entity_ids} onChange={set("entity_ids")} testid="endpoint-entities" /></div>
      <div className="space-y-1"><div className="eyebrow mb-1">Feature</div>
        <Select value={ep.feature_id || "none"} onValueChange={(v) => set("feature_id")(v === "none" ? null : v)}><SelectTrigger className="max-w-sm" data-testid="endpoint-feature-select"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">No feature</SelectItem>{features.map((f) => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}</SelectContent></Select></div>
      <div><div className="eyebrow mb-1">Test cases</div><ListEditor items={ep.test_cases} onChange={set("test_cases")} testid="endpoint-tests" /></div>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete} data-testid="endpoint-delete-btn"><Trash2 className="h-3.5 w-3.5 mr-1" />Delete endpoint</Button>
    </div>
  );
}

export default function ApiExplorer() {
  const art = useArtifact("api");
  const { pid, setAiOpen, refresh } = useProject();
  const [list, setList] = useDraft(art.content, (c) => c?.endpoints || []);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState({ entities: [], features: [] });
  useEffect(() => {
    const firstId = art.content?.endpoints?.[0]?.id || null;
    setSel((s) => (s && art.content?.endpoints?.some((e) => e.id === s) ? s : firstId));
  }, [art.content]);
  useEffect(() => {
    const loadCtx = () =>
      Promise.all([http.get(`/projects/${pid}/artifacts/schema`), http.get(`/projects/${pid}/artifacts/features`)])
        .then(([s, f]) => setCtx({ entities: s.data.content?.entities || [], features: f.data.content?.features || [] }));
    loadCtx();
    const onArt = (e) => {
      if (e.detail?.kind === "schema" || e.detail?.kind === "features") loadCtx();
    };
    window.addEventListener("bp:artifact", onArt);
    return () => window.removeEventListener("bp:artifact", onArt);
  }, [pid]);
  const shown = useMemo(() => list.filter((e) => `${e.method} ${e.path} ${e.purpose}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;
  const dirty = JSON.stringify(list) !== JSON.stringify(art.content?.endpoints || []);
  const ep = list.find((e) => e.id === sel);
  const add = () => { const e = blank(); setList([...list, e]); setSel(e.id); };
  const resolve = async () => {
    if (!ep.id.startsWith("e-")) await http.post(`/projects/${pid}/items/resolve-review`, { type: "endpoint", id: ep.id });
    setList(list.map((x) => (x.id === ep.id ? { ...x, needs_review: false, review_reason: null } : x)));
    art.load(); refresh();
  };

  return (
    <div className="px-6 md:px-10 py-8 fade-up">
      <PageHeader eyebrow="Engineer" title="API explorer" description="Every endpoint with its contract, permissions, validation, errors and the tables, feature and tests it relates to.">
        <ArtifactBar kind="api" art={art} workflow="api" dirty={dirty} onSave={() => art.save({ endpoints: list }, { summary: "Edited API catalog" })}
          extra={<Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={add} data-testid="api-add-endpoint-btn"><Plus className="h-3.5 w-3.5" />Endpoint</Button>} />
      </PageHeader>
      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />
      {!list.length ? (
        <EmptyState icon={Braces} title="No endpoints yet" body="Generate contracts from the approved features and schema, or define endpoints by hand." action="Generate with AI" onAction={() => setAiOpen({ workflow: "api" })} testid="api-empty" />
      ) : (
        <div className="grid gap-8 xl:grid-cols-[310px_1fr]">
          <div>
            <div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="h-8 pl-8 text-sm" placeholder="Filter endpoints" value={q} onChange={(e) => setQ(e.target.value)} data-testid="api-filter-input" /></div>
            <div className="space-y-0.5" data-testid="api-endpoint-list">
              {shown.map((e) => (
                <button key={e.id} onClick={() => setSel(e.id)} data-testid={`api-endpoint-${e.method}-${e.path}`}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${sel === e.id ? "bg-accent" : "hover:bg-muted"}`}>
                  <span className={`w-14 shrink-0 font-mono text-[11px] font-semibold ${METHOD_CLS[e.method]}`}>{e.method}</span>
                  <span className="flex-1 truncate font-mono text-xs">{e.path}</span>
                  {e.needs_review && <AlertTriangle className="h-3 w-3 text-[hsl(var(--warning))]" />}
                  {e.auth_required ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0">{ep ? <Editor ep={ep} entities={ctx.entities} features={ctx.features} onResolve={resolve}
            onChange={(n) => setList(list.map((x) => (x.id === n.id ? n : x)))} onDelete={() => { setList(list.filter((x) => x.id !== ep.id)); setSel(null); }} /> : <p className="text-sm text-muted-foreground">Select an endpoint.</p>}</div>
        </div>
      )}
    </div>
  );
}
