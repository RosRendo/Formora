import { useEffect, useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import ListEditor from "@/components/ListEditor";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

const EMPTY = { problem_statement: "", target_audience: "", value_proposition: "", goals: [], roles: [], functional_requirements: [], nonfunctional_requirements: [], mvp_scope: [], phase2_scope: [], out_of_scope: [], risks: [], open_questions: [] };
const LISTS = [
  ["functional_requirements", "Functional requirements"], ["nonfunctional_requirements", "Non-functional requirements"],
  ["mvp_scope", "MVP scope"], ["phase2_scope", "Phase 2 scope"], ["out_of_scope", "Out of scope"],
  ["risks", "Risks"], ["open_questions", "Unresolved questions"],
];

function Section({ title, children, id }) {
  return (
    <section className="grid gap-3 py-6 md:grid-cols-[200px_1fr] border-t hairline" id={id}>
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Prose({ value, onChange, testid }) {
  return <textarea rows={2} className="inline-input text-[15px] leading-relaxed resize-none [field-sizing:content]" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Not defined yet" data-testid={testid} />;
}

export default function Requirements() {
  const art = useArtifact("spec");
  const { setAiOpen } = useProject();
  const [c, setC] = useState(null);
  useEffect(() => { setC(art.content ? { ...EMPTY, ...art.content } : null); }, [art.content]);
  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;
  const header = (
    <PageHeader eyebrow="Plan" title="Product requirements" description="The structured specification every downstream artifact is built from.">
      <ArtifactBar kind="spec" art={art} workflow="spec" dirty={c && JSON.stringify(c) !== JSON.stringify({ ...EMPTY, ...art.content })} onSave={c ? () => art.save(c, { summary: "Edited spec" }) : undefined} />
    </PageHeader>
  );
  if (!c) return (
    <div className="px-6 md:px-10 py-8 max-w-4xl">{header}
      <EmptyState icon={FileText} title="No specification yet" body="Generate a draft from your approved brief, or start from a blank structure and write it yourself." action="Generate with AI" onAction={() => setAiOpen({ workflow: "spec" })} testid="spec-empty">
        <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setC({ ...EMPTY })} data-testid="spec-start-blank-btn">or start blank</button>
      </EmptyState>
    </div>
  );
  const set = (k) => (v) => setC({ ...c, [k]: v });
  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl fade-up">
      {header}
      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />
      <Section title="Problem statement"><Prose value={c.problem_statement} onChange={set("problem_statement")} testid="spec-problem-input" /></Section>
      <Section title="Target audience"><Prose value={c.target_audience} onChange={set("target_audience")} testid="spec-audience-input" /></Section>
      <Section title="Value proposition"><Prose value={c.value_proposition} onChange={set("value_proposition")} testid="spec-value-input" /></Section>
      <Section title="Goals & success criteria">
        <div className="space-y-2" data-testid="spec-goals">
          {c.goals.map((g, i) => (
            <div key={i} className="group grid gap-1 sm:grid-cols-[1fr_1fr_20px] items-start">
              <input className="inline-input text-sm" value={g.goal} placeholder="Goal" onChange={(e) => set("goals")(c.goals.map((x, j) => (j === i ? { ...x, goal: e.target.value } : x)))} data-testid={`spec-goal-${i}`} />
              <input className="inline-input text-sm font-mono text-xs text-muted-foreground" value={g.metric} placeholder="Measurable metric" onChange={(e) => set("goals")(c.goals.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))} />
              <button className="opacity-0 group-hover:opacity-100 mt-1.5" onClick={() => set("goals")(c.goals.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
            </div>
          ))}
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => set("goals")([...c.goals, { goal: "", metric: "" }])} data-testid="spec-add-goal-btn"><Plus className="h-3 w-3" />Add goal</button>
        </div>
      </Section>
      <Section title="User roles & permissions">
        <div className="space-y-4" data-testid="spec-roles">
          {c.roles.map((r, i) => (
            <div key={i} className="group">
              <div className="flex items-center gap-2">
                <input className="inline-input text-sm font-medium" value={r.name} placeholder="Role" onChange={(e) => set("roles")(c.roles.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} data-testid={`spec-role-${i}`} />
                <button className="opacity-0 group-hover:opacity-100" onClick={() => set("roles")(c.roles.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
              <div className="pl-3 mt-1"><ListEditor items={r.permissions} onChange={(p) => set("roles")(c.roles.map((x, j) => (j === i ? { ...x, permissions: p } : x)))} placeholder="Add permission…" testid={`spec-role-${i}-perms`} /></div>
            </div>
          ))}
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => set("roles")([...c.roles, { name: "", permissions: [] }])} data-testid="spec-add-role-btn"><Plus className="h-3 w-3" />Add role</button>
        </div>
      </Section>
      {LISTS.map(([k, t]) => <Section key={k} title={t}><ListEditor items={c[k]} onChange={set(k)} testid={`spec-${k}`} /></Section>)}
    </div>
  );
}
