import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, AlertTriangle, Check, Lock, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { http, KIND_LABEL, KIND_PATH } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import { PageError, PageLoading } from "@/components/common";

const PIPE = ["brief", "spec", "features", "flows", "ui", "architecture", "schema", "api", "security", "roadmap", "testing", "deployment"];
const NEXT_COPY = {
  brief: "Review the brief and its assumptions, then approve it.",
  spec: "Generate the product requirements from the approved brief.",
  features: "Sort features into MVP and later, then approve the scope.",
  architecture: "Generate the architecture diagram from the approved spec.",
  schema: "Design the database schema for the MVP features.",
  api: "Generate API contracts from the approved schema.",
  roadmap: "Turn the approved blueprint into ordered tasks.",
  flows: "Map role-based user journeys and failure branches.",
  ui: "Review desktop & mobile wireframes, states, and design tokens.",
  security: "Verify implemented vs planned security controls and threat mitigations.",
  testing: "Review unit, API integration, and E2E test coverage.",
  deployment: "Complete pre-flight gates, verify env vars, and export the release runbook.",
};

function Stage({ k, a, pid, i }) {
  const approved = a.status === "approved";
  const Icon = approved ? Lock : a.current_version ? Circle : Circle;
  return (
    <Link to={`/p/${pid}/${KIND_PATH[k]}`} className="group relative flex-1 min-w-[120px]" data-testid={`pipeline-stage-${k}`} style={{ animation: `fadeUp .35s ${i * 0.05}s both` }}>
      <div className="flex items-center">
        <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 transition-colors ${approved ? "border-[hsl(var(--success))] bg-[hsl(var(--success))] text-white" : a.current_version ? "border-primary bg-card text-primary" : "border-border bg-card text-muted-foreground"}`}>
          {approved ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-2.5 w-2.5" fill={a.current_version ? "currentColor" : "none"} />}
        </span>
        {i < PIPE.length - 1 && <span className={`h-[2px] flex-1 ${approved ? "bg-[hsl(var(--success))]" : "bg-border"}`} />}
      </div>
      <div className="mt-2.5 pr-3">
        <div className="text-[13px] font-medium group-hover:text-primary transition-colors flex items-center gap-1.5">{KIND_LABEL[k]}{a.needs_review && <AlertTriangle className="h-3 w-3 text-[hsl(var(--warning))]" />}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{a.status === "empty" ? "not started" : `${a.status} · v${a.current_version}`}</div>
      </div>
    </Link>
  );
}

export default function Overview() {
  const { pid, project: p, error, refresh } = useProject();
  const nav = useNavigate();
  const [decisions, setDecisions] = useState([]);
  useEffect(() => { http.get(`/projects/${pid}/decisions`).then(({ data }) => setDecisions(data.slice(0, 5))); }, [pid, p?.updated_at]);
  if (error) return <PageError message={error} onRetry={refresh} />;
  if (!p) return <PageLoading />;
  const next = PIPE.find((k) => p.artifacts[k]?.status !== "approved");
  const review = PIPE.filter((k) => p.artifacts[k]?.needs_review);
  const tc = p.task_counts || {};
  return (
    <div className="px-6 md:px-10 py-10 max-w-6xl">
      <div className="fade-up">
        <div className="eyebrow mb-3">Project overview</div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight" data-testid="overview-project-name">{p.name}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground leading-relaxed">{p.description}</p>
      </div>
      <div className="mt-12 flex overflow-x-auto pb-2" data-testid="blueprint-pipeline">
        {PIPE.map((k, i) => <Stage key={k} k={k} a={p.artifacts[k] || { status: "empty", current_version: 0 }} pid={pid} i={i} />)}
      </div>
      {next ? (
        <div className="mt-10 flex flex-col gap-4 rounded-lg bg-accent px-6 py-5 sm:flex-row sm:items-center fade-up" data-testid="next-step-card">
          <div className="flex-1">
            <div className="eyebrow text-accent-foreground/70 mb-1">Next recommended step</div>
            <div className="text-[15px] font-medium text-accent-foreground">{KIND_LABEL[next]}</div>
            <div className="text-sm text-muted-foreground">{NEXT_COPY[next]}</div>
          </div>
          <Button onClick={() => nav(`/p/${pid}/${KIND_PATH[next]}`)} data-testid="next-step-btn">Open {KIND_LABEL[next]}<ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      ) : (
        <div className="mt-10 rounded-lg bg-[hsl(var(--success)/0.1)] px-6 py-5 text-sm" data-testid="next-step-card"><b className="font-medium">Blueprint fully approved.</b> Work through the roadmap and export when ready.</div>
      )}
      <div className="mt-14 grid gap-12 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="text-sm font-semibold mb-3">Review queue</h2>
          <div className="divide-y divide-border/60" data-testid="review-queue">
            {!review.length && !p.flagged.endpoints.length && !p.flagged.tasks.length && <p className="py-3 text-sm text-muted-foreground">Nothing is waiting for review. Changes to upstream artifacts will appear here.</p>}
            {review.map((k) => (
              <Link key={k} to={`/p/${pid}/${KIND_PATH[k]}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-primary" data-testid={`review-artifact-${k}`}>
                <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" /><span className="font-medium">{KIND_LABEL[k]}</span><span className="text-xs text-muted-foreground truncate">{p.artifacts[k].review_reason}</span></Link>
            ))}
            {p.flagged.endpoints.map((e) => (
              <Link key={e.id} to={`/p/${pid}/api`} className="flex items-center gap-3 py-2.5 text-sm hover:text-primary"><span className="font-mono text-[10px] text-muted-foreground w-14">endpoint</span><span className="font-mono text-xs">{e.label}</span><span className="text-xs text-muted-foreground truncate">{e.reason}</span></Link>
            ))}
            {p.flagged.tasks.map((t) => (
              <Link key={t.id} to={`/p/${pid}/roadmap`} className="flex items-center gap-3 py-2.5 text-sm hover:text-primary"><span className="font-mono text-[10px] text-muted-foreground w-14">task</span><span>{t.title}</span><span className="text-xs text-muted-foreground truncate">{t.reason}</span></Link>
            ))}
          </div>
          <h2 className="text-sm font-semibold mt-10 mb-3">Delivery</h2>
          <div className="font-mono text-xs text-muted-foreground space-x-4" data-testid="overview-task-counts">
            {["blocked", "ready", "in_progress", "review", "completed"].map((s) => <span key={s}><span className="text-foreground">{tc[s] || 0}</span> {s.replace("_", " ")}</span>)}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">AI usage: <span className="font-mono text-foreground">{p.ai_usage.jobs}</span> runs · ~<span className="font-mono text-foreground">{Math.round(p.ai_usage.chars / 4).toLocaleString()}</span> tokens</div>
        </section>
        <section>
          <div className="flex items-baseline justify-between mb-3"><h2 className="text-sm font-semibold">Recent decisions</h2><Link to={`/p/${pid}/decisions`} className="text-xs text-muted-foreground hover:text-foreground">View log</Link></div>
          <ol className="relative border-l hairline ml-1.5 space-y-5" data-testid="overview-decisions">
            {decisions.map((d) => (
              <li key={d.id} className="pl-5 relative"><span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <div className="text-sm">{d.title}</div><div className="text-[11px] text-muted-foreground font-mono">{new Date(d.created_at).toLocaleString()}</div></li>
            ))}
            {!decisions.length && <li className="pl-5 text-sm text-muted-foreground">No decisions yet.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
