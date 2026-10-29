import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Check, X, AlertCircle, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { http, errMsg, KIND_LABEL } from "@/lib/api";
import { refsFrom } from "@/lib/diff";
import { useProject, announceImpact } from "@/context/ProjectContext";
import DiffView from "@/components/DiffView";

function Proposal({ job, onDone }) {
  const { pid, refresh } = useProject();
  const [current, setCurrent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    http.get(`/projects/${pid}/artifacts/${job.target_kind}`).then(({ data }) => setCurrent(data.content || {}));
    setText(JSON.stringify(job.output, null, 2));
  }, [pid, job]);
  const accept = async () => {
    let content;
    try { content = editing ? JSON.parse(text) : undefined; } catch { return toast.error("Edited JSON is not valid"); }
    setBusy(true);
    try {
      const { data } = await http.post(`/projects/${pid}/ai/jobs/${job.id}/accept`, { content });
      toast.success(`Applied as v${data.artifact.current_version}`);
      announceImpact(data.impact);
      window.dispatchEvent(new CustomEvent("bp:artifact", { detail: { kind: job.target_kind } }));
      refresh();
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  const discard = async () => {
    await http.post(`/projects/${pid}/ai/jobs/${job.id}/discard`);
    toast("Proposal discarded");
    onDone();
  };
  return (
    <div className="space-y-4 fade-up" data-testid="ai-proposal">
      <div className="eyebrow">Proposed change to {KIND_LABEL[job.target_kind]}</div>
      {job.notes && <details className="text-sm text-muted-foreground" data-testid="ai-proposal-notes"><summary className="cursor-pointer select-none line-clamp-2">{job.notes}</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed">{job.notes}</p></details>}
      {current && !editing && <DiffView before={current} after={job.output} refs={refsFrom(current, job.output)} testid="ai-diff" maxHeight="48vh" />}
      {editing && <Textarea className="font-mono text-[11px] min-h-[360px]" value={text} onChange={(e) => setText(e.target.value)} data-testid="ai-proposal-json-editor" />}
      <div className="flex gap-2">
        <Button className="flex-1 gap-1.5" onClick={accept} disabled={busy} data-testid="ai-accept-btn"><Check className="h-4 w-4" />Accept{editing ? " edited" : ""}</Button>
        <Button variant="outline" onClick={() => setEditing(!editing)} data-testid="ai-edit-btn">{editing ? "View diff" : "Edit"}</Button>
        <Button variant="ghost" onClick={discard} data-testid="ai-discard-btn"><X className="h-4 w-4 mr-1" />Discard</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Accepting creates a new version. It does not approve the artifact.</p>
    </div>
  );
}

export default function AIPanel() {
  const { pid, project, aiOpen, setAiOpen } = useProject();
  const [wfs, setWfs] = useState([]);
  const [sel, setSel] = useState(null);
  const [instr, setInstr] = useState("");
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const timer = useRef(null);
  const open = !!aiOpen;

  const poll = (id) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await http.get(`/projects/${pid}/ai/jobs/${id}`);
        setJob(data);
        if (data.status === "running") poll(id);
      } catch { poll(id); }
    }, 2500);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (open && !wfs.length) http.get("/ai/workflows").then(({ data }) => setWfs(data)); }, [open, wfs.length]);
  useEffect(() => {
    if (!open) return;
    if (aiOpen.workflow) setSel(aiOpen.workflow);
    http.get(`/projects/${pid}/ai/jobs`).then(({ data }) => {
      setHistory(data);
      const live = data.find((j) => j.status === "running" || j.status === "proposed");
      if (live) http.get(`/projects/${pid}/ai/jobs/${live.id}`).then(({ data: d }) => { setJob(d); if (d.status === "running") poll(d.id); });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pid]);

  const run = async () => {
    try {
      const { data } = await http.post(`/projects/${pid}/ai/${sel}`, { instructions: instr });
      setJob(data);
      poll(data.id);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const arts = project?.artifacts || {};
  const wf = wfs.find((w) => w.id === sel);
  const missing = wf ? wf.requires.filter((k) => arts[k]?.status !== "approved" && !arts[k]?.approved_version) : [];
  const done = () => { setJob(null); setInstr(""); http.get(`/projects/${pid}/ai/jobs`).then(({ data }) => setHistory(data)); };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setAiOpen(null)}>
      <SheetContent className="w-full sm:max-w-[620px] overflow-y-auto" data-testid="ai-assistant-panel">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />AI Assistant</SheetTitle>
          <SheetDescription>Each workflow reads only approved artifacts and returns a proposed change for you to review.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {job?.status === "running" && (
            <div className="flex items-center gap-3 rounded-md bg-accent px-4 py-4 text-sm" data-testid="ai-job-running">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1"><div className="font-medium">Generating {KIND_LABEL[job.target_kind]}…</div><div className="text-xs text-muted-foreground">This can take a minute or two. You can close this panel; progress is saved.</div></div>
            </div>
          )}
          {job?.status === "failed" && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm space-y-2" data-testid="ai-job-error">
              <div className="flex gap-2 text-destructive"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{job.error}</div>
              <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setSel(job.workflow); setJob(null); }} data-testid="ai-retry-btn">Retry</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await http.post(`/projects/${pid}/ai/jobs/${job.id}/discard`); done(); }}>Dismiss</Button></div>
            </div>
          )}
          {job?.status === "proposed" && <Proposal job={job} onDone={done} />}
          {(!job || ["applied", "discarded"].includes(job.status)) && (
            <>
              <div className="space-y-1" data-testid="ai-workflow-list">
                {wfs.map((w) => {
                  const ok = w.requires.every((k) => arts[k]?.approved_version);
                  return (
                    <button key={w.id} onClick={() => setSel(w.id)} data-testid={`ai-workflow-${w.id}`}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${sel === w.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
                      <span className="flex-1">{w.label}<span className="block text-[11px] text-muted-foreground">→ {KIND_LABEL[w.target]}</span></span>
                      {!ok && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  );
                })}
                {["Generate UI blueprint", "Review security risks", "Generate test plans", "Review deployment readiness"].map((l) => (
                  <div key={l} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground/70">{l}<span className="text-[10px] ml-auto">later phase</span></div>
                ))}
              </div>
              {wf && (
                <div className="space-y-3 fade-up">
                  {missing.length > 0 && <div className="text-xs text-[hsl(var(--warning))]" data-testid="ai-missing-prereqs">Approve first: {missing.map((k) => KIND_LABEL[k]).join(", ")}</div>}
                  <Textarea placeholder="Optional instructions (e.g. keep MVP under 6 features)" value={instr} onChange={(e) => setInstr(e.target.value)} data-testid="ai-instructions-input" />
                  <Button className="w-full gap-1.5" onClick={run} disabled={missing.length > 0} data-testid="ai-run-btn"><Sparkles className="h-4 w-4" />Run: {wf.label}</Button>
                </div>
              )}
              {history.length > 0 && (
                <div>
                  <div className="eyebrow mb-2">Recent runs & usage</div>
                  <div className="divide-y divide-border/60 text-xs" data-testid="ai-history">
                    {history.slice(0, 8).map((h) => (
                      <div key={h.id} className="flex items-center gap-3 py-2">
                        <span className="flex-1 truncate">{wfs.find((w) => w.id === h.workflow)?.label || h.workflow}</span>
                        <span className={`font-mono ${h.status === "failed" ? "text-destructive" : h.status === "applied" ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`}>{h.status}</span>
                        <span className="font-mono text-muted-foreground w-16 text-right">{Math.round((h.input_chars + h.output_chars) / 4).toLocaleString()} tok</span>
                        <span className="font-mono text-muted-foreground w-12 text-right">{(h.duration_ms / 1000).toFixed(0)}s</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
