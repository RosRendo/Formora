import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import ListEditor from "@/components/ListEditor";
import { PageError, PageHeader, PageLoading } from "@/components/common";

const ROWS = [
  ["description", "Description"], ["target_users", "Target users"], ["problems", "Problems"], ["business_model", "Business model"],
  ["platform", "Platform"], ["languages", "Languages & frameworks"], ["hosting", "Hosting"], ["database", "Database"],
  ["auth", "Authentication"], ["payments", "Payments"], ["budget", "Budget"], ["scale", "Expected scale"],
  ["deadline", "Deadline"], ["available_time", "Available time"],
];

export default function Brief() {
  const art = useArtifact("brief");
  const { pid } = useProject();
  const nav = useNavigate();
  const [c, setC] = useState(null);
  useEffect(() => { if (art.content) setC(art.content); }, [art.content]);
  if (art.loading || (!c && !art.error)) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;
  const dirty = JSON.stringify(c) !== JSON.stringify(art.content);
  const assumed = new Set((c.assumptions || []).map((a) => a.field));
  const set = (k, val) => {
    const assumptions = (c.assumptions || []).filter((a) => a.field !== k || val === c[k]);
    setC({ ...c, [k]: val, assumptions });
  };
  const save = () => art.save(c, { summary: "Edited brief" });

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl fade-up">
      <PageHeader eyebrow="Step 1 · Review" title="Project brief" description="Check every line. Fields marked as assumptions were not answered in the wizard — edit them to replace the assumption with a decision.">
        <ArtifactBar kind="brief" art={art} dirty={dirty} onSave={save} />
      </PageHeader>
      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />
      <input className="inline-input text-3xl font-semibold tracking-tight mb-6" value={c.name} onChange={(e) => set("name", e.target.value)} data-testid="brief-name-input" />
      <dl className="divide-y divide-border/60" data-testid="brief-fields">
        {ROWS.map(([k, label]) => (
          <div key={k} className="grid gap-2 py-3 md:grid-cols-[200px_1fr]">
            <dt className="text-sm text-muted-foreground pt-1 flex items-center gap-2">{label}
              {assumed.has(k) && <span className="rounded bg-[hsl(var(--warning)/0.14)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--warning))]" data-testid={`assumption-${k}`}>Assumption</span>}
            </dt>
            <dd><textarea rows={1} className="inline-input text-sm resize-none [field-sizing:content]" value={c[k] || ""} onChange={(e) => set(k, e.target.value)} data-testid={`brief-${k}-input`} /></dd>
          </div>
        ))}
        <div className="grid gap-2 py-3 md:grid-cols-[200px_1fr]">
          <dt className="text-sm text-muted-foreground pt-1">MVP features {assumed.has("mvp_features") && <span className="ml-2 rounded bg-[hsl(var(--warning)/0.14)] px-1.5 py-0.5 text-[10px] text-[hsl(var(--warning))]">Assumption</span>}</dt>
          <dd><ListEditor items={c.mvp_features || []} onChange={(v) => set("mvp_features", v)} testid="brief-mvp-features" /></dd>
        </div>
      </dl>
      {c.assumptions?.length > 0 && (
        <div className="mt-8 rounded-md bg-muted/50 p-4 text-sm" data-testid="brief-assumptions">
          <div className="flex items-center gap-2 font-medium mb-2"><Info className="h-4 w-4 text-[hsl(var(--warning))]" />{c.assumptions.length} assumption(s) in use</div>
          <ul className="space-y-1 text-muted-foreground">{c.assumptions.map((a) => <li key={a.field}><span className="font-mono text-xs">{a.field}</span> — {a.assumption}</li>)}</ul>
        </div>
      )}
      {art.artifact?.status === "approved" && (
        <div className="mt-10 flex items-center justify-between rounded-md bg-accent px-5 py-4" data-testid="brief-next-step">
          <div className="text-sm"><b className="font-medium">Brief approved.</b> <span className="text-muted-foreground">Next, generate the product requirements from it.</span></div>
          <Button size="sm" onClick={() => nav(`/p/${pid}/requirements`)} data-testid="brief-continue-btn">Requirements<ArrowRight className="h-4 w-4 ml-1" /></Button>
        </div>
      )}
    </div>
  );
}
