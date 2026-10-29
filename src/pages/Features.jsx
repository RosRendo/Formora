import { useState } from "react";
import { useDraft } from "@/lib/useDraft";
import { http } from "@/lib/api";
import { ListChecks, Plus, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import ListEditor from "@/components/ListEditor";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

const COLS = [["mvp", "MVP", "Ships in the first release"], ["later", "Later", "Phase 2 and beyond"], ["out", "Out of scope", "Explicitly not building"]];
const PRI = { P0: "text-destructive", P1: "text-[hsl(var(--warning))]", P2: "text-primary", P3: "text-muted-foreground" };
const tmpId = () => `new-${Math.random().toString(36).slice(2, 9)}`;

function FeatureSheet({ f, all, onChange, onDelete, onClose, onResolve }) {
  if (!f) return null;
  const set = (k) => (v) => onChange({ ...f, [k]: v });
  const others = all.filter((x) => x.id !== f.id);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto" data-testid="feature-editor-panel">
        <SheetHeader><SheetTitle>Edit feature</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-5">
          {f.needs_review && (
            <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-xs" data-testid="feature-needs-review">
              <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" /><span className="flex-1">{f.review_reason}</span>
              <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={onResolve} data-testid="feature-resolve-btn">Mark reviewed</Button>
            </div>
          )}
          <div className="space-y-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => set("title")(e.target.value)} data-testid="feature-title-input" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={f.description} onChange={(e) => set("description")(e.target.value)} data-testid="feature-description-input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Priority</Label>
              <Select value={f.priority} onValueChange={set("priority")}><SelectTrigger data-testid="feature-priority-select"><SelectValue /></SelectTrigger>
                <SelectContent>{["P0", "P1", "P2", "P3"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Scope</Label>
              <Select value={f.scope} onValueChange={set("scope")}><SelectTrigger data-testid="feature-scope-select"><SelectValue /></SelectTrigger>
                <SelectContent>{COLS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Depends on</Label>
            <div className="flex flex-wrap gap-1.5" data-testid="feature-deps">
              {others.map((o) => {
                const on = f.depends_on.includes(o.id);
                return <button key={o.id} onClick={() => set("depends_on")(on ? f.depends_on.filter((d) => d !== o.id) : [...f.depends_on, o.id])}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? "border-primary bg-accent text-accent-foreground" : "hairline text-muted-foreground hover:bg-muted"}`}>{o.title}</button>;
              })}
              {!others.length && <span className="text-xs text-muted-foreground">No other features yet</span>}
            </div>
          </div>
          <div className="space-y-1.5"><Label>Completion criteria</Label><ListEditor items={f.completion_criteria} onChange={set("completion_criteria")} testid="feature-criteria" /></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><Label>User stories</Label>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => set("stories")([...f.stories, { as_a: "", i_want: "", so_that: "", acceptance_criteria: [] }])} data-testid="add-story-btn"><Plus className="h-3 w-3 mr-1" />Story</Button></div>
            {f.stories.map((s, i) => {
              const up = (k, v) => set("stories")(f.stories.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
              return (
                <div key={i} className="rounded-md bg-muted/40 p-3 space-y-1.5 text-sm" data-testid={`story-${i}`}>
                  <div className="flex justify-end -mb-2"><button onClick={() => set("stories")(f.stories.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button></div>
                  {[["as_a", "As a"], ["i_want", "I want"], ["so_that", "so that"]].map(([k, l]) => (
                    <div key={k} className="flex items-center gap-2"><span className="w-14 shrink-0 text-xs text-muted-foreground">{l}</span><input className="inline-input text-sm" value={s[k]} onChange={(e) => up(k, e.target.value)} data-testid={`story-${i}-${k}`} /></div>
                  ))}
                  <div className="pt-1"><div className="eyebrow mb-1">Acceptance criteria</div><ListEditor items={s.acceptance_criteria} onChange={(v) => up("acceptance_criteria", v)} testid={`story-${i}-ac`} /></div>
                </div>
              );
            })}
          </div>
          <Button variant="ghost" className="text-destructive w-full" onClick={onDelete} data-testid="delete-feature-btn">Delete feature</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Features() {
  const art = useArtifact("features");
  const { pid, setAiOpen, refresh } = useProject();
  const [list, setList] = useDraft(art.content, (c) => c?.features || []);
  const [edit, setEdit] = useState(null);
  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;
  const dirty = JSON.stringify(list) !== JSON.stringify(art.content?.features || []);
  const save = () => art.save({ features: list }, { summary: "Edited features" });
  const add = (scope) => { const f = { id: tmpId(), title: "New feature", description: "", priority: "P1", scope, depends_on: [], completion_criteria: [], stories: [] }; setList([...list, f]); setEdit(f.id); };
  const byId = Object.fromEntries(list.map((f) => [f.id, f]));
  const current = list.find((f) => f.id === edit);

  return (
    <div className="px-6 md:px-10 py-8 fade-up">
      <PageHeader eyebrow="Plan" title="Features & user stories" description="Separate what ships first from what waits. Each feature carries a priority, dependencies and completion criteria.">
        <ArtifactBar kind="features" art={art} workflow="scope_review" dirty={dirty} onSave={save} />
      </PageHeader>
      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />
      {!list.length ? (
        <EmptyState icon={ListChecks} title="No features yet" body="Let the AI derive features and stories from the approved spec, or add them yourself." action="Generate with AI" onAction={() => setAiOpen({ workflow: "scope_review" })} testid="features-empty">
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => add("mvp")} data-testid="features-add-manual-btn">or add one manually</button>
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3" data-testid="feature-board">
          {COLS.map(([k, label, hint]) => {
            const items = list.filter((f) => f.scope === k);
            return (
              <div key={k} data-testid={`feature-column-${k}`}>
                <div className="flex items-baseline justify-between pb-3 border-b hairline">
                  <div><span className="text-sm font-semibold">{label}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{items.length}</span><div className="text-[11px] text-muted-foreground">{hint}</div></div>
                  <button className="text-muted-foreground hover:text-foreground" onClick={() => add(k)} data-testid={`add-feature-${k}-btn`}><Plus className="h-4 w-4" /></button>
                </div>
                <div className="divide-y divide-border/50">
                  {items.map((f) => (
                    <button key={f.id} onClick={() => setEdit(f.id)} className="w-full text-left py-3 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors" data-testid={`feature-item-${f.id}`}>
                      <div className="flex items-start gap-2">
                        <span className={`font-mono text-[11px] mt-0.5 ${PRI[f.priority]}`}>{f.priority}</span>
                        <span className="flex-1 text-sm font-medium">{f.title}</span>
                        {f.needs_review && <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />}
                      </div>
                      {f.description && <p className="mt-1 pl-7 text-xs text-muted-foreground line-clamp-2">{f.description}</p>}
                      <div className="mt-1.5 pl-7 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground font-mono">
                        <span>{f.stories.length} stories</span><span>{f.completion_criteria.length} criteria</span>
                        {f.depends_on.length > 0 && <span>needs: {f.depends_on.map((d) => byId[d]?.title || "?").join(", ")}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <FeatureSheet f={current} all={list} onClose={() => setEdit(null)}
        onResolve={async () => {
          if (!current.id.startsWith("new-")) await http.post(`/projects/${pid}/items/resolve-review`, { type: "feature", id: current.id });
          setList(list.map((x) => (x.id === current.id ? { ...x, needs_review: false, review_reason: null } : x)));
          art.load(); refresh();
        }}
        onChange={(nf) => setList(list.map((x) => (x.id === nf.id ? nf : x)))}
        onDelete={() => { setList(list.filter((x) => x.id !== edit).map((x) => ({ ...x, depends_on: x.depends_on.filter((d) => d !== edit) }))); setEdit(null); }} />
    </div>
  );
}
