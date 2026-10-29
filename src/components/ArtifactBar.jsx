import { useState } from "react";
import { Check, Lock, Sparkles, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/context/ProjectContext";
import { KIND_LABEL } from "@/lib/api";
import { refsFrom } from "@/lib/diff";
import VersionHistory from "./VersionHistory";
import DiffView from "./DiffView";

const STATUS = {
  empty: ["Empty", "text-muted-foreground bg-muted"],
  draft: ["Draft", "text-accent-foreground bg-accent"],
  changed: ["Changed since approval", "text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)]"],
  approved: ["Approved", "text-[hsl(var(--success))] bg-[hsl(var(--success)/0.12)]"],
};

export function StatusPill({ artifact }) {
  const [label, cls] = STATUS[artifact?.status || "empty"] || STATUS.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`} data-testid="artifact-status">
      {artifact?.status === "approved" && <Lock className="h-3 w-3" />}{label}
      {artifact?.current_version > 0 && <span className="font-mono opacity-70">· v{artifact.current_version}</span>}
    </span>
  );
}

export function ReviewBanner({ artifact, onResolve }) {
  if (!artifact?.needs_review) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-md bg-[hsl(var(--warning)/0.1)] px-4 py-3 text-sm fade-up" data-testid="needs-review-banner">
      <AlertTriangle className="h-4 w-4 mt-0.5 text-[hsl(var(--warning))]" />
      <div className="flex-1"><b className="font-medium">Needs review.</b> <span className="text-muted-foreground">{artifact.review_reason}. Check whether this artifact still matches its upstream.</span></div>
      <Button size="sm" variant="outline" className="h-7" onClick={onResolve} data-testid="resolve-review-btn">Mark reviewed</Button>
    </div>
  );
}

export default function ArtifactBar({ kind, art, workflow, dirty, onSave, extra }) {
  const { setAiOpen } = useProject();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const a = art.artifact;
  const doApprove = async () => {
    if (dirty) await onSave?.();
    if (await art.approve(note)) { setOpen(false); setNote(""); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`${kind}-artifact-bar`}>
      <StatusPill artifact={a} />
      {extra}
      {onSave && (
        <Button size="sm" variant={dirty ? "default" : "outline"} className="h-8 gap-1.5" onClick={onSave} disabled={!dirty} data-testid={`${kind}-save-btn`}>
          <Save className="h-3.5 w-3.5" />{dirty ? "Save version" : "Saved"}
        </Button>
      )}
      <VersionHistory kind={kind} current={art.content} onRestored={() => art.load()} />
      {workflow && (
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAiOpen({ workflow })} data-testid={`${kind}-ai-generate-btn`}>
          <Sparkles className="h-3.5 w-3.5 text-primary" />Generate with AI
        </Button>
      )}
      <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={!a?.current_version || (a.status === "approved" && !dirty)} onClick={() => setOpen(true)} data-testid={`${kind}-approve-btn`}>
        <Check className="h-3.5 w-3.5" />Approve
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto" data-testid="approve-panel">
          <SheetHeader>
            <SheetTitle>Approve {KIND_LABEL[kind]}</SheetTitle>
            <SheetDescription>Approval locks this version as the baseline that AI workflows and downstream artifacts use. Review what changes compared with the last approved version.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <div className="eyebrow">{art.approved ? "Last approved → current" : "First approval"}</div>
            <DiffView before={art.approved || {}} after={art.content} refs={refsFrom(art.approved, art.content)} testid="approve-diff" maxHeight="45vh" />
            <Textarea placeholder="Reasoning for the decision log (optional)" value={note} onChange={(e) => setNote(e.target.value)} data-testid="approve-note-input" />
            <Button className="w-full" onClick={doApprove} data-testid="confirm-approve-btn"><Lock className="h-3.5 w-3.5 mr-1.5" />Approve and lock</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
