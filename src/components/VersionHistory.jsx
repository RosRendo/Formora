import { useEffect, useState } from "react";
import { History, RotateCcw, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { http, errMsg, KIND_LABEL } from "@/lib/api";
import { refsFrom } from "@/lib/diff";
import { useProject, announceImpact } from "@/context/ProjectContext";
import DiffView from "./DiffView";

export default function VersionHistory({ kind, current, onRestored }) {
  const { pid, refresh } = useProject();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    if (!open) return;
    http.get(`/projects/${pid}/artifacts/${kind}/versions`).then(({ data }) => { setList(data); setSel(data[0] || null); }).catch((e) => toast.error(errMsg(e)));
  }, [open, pid, kind]);

  const restore = async (v) => {
    try {
      const { data } = await http.post(`/projects/${pid}/artifacts/${kind}/versions/${v}/restore`);
      toast.success(`Restored v${v} as v${data.artifact.current_version}`);
      announceImpact(data.impact);
      setOpen(false);
      refresh();
      onRestored?.(data.content);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)} data-testid={`${kind}-history-btn`}>
        <History className="h-3.5 w-3.5" />History
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-[640px] overflow-y-auto" data-testid="version-history-panel">
          <SheetHeader>
            <SheetTitle>{KIND_LABEL[kind]} — version history</SheetTitle>
            <SheetDescription>Compare any version with the current working copy and restore it as a new version.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex flex-col gap-1">
            {list === null && <div className="text-sm text-muted-foreground">Loading…</div>}
            {list?.length === 0 && <div className="text-sm text-muted-foreground">No versions yet.</div>}
            {list?.map((v) => (
              <button key={v.version} onClick={() => setSel(v)} data-testid={`version-row-${v.version}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${sel?.version === v.version ? "bg-accent" : "hover:bg-muted"}`}>
                <span className="font-mono text-xs w-8">v{v.version}</span>
                <span className="flex-1 truncate">{v.summary}</span>
                {v.approved && <span className="flex items-center gap-1 text-[11px] text-[hsl(var(--success))]"><Check className="h-3 w-3" />approved</span>}
                <span className="text-[11px] text-muted-foreground font-mono">{v.source}</span>
                <span className="text-[11px] text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
          {sel && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="eyebrow">v{sel.version} → current working copy</div>
                <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => restore(sel.version)} data-testid={`restore-version-${sel.version}-btn`}>
                  <RotateCcw className="h-3 w-3" />Restore v{sel.version}
                </Button>
              </div>
              <DiffView before={sel.content} after={current} refs={refsFrom(sel.content, current)} testid="history-diff" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
