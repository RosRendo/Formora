import { useMemo, useState } from "react";
import { useDraft } from "@/lib/useDraft";
import { Map, Plus, AlertTriangle, Lock, Check, CircleDot, Circle, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { http, errMsg } from "@/lib/api";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import ListEditor from "@/components/ListEditor";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

export const MILESTONES = ["Project setup", "Database and migrations", "Authentication and permissions", "Core backend", "Frontend foundations and design system", "Main user journeys", "External integrations", "Payments", "Testing and bug fixing", "Security review", "Deployment", "Monitoring and launch"];
export const STATUS = {
  blocked: { label: "Blocked", icon: Lock, cls: "text-muted-foreground bg-muted" },
  ready: { label: "Ready", icon: Circle, cls: "text-primary bg-accent" },
  in_progress: { label: "In progress", icon: CircleDot, cls: "text-[hsl(var(--info))] bg-[hsl(var(--info)/0.12)]" },
  review: { label: "Review", icon: Eye, cls: "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)]" },
  completed: { label: "Completed", icon: Check, cls: "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.12)]" },
};
const tmpId = () => `k-${Math.random().toString(36).slice(2, 9)}`;

function effective(t, all) {
  const byId = Object.fromEntries(all.map((x) => [x.id, x]));
  return t.status !== "completed" && t.depends_on.some((d) => byId[d]?.status !== "completed") ? "blocked" : t.status;
}

function TaskSheet({ t, all, dirty, onChange, onPatch, onDelete, onClose }) {
  if (!t) return null;
  const set = (k) => (v) => onChange({ ...t, [k]: v });
  const eff = effective(t, all);
  const allChecked = t.acceptance_criteria.every((c) => c.checked);
  const persisted = !t.id.startsWith("k-");
  const byId = Object.fromEntries(all.map((x) => [x.id, x]));
  const move = (status) => {
    if (dirty) return toast.error("Save your edits as a version before changing status");
    onPatch({ status });
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[560px] overflow-y-auto" data-testid="task-editor-panel">
        <SheetHeader><SheetTitle className="pr-6">{t.title}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-5">
          {t.needs_review && persisted && (
            <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-xs" data-testid="task-needs-review">
              <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" /><span className="flex-1">{t.review_reason}</span>
              <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => (dirty ? toast.error("Save your edits first") : onPatch({ resolve_review: true }))} data-testid="task-resolve-btn">Mark reviewed</Button>
            </div>
          )}
          {persisted && (
            <div className="space-y-2" data-testid="task-status-controls">
              <div className="flex flex-wrap gap-1.5">
                {["ready", "in_progress", "review", "completed"].map((s) => {
                  const S = STATUS[s];
                  const disabled = (eff === "blocked" && s !== "ready") || (s === "completed" && !allChecked);
                  return <button key={s} disabled={disabled} onClick={() => move(s)} data-testid={`task-status-${s}-btn`}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-opacity ${t.status === s ? S.cls + " font-medium" : "hairline border text-muted-foreground"} disabled:opacity-40 disabled:cursor-not-allowed`}><S.icon className="h-3 w-3" />{S.label}</button>;
                })}
              </div>
              {eff === "blocked" && <p className="text-xs text-muted-foreground" data-testid="task-blocked-reason">Blocked by: {t.depends_on.filter((d) => byId[d]?.status !== "completed").map((d) => byId[d]?.title).join(", ")}</p>}
              {!allChecked && eff !== "blocked" && <p className="text-xs text-muted-foreground">Tick every acceptance criterion to allow completion.</p>}
            </div>
          )}
          <div className="space-y-2" data-testid="task-acceptance-criteria">
            <Label>Acceptance criteria</Label>
            {t.acceptance_criteria.map((c, i) => (
              <label key={i} className="flex items-start gap-2.5 text-sm">
                <Checkbox checked={c.checked} disabled={!persisted} data-testid={`task-ac-${i}-checkbox`}
                  onCheckedChange={(v) => { if (dirty) return toast.error("Save your edits first"); onPatch({ acceptance_criteria: t.acceptance_criteria.map((x, j) => (j === i ? { ...x, checked: !!v } : x)) }); }} />
                <input className="inline-input text-sm -my-1" value={c.text} onChange={(e) => set("acceptance_criteria")(t.acceptance_criteria.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              </label>
            ))}
            <ListEditor items={[]} onChange={(v) => set("acceptance_criteria")([...t.acceptance_criteria, ...v.map((text) => ({ text, checked: false }))])} placeholder="Add criterion…" testid="task-ac-add" />
          </div>
          <div className="space-y-1.5"><Label>Title</Label><Input value={t.title} onChange={(e) => set("title")(e.target.value)} data-testid="task-title-input" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={t.description} onChange={(e) => set("description")(e.target.value)} data-testid="task-description-input" /></div>
          <div className="space-y-1.5"><Label>Deliverable</Label><Input value={t.deliverable} onChange={(e) => set("deliverable")(e.target.value)} data-testid="task-deliverable-input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Milestone</Label>
              <Select value={String(t.milestone)} onValueChange={(v) => set("milestone")(Number(v))}><SelectTrigger data-testid="task-milestone-select"><SelectValue /></SelectTrigger>
                <SelectContent>{MILESTONES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{i + 1}. {m}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Complexity</Label>
              <Select value={t.complexity} onValueChange={set("complexity")}><SelectTrigger data-testid="task-complexity-select"><SelectValue /></SelectTrigger>
                <SelectContent>{["S", "M", "L"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Depends on</Label>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto" data-testid="task-deps">
              {all.filter((x) => x.id !== t.id).map((o) => {
                const on = t.depends_on.includes(o.id);
                return <button key={o.id} onClick={() => set("depends_on")(on ? t.depends_on.filter((d) => d !== o.id) : [...t.depends_on, o.id])}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] ${on ? "border-primary bg-accent text-accent-foreground" : "hairline text-muted-foreground hover:bg-muted"}`}>{o.title}</button>;
              })}
            </div></div>
          <div className="space-y-1.5"><Label>Files / modules likely affected</Label><ListEditor items={t.files} onChange={set("files")} mono testid="task-files" /></div>
          <div className="space-y-1.5"><Label>Tests required</Label><ListEditor items={t.tests} onChange={set("tests")} testid="task-tests" /></div>
          <Button variant="ghost" size="sm" className="text-destructive w-full" onClick={onDelete} data-testid="task-delete-btn"><Trash2 className="h-3.5 w-3.5 mr-1" />Delete task</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Roadmap() {
  const art = useArtifact("roadmap");
  const { pid, setAiOpen, refresh } = useProject();
  const [tasks, setTasks] = useDraft(art.content, (c) => c?.tasks || []);
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState("all");
  const counts = useMemo(() => tasks.reduce((a, t) => ({ ...a, [effective(t, tasks)]: (a[effective(t, tasks)] || 0) + 1 }), {}), [tasks]);
  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;
  const strip = (l) => l.map(({ effective_status, ...r }) => r);
  const dirty = JSON.stringify(strip(tasks)) !== JSON.stringify(strip(art.content?.tasks || []));
  const task = tasks.find((t) => t.id === sel);
  const patch = async (body) => {
    try {
      const { data } = await http.patch(`/projects/${pid}/tasks/${task.id}`, body);
      art.setContent(data);
      refresh();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const add = (m) => { const t = { id: tmpId(), milestone: m, title: "New task", description: "", deliverable: "", depends_on: [], files: [], acceptance_criteria: [], tests: [], complexity: "M", status: "ready", feature_id: null, endpoint_ids: [], entity_ids: [], needs_review: false }; setTasks([...tasks, t]); setSel(t.id); };
  const done = counts.completed || 0;

  return (
    <div className="px-6 md:px-10 py-8 fade-up">
      <PageHeader eyebrow="Deliver" title="Implementation roadmap" description="Small, testable tasks in dependency order. A task unlocks when everything it depends on is completed.">
        <ArtifactBar kind="roadmap" art={art} workflow="tasks" dirty={dirty} onSave={() => art.save({ tasks: strip(tasks) }, { summary: "Edited roadmap" })} />
      </PageHeader>
      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />
      {!tasks.length ? (
        <EmptyState icon={Map} title="No tasks yet" body="Generate an ordered task list from your approved blueprint, or add tasks to a milestone yourself." action="Generate with AI" onAction={() => setAiOpen({ workflow: "tasks" })} testid="roadmap-empty">
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => add(1)} data-testid="roadmap-add-manual-btn">or add a task manually</button>
        </EmptyState>
      ) : (
        <>
          <div className="mb-8">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" data-testid="roadmap-progress">
              {["completed", "review", "in_progress", "ready", "blocked"].map((s) => <div key={s} className={STATUS[s].cls.split(" ")[1]} style={{ width: `${((counts[s] || 0) / tasks.length) * 100}%` }} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["all", ...Object.keys(STATUS)].map((s) => (
                <button key={s} onClick={() => setFilter(s)} data-testid={`roadmap-filter-${s}`}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${filter === s ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
                  {s === "all" ? "All" : STATUS[s].label} <span className="font-mono opacity-70">{s === "all" ? tasks.length : counts[s] || 0}</span></button>
              ))}
              <span className="ml-auto font-mono text-xs text-muted-foreground self-center">{Math.round((done / tasks.length) * 100)}% complete</span>
            </div>
          </div>
          <div className="space-y-8" data-testid="roadmap-milestones">
            {MILESTONES.map((m, i) => {
              const ms = tasks.filter((t) => t.milestone === i + 1 && (filter === "all" || effective(t, tasks) === filter));
              const total = tasks.filter((t) => t.milestone === i + 1);
              if (!total.length && filter !== "all") return null;
              return (
                <section key={m} data-testid={`milestone-${i + 1}`}>
                  <div className="flex items-baseline gap-3 border-b hairline pb-2">
                    <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <h2 className="text-sm font-semibold flex-1">{m}</h2>
                    <span className="font-mono text-[11px] text-muted-foreground">{total.filter((t) => t.status === "completed").length}/{total.length}</span>
                    <button onClick={() => add(i + 1)} className="text-muted-foreground hover:text-foreground" data-testid={`milestone-${i + 1}-add-btn`}><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  {!total.length && <p className="py-2 text-xs text-muted-foreground/70">No tasks{i === 7 ? " — skip if the product has no payments" : ""}.</p>}
                  {ms.map((t) => {
                    const S = STATUS[effective(t, tasks)];
                    return (
                      <button key={t.id} onClick={() => setSel(t.id)} className="flex w-full items-center gap-3 py-2.5 px-2 -mx-2 rounded-md text-left hover:bg-muted/50 transition-colors" data-testid={`task-row-${t.id}`}>
                        <span className={`flex w-[104px] shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${S.cls}`} data-testid={`task-status-${t.id}`}><S.icon className="h-3 w-3" />{S.label}</span>
                        <span className={`flex-1 text-sm ${t.status === "completed" ? "text-muted-foreground line-through decoration-border" : ""}`}>{t.title}</span>
                        {t.needs_review && <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" title={t.review_reason} />}
                        <span className="hidden sm:block font-mono text-[11px] text-muted-foreground">{t.acceptance_criteria.filter((c) => c.checked).length}/{t.acceptance_criteria.length} AC</span>
                        <span className="font-mono text-[11px] text-muted-foreground w-4">{t.complexity}</span>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </>
      )}
      <TaskSheet t={task} all={tasks} dirty={dirty} onClose={() => setSel(null)} onPatch={patch}
        onChange={(n) => setTasks(tasks.map((x) => (x.id === n.id ? n : x)))}
        onDelete={() => { setTasks(tasks.filter((x) => x.id !== sel).map((x) => ({ ...x, depends_on: x.depends_on.filter((d) => d !== sel) }))); setSel(null); }} />
    </div>
  );
}
