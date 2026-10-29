import { useCallback, useEffect, useState } from "react";
import { ScrollText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { http, errMsg, KIND_LABEL } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import { EmptyState, PageHeader, PageLoading } from "@/components/common";

const CAT = { approval: "bg-[hsl(var(--success))]", ai: "bg-primary", revert: "bg-[hsl(var(--warning))]", review: "bg-[hsl(var(--info))]", task: "bg-[hsl(var(--success))]", decision: "bg-foreground" };

export default function DecisionLog() {
  const { pid } = useProject();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const load = useCallback(() => http.get(`/projects/${pid}/decisions`).then(({ data }) => setList(data)), [pid]);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    try { await http.post(`/projects/${pid}/decisions`, form); setForm(null); toast.success("Decision recorded"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  if (!list) return <PageLoading />;
  return (
    <div className="px-6 md:px-10 py-8 max-w-3xl fade-up">
      <PageHeader eyebrow="Deliver" title="Decision log" description="Every approval, revert, accepted AI proposal and recorded choice, with its reasoning.">
        <Button size="sm" onClick={() => setForm({ title: "", decision: "", reasoning: "" })} data-testid="add-decision-btn"><Plus className="h-4 w-4 mr-1" />Record decision</Button>
      </PageHeader>
      {form && (
        <div className="mb-8 space-y-2 rounded-md bg-muted/40 p-4 fade-up" data-testid="decision-form">
          <Input placeholder="Title (e.g. Use PostgreSQL over MongoDB)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="decision-title-input" />
          <Textarea placeholder="Decision" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })} data-testid="decision-text-input" />
          <Textarea placeholder="Reasoning" value={form.reasoning} onChange={(e) => setForm({ ...form, reasoning: e.target.value })} data-testid="decision-reasoning-input" />
          <div className="flex gap-2"><Button size="sm" onClick={add} disabled={!form.title.trim()} data-testid="decision-save-btn">Save</Button><Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancel</Button></div>
        </div>
      )}
      {!list.length ? <EmptyState icon={ScrollText} title="No decisions yet" body="Approvals and accepted AI changes are recorded automatically." /> : (
        <ol className="relative border-l hairline ml-1.5" data-testid="decision-list">
          {list.map((d) => (
            <li key={d.id} className="relative pl-6 pb-7" data-testid={`decision-${d.id}`}>
              <span className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${CAT[d.category] || "bg-muted-foreground"}`} />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm font-medium">{d.title}</span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">{d.category}{d.artifact_kind && ` · ${KIND_LABEL[d.artifact_kind]}`}</span>
              </div>
              {d.decision && <p className="mt-1 text-sm text-muted-foreground">{d.decision}</p>}
              {d.reasoning && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap"><span className="eyebrow mr-1.5">Why</span>{d.reasoning}</p>}
              <div className="mt-1 font-mono text-[11px] text-muted-foreground/80">{new Date(d.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
