import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FolderOpen, ArrowUpRight, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { http, errMsg } from "@/lib/api";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

const STAGES = ["brief", "spec", "features", "architecture", "schema", "api", "roadmap"];

export function ProjectRow({ p }) {
  const pct = p.tasks_total ? Math.round((p.tasks_done / p.tasks_total) * 100) : 0;
  return (
    <Link to={`/p/${p.id}`} className="group grid grid-cols-12 items-center gap-4 py-4 transition-colors hover:bg-muted/40 -mx-3 px-3 rounded-md" data-testid={`project-row-${p.id}`}>
      <div className="col-span-12 md:col-span-5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{p.name}</span>
          {p.is_sample && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">sample</span>}
          {p.status === "archived" && <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"><Archive className="h-3 w-3" />archived</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</p>
      </div>
      <div className="col-span-6 md:col-span-3 flex items-center gap-1" title={`${p.approved} of 7 artifacts approved`}>
        {STAGES.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i < p.approved ? "bg-primary" : i < p.artifacts ? "bg-primary/25" : "bg-border"}`} />)}
      </div>
      <div className="col-span-4 md:col-span-3 text-xs text-muted-foreground font-mono">
        {p.tasks_total ? `${p.tasks_done}/${p.tasks_total} tasks · ${pct}%` : "no tasks yet"}
        {p.needs_review > 0 && <span className="ml-2 text-[hsl(var(--warning))]">{p.needs_review} review</span>}
      </div>
      <ArrowUpRight className="col-span-2 md:col-span-1 justify-self-end h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export function useProjects(includeArchived) {
  const [state, setState] = useState({ loading: true, list: [], error: null });
  const load = useCallback(() => {
    http.get("/projects", { params: { include_archived: includeArchived } })
      .then(({ data }) => setState({ loading: false, list: data, error: null }))
      .catch((e) => setState({ loading: false, list: [], error: errMsg(e) }));
  }, [includeArchived]);
  useEffect(() => { load(); }, [load]);
  return { ...state, load };
}

export default function Projects() {
  const [archived, setArchived] = useState(false);
  const { loading, list, error, load } = useProjects(archived);
  const nav = useNavigate();
  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <PageHeader title="Projects" description="Every blueprint you own. Archived projects are hidden but restorable.">
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={archived} onCheckedChange={setArchived} data-testid="show-archived-switch" />Show archived</label>
        <Button size="sm" onClick={() => nav("/projects/new")} data-testid="projects-new-btn"><Plus className="h-4 w-4 mr-1" />New project</Button>
      </PageHeader>
      {loading ? <PageLoading /> : error ? <PageError message={error} onRetry={load} /> : list.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No projects yet" body="Start with the wizard. It asks a few questions and drafts a brief for you to review." action="Start a project" onAction={() => nav("/projects/new")} testid="projects-empty" />
      ) : (
        <div className="divide-y divide-border/60" data-testid="projects-list">{list.map((p) => <ProjectRow key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
