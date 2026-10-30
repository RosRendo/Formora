import { useMemo, useState } from "react";
import { Route as RouteIcon, Plus, ArrowDown, CheckCircle2, GitBranch, Pencil, Trash2, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDraft } from "@/lib/useDraft";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

const tmpId = () => `fl-${Math.random().toString(36).slice(2, 9)}`;

function FlowEditorSheet({ flow, features, onChange, onDelete, onClose }) {
  if (!flow) return null;
  const set = (k, v) => onChange({ ...flow, [k]: v });
  const featIds = flow.feature_ids || [];
  const routesStr = (flow.screen_routes || []).join(", ");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto" data-testid="flow-editor-sheet">
        <SheetHeader>
          <SheetTitle>Edit user flow</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Flow title</Label>
            <Input value={flow.title || ""} onChange={(e) => set("title", e.target.value)} data-testid="flow-title-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Actor / Role</Label>
              <Input value={flow.role || ""} onChange={(e) => set("role", e.target.value)} placeholder="Member" data-testid="flow-role-input" />
            </div>
            <div className="space-y-1.5">
              <Label>Entry point</Label>
              <Input value={flow.entry_point || ""} onChange={(e) => set("entry_point", e.target.value)} placeholder="/ → /login" data-testid="flow-entry-input" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Primary user goal</Label>
            <Textarea rows={2} value={flow.goal || ""} onChange={(e) => set("goal", e.target.value)} data-testid="flow-goal-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Terminal success outcome</Label>
            <Textarea rows={2} value={flow.success_outcome || ""} onChange={(e) => set("success_outcome", e.target.value)} data-testid="flow-outcome-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Screen routes (comma-separated)</Label>
            <Input
              value={routesStr}
              onChange={(e) =>
                set(
                  "screen_routes",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="/login, /dashboard, /items/:id"
            />
          </div>
          <div className="space-y-2">
            <Label>Linked features</Label>
            <div className="flex flex-wrap gap-1.5">
              {features.map((f) => {
                const active = featIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      set("feature_ids", active ? featIds.filter((id) => id !== f.id) : [...featIds, f.id])
                    }
                    className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                      active ? "border-foreground bg-foreground text-background" : "hairline text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {f.title}
                  </button>
                );
              })}
              {!features.length && <span className="text-xs text-muted-foreground">No features defined yet.</span>}
            </div>
          </div>
          <div className="pt-3 border-t hairline flex justify-between">
            <Button variant="ghost" className="text-destructive" onClick={onDelete} data-testid="delete-flow-btn">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete flow
            </Button>
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function UserFlows() {
  const art = useArtifact("flows");
  const featArt = useArtifact("features");
  const { setAiOpen } = useProject();
  const [flows, setFlows] = useDraft(art.content, (c) => c?.flows || []);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);
  const [editingMeta, setEditingMeta] = useState(false);

  const features = featArt.content?.features || [];
  const featureById = useMemo(() => Object.fromEntries(features.map((f) => [f.id, f])), [features]);

  const roles = useMemo(() => {
    const s = new Set(flows.map((f) => f.role).filter(Boolean));
    return ["ALL", ...s];
  }, [flows]);

  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;

  const dirty = JSON.stringify(flows) !== JSON.stringify(art.content?.flows || []);
  const save = () => art.save({ flows }, { summary: `Updated ${flows.length} user flows` });

  const filtered = roleFilter === "ALL" ? flows : flows.filter((f) => f.role === roleFilter);
  const activeFlow = filtered.find((f) => f.id === selectedId) || filtered[0] || flows[0] || null;

  const updateActive = (patchFn) => {
    if (!activeFlow) return;
    setFlows(flows.map((f) => (f.id === activeFlow.id ? patchFn(f) : f)));
  };

  const addFlow = () => {
    const nf = {
      id: tmpId(),
      title: "New User Journey",
      role: roleFilter !== "ALL" ? roleFilter : "Member",
      entry_point: "/dashboard",
      goal: "Complete the target task cleanly with deterministic feedback.",
      feature_ids: [],
      screen_routes: ["/dashboard"],
      steps: [
        {
          id: tmpId(),
          order: 1,
          actor: "Member",
          action: "Initiates action from workspace view",
          screen: "Dashboard (/dashboard)",
          system_response: "Validates inputs and commits state change",
        },
      ],
      success_outcome: "State updated and persisted with confirmation.",
      branches: [
        {
          id: tmpId(),
          condition: "Validation error on required input",
          handling: "Render field-level message without clearing user draft",
        },
      ],
    };
    setFlows([...flows, nf]);
    setSelectedId(nf.id);
    setEditingMeta(true);
  };

  const addStep = () => {
    updateActive((f) => {
      const nextOrder = (f.steps?.length || 0) + 1;
      return {
        ...f,
        steps: [
          ...(f.steps || []),
          {
            id: tmpId(),
            order: nextOrder,
            actor: f.role || "Member",
            action: "Performs next interaction step",
            screen: f.screen_routes?.[0] || "/dashboard",
            system_response: "Updates view and persists record",
          },
        ],
      };
    });
  };

  const updateStep = (stepId, key, val) => {
    updateActive((f) => ({
      ...f,
      steps: (f.steps || []).map((st) => (st.id === stepId ? { ...st, [key]: val } : st)),
    }));
  };

  const moveStep = (idx, dir) => {
    updateActive((f) => {
      const arr = [...(f.steps || [])];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return f;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return { ...f, steps: arr.map((st, i) => ({ ...st, order: i + 1 })) };
    });
  };

  const removeStep = (stepId) => {
    updateActive((f) => ({
      ...f,
      steps: (f.steps || []).filter((st) => st.id !== stepId).map((st, i) => ({ ...st, order: i + 1 })),
    }));
  };

  const addBranch = () => {
    updateActive((f) => ({
      ...f,
      branches: [
        ...(f.branches || []),
        { id: tmpId(), condition: "Unexpected failure or permission denial", handling: "Display actionable recovery prompt" },
      ],
    }));
  };

  const updateBranch = (bId, key, val) => {
    updateActive((f) => ({
      ...f,
      branches: (f.branches || []).map((b) => (b.id === bId ? { ...b, [key]: val } : b)),
    }));
  };

  const removeBranch = (bId) => {
    updateActive((f) => ({
      ...f,
      branches: (f.branches || []).filter((b) => b.id !== bId),
    }));
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl fade-up">
      <PageHeader
        eyebrow="Plan · Phase 2"
        title="User flows"
        description="Step-by-step journeys per role with entry routes, system responses, linked features, and explicit failure branches."
      >
        <ArtifactBar kind="flows" art={art} workflow="flows" dirty={dirty} onSave={save} />
      </PageHeader>

      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />

      {!flows.length ? (
        <EmptyState
          icon={RouteIcon}
          title="No user flows mapped yet"
          body="Derive role-based user journeys and edge-case branches from your spec and features."
          action="Generate with AI"
          onAction={() => setAiOpen({ workflow: "flows" })}
          testid="flows-empty"
        >
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={addFlow}>
            or create a flow manually
          </button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {/* Top Role Filter & Counter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b hairline">
            <div className="flex flex-wrap items-center gap-1.5" data-testid="flow-role-filters">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    roleFilter === r
                      ? "bg-foreground text-background font-medium"
                      : "border hairline text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {r === "ALL" ? `ALL ROLES (${flows.length})` : r}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={addFlow} data-testid="add-flow-btn">
              <Plus className="h-3.5 w-3.5" />
              New flow
            </Button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[290px_1fr]">
            {/* Left Rail: Flow Index */}
            <aside className="space-y-2" data-testid="flows-list">
              <div className="eyebrow px-1">Journeys ({filtered.length})</div>
              <div className="divide-y divide-border/60 border hairline rounded-md bg-card/40">
                {filtered.map((fl, idx) => {
                  const isSelected = activeFlow?.id === fl.id;
                  return (
                    <button
                      key={fl.id}
                      onClick={() => setSelectedId(fl.id)}
                      data-testid={`flow-card-${idx}`}
                      className={`w-full text-left p-3.5 transition-colors ${
                        isSelected ? "bg-accent/70" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                        <span>§ {String(idx + 1).padStart(2, "0")}</span>
                        <span className="truncate">{fl.role || "Member"}</span>
                      </div>
                      <div className="mt-1 text-sm font-medium leading-snug">{fl.title}</div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                        <span>{(fl.steps || []).length} steps</span>
                        <span>·</span>
                        <span>{(fl.branches || []).length} branches</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Schematic Sheet: Active Journey Diagram */}
            {activeFlow && (
              <section className="border hairline rounded-md bg-card/30 p-5 md:p-6 space-y-6" data-testid="active-flow-schematic">
                {/* Schematic Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-5 border-b hairline">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
                      <span className="rounded border hairline bg-muted/50 px-2 py-0.5 text-foreground">{activeFlow.role}</span>
                      <span>ENTRY: {activeFlow.entry_point || "/"}</span>
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight">{activeFlow.title}</h2>
                    {activeFlow.goal && <p className="text-sm text-muted-foreground max-w-2xl">{activeFlow.goal}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 shrink-0"
                    onClick={() => setEditingMeta(true)}
                    data-testid="edit-flow-meta-btn"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit details
                  </Button>
                </div>

                {/* Linked Features & Routes Strip */}
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded border hairline p-3 bg-background/60">
                    <div className="eyebrow mb-1.5">Linked features</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeFlow.feature_ids || []).map((fid) => (
                        <span key={fid} className="rounded border hairline px-2 py-0.5 font-medium bg-card">
                          {featureById[fid]?.title || fid}
                        </span>
                      ))}
                      {!(activeFlow.feature_ids || []).length && (
                        <span className="text-muted-foreground">None linked — click Edit details to link features</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded border hairline p-3 bg-background/60">
                    <div className="eyebrow mb-1.5">Traversed routes</div>
                    <div className="flex flex-wrap gap-1.5 font-mono">
                      {(activeFlow.screen_routes || []).map((rt) => (
                        <span key={rt} className="rounded bg-muted px-2 py-0.5 text-[11px]">
                          {rt}
                        </span>
                      ))}
                      {!(activeFlow.screen_routes || []).length && <span className="text-muted-foreground">—</span>}
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Journey Rail */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="eyebrow">Step-by-step execution sequence</div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addStep} data-testid="add-flow-step-btn">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add step
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(activeFlow.steps || []).map((st, idx) => (
                      <div key={st.id || idx}>
                        <div className="group rounded border hairline bg-background p-3.5 transition-colors hover:border-foreground/30">
                          <div className="flex items-start gap-3">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded border hairline font-mono text-[11px] font-semibold bg-muted/50">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="grid gap-2 sm:grid-cols-[130px_1fr_180px]">
                                <input
                                  className="rounded border hairline bg-muted/30 px-2 py-1 font-mono text-xs"
                                  value={st.actor || ""}
                                  onChange={(e) => updateStep(st.id, "actor", e.target.value)}
                                  placeholder="Actor"
                                  aria-label="Step actor"
                                />
                                <input
                                  className="rounded border hairline bg-transparent px-2.5 py-1 text-sm font-medium"
                                  value={st.action || ""}
                                  onChange={(e) => updateStep(st.id, "action", e.target.value)}
                                  placeholder="User or system action"
                                  aria-label="Step action"
                                />
                                <input
                                  className="rounded border hairline bg-muted/20 px-2 py-1 font-mono text-xs text-muted-foreground"
                                  value={st.screen || ""}
                                  onChange={(e) => updateStep(st.id, "screen", e.target.value)}
                                  placeholder="Screen (/route)"
                                  aria-label="Step screen"
                                />
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono text-[11px] text-muted-foreground shrink-0">SYSTEM →</span>
                                <input
                                  className="flex-1 bg-transparent border-b border-transparent focus:border-border outline-none py-0.5 text-muted-foreground focus:text-foreground"
                                  value={st.system_response || ""}
                                  onChange={(e) => updateStep(st.id, "system_response", e.target.value)}
                                  placeholder="Expected system response, API call, or state transition"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => moveStep(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                title="Move up"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveStep(idx, 1)}
                                disabled={idx === (activeFlow.steps || []).length - 1}
                                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                title="Move down"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeStep(st.id)}
                                className="p-1 text-muted-foreground hover:text-destructive"
                                title="Remove step"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {idx < (activeFlow.steps || []).length - 1 && (
                          <div className="flex justify-start pl-6 py-0.5 text-border">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Success Outcome Terminal */}
                <div className="rounded border hairline border-l-4 border-l-[hsl(var(--success))] bg-background p-3.5">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[hsl(var(--success))] mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Happy-path terminal state</span>
                  </div>
                  <p className="text-sm">{activeFlow.success_outcome || "User completes flow and state is committed."}</p>
                </div>

                {/* Failure & Edge Branches */}
                <div className="space-y-2.5 pt-2 border-t hairline">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="eyebrow">Failure & edge-case branches</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addBranch} data-testid="add-branch-btn">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add branch
                    </Button>
                  </div>
                  <div className="divide-y divide-border/60 rounded border hairline bg-background">
                    {(activeFlow.branches || []).map((br) => (
                      <div key={br.id} className="grid gap-2 sm:grid-cols-[1fr_1.3fr_auto] items-center p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            IF
                          </span>
                          <input
                            className="w-full bg-transparent font-medium outline-none border-b border-transparent focus:border-border py-0.5"
                            value={br.condition || ""}
                            onChange={(e) => updateBranch(br.id, "condition", e.target.value)}
                            placeholder="Failure or edge condition"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">THEN →</span>
                          <input
                            className="w-full bg-transparent text-muted-foreground focus:text-foreground outline-none border-b border-transparent focus:border-border py-0.5"
                            value={br.handling || ""}
                            onChange={(e) => updateBranch(br.id, "handling", e.target.value)}
                            placeholder="System recovery / HTTP error handling"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBranch(br.id)}
                          className="p-1 text-muted-foreground hover:text-destructive justify-self-end"
                          title="Delete branch"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {!(activeFlow.branches || []).length && (
                      <div className="p-3 text-xs text-muted-foreground">No edge branches documented for this flow.</div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {editingMeta && activeFlow && (
        <FlowEditorSheet
          flow={activeFlow}
          features={features}
          onClose={() => setEditingMeta(false)}
          onChange={(updated) => setFlows(flows.map((f) => (f.id === updated.id ? updated : f)))}
          onDelete={() => {
            const next = flows.filter((f) => f.id !== activeFlow.id);
            setFlows(next);
            setSelectedId(next[0]?.id || null);
            setEditingMeta(false);
          }}
        />
      )}
    </div>
  );
}

