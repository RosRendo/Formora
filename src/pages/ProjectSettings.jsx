import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { http, errMsg } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import { PageHeader, PageLoading } from "@/components/common";

export default function ProjectSettings() {
  const { pid, project, refresh } = useProject();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  const [confirm, setConfirm] = useState("");
  useEffect(() => { if (project) setF({ name: project.name, description: project.description }); }, [project]);
  if (!f) return <PageLoading />;
  const patch = async (body, msg) => {
    try { await http.patch(`/projects/${pid}`, body); toast.success(msg); refresh(); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async () => {
    try { await http.delete(`/projects/${pid}`); toast.success("Project deleted"); nav("/projects"); } catch (e) { toast.error(errMsg(e)); }
  };
  const archived = project.status === "archived";
  return (
    <div className="px-6 md:px-10 py-8 max-w-2xl fade-up">
      <PageHeader eyebrow="Deliver" title="Project settings" />
      <section className="space-y-4">
        <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="settings-name-input" /></div>
        <div className="space-y-1.5"><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="settings-description-input" /></div>
        <Button size="sm" onClick={() => patch(f, "Project updated")} disabled={!f.name.trim()} data-testid="settings-save-btn">Save changes</Button>
      </section>
      <section className="mt-14 border-t hairline pt-8 space-y-3">
        <h2 className="text-sm font-semibold">{archived ? "Restore project" : "Archive project"}</h2>
        <p className="text-sm text-muted-foreground">{archived ? "Bring the project back to your active list." : "Archived projects are hidden from the dashboard but keep all data and history. You can restore them any time from Projects → Show archived."}</p>
        <Button size="sm" variant="outline" onClick={() => patch({ archived: !archived }, archived ? "Project restored" : "Project archived")} data-testid="settings-archive-btn">{archived ? "Restore" : "Archive"}</Button>
      </section>
      <section className="mt-10 border-t hairline pt-8 space-y-3">
        <h2 className="text-sm font-semibold text-destructive">Delete project</h2>
        <p className="text-sm text-muted-foreground">Permanently removes the project, every artifact, version, task and decision. This cannot be undone.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button size="sm" variant="destructive" data-testid="settings-delete-btn">Delete project</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
              <AlertDialogDescription>Type the project name to confirm. All data will be permanently deleted.</AlertDialogDescription></AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={project.name} data-testid="settings-delete-confirm-input" />
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={confirm !== project.name} onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="settings-delete-confirm-btn">Delete permanently</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
