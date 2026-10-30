import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { EmptyState, PageError, PageLoading } from "@/components/common";
import { ProjectRow, useProjects } from "./Projects";

const FLOW = ["Brief", "Requirements", "Features", "Flows", "UI/UX", "Architecture", "Database", "API", "Security", "Roadmap", "Testing", "Deploy"];

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { loading, list, error, load } = useProjects(false);
  const review = list.reduce((a, p) => a + p.needs_review, 0);
  const tasks = list.reduce((a, p) => a + p.tasks_total, 0);
  const done = list.reduce((a, p) => a + p.tasks_done, 0);
  return (
    <div className="px-6 md:px-10 py-10 max-w-6xl fade-up">
      <div className="eyebrow mb-3">Dashboard</div>
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]" data-testid="dashboard-greeting">Good to see you, {user?.name?.split(" ")[0]}.</h1>
      <p className="mt-3 text-sm text-muted-foreground max-w-xl">Plan it, approve it, then build it. Pick up a blueprint or start a new one.</p>
      <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-3 text-sm">
        <Button onClick={() => nav("/projects/new")} data-testid="dashboard-new-project-btn"><Plus className="h-4 w-4 mr-1" />New project</Button>
        <div className="font-mono text-xs text-muted-foreground" data-testid="dashboard-stats">
          <span className="text-foreground">{list.length}</span> projects · <span className="text-foreground">{done}/{tasks}</span> tasks done{review > 0 && <> · <span className="text-[hsl(var(--warning))]">{review} artifacts need review</span></>}
        </div>
      </div>
      <div className="mt-12 flex items-center gap-2 overflow-x-auto pb-2 text-[11px] font-mono text-muted-foreground">
        {FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-2 whitespace-nowrap"><span className="rounded border hairline px-2 py-1">{String(i + 1).padStart(2, "0")} {s}</span>{i < FLOW.length - 1 && <span className="text-border">——</span>}</span>
        ))}
      </div>
      <div className="mt-10">
        <div className="eyebrow mb-2">Recent projects</div>
        {loading ? <PageLoading /> : error ? <PageError message={error} onRetry={load} /> : list.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No active projects" body="Create your first blueprint with the guided wizard." action="Start a project" onAction={() => nav("/projects/new")} testid="dashboard-empty" />
        ) : <div className="divide-y divide-border/60" data-testid="dashboard-projects">{list.slice(0, 6).map((p) => <ProjectRow key={p.id} p={p} />)}</div>}
      </div>
    </div>
  );
}
