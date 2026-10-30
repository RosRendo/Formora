import { useMemo, useState } from "react";
import { ShieldCheck, Plus, CheckCircle2, Clock, MinusCircle, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDraft } from "@/lib/useDraft";
import { useArtifact, useProject } from "@/context/ProjectContext";
import ArtifactBar, { ReviewBanner } from "@/components/ArtifactBar";
import { EmptyState, PageError, PageHeader, PageLoading } from "@/components/common";

const tmpId = () => `sec-${Math.random().toString(36).slice(2, 9)}`;

const CATEGORIES = [
  "Authentication",
  "Authorization & IDOR",
  "Input Validation",
  "Secrets Hygiene",
  "Database Policies",
  "Payments & Webhooks",
  "Uploads & Storage",
  "Rate Limiting",
  "Audit Logging",
  "Backups & Recovery",
];

const SEVERITY_STYLE = {
  critical: "text-destructive border-destructive/40 bg-destructive/10",
  high: "text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)]",
  medium: "text-foreground border-border bg-muted/60",
  low: "text-muted-foreground border-border bg-muted/30",
};

const NEXT_STATUS = {
  planned: "implemented",
  implemented: "n/a",
  "n/a": "planned",
};

function ControlEditorSheet({ control, endpoints, entities, onChange, onDelete, onClose }) {
  if (!control) return null;
  const set = (k, v) => onChange({ ...control, [k]: v });
  const refs = control.linked_refs || [];

  const availableRefs = [
    ...endpoints.map((e) => `${e.method} ${e.path}`),
    ...entities.map((e) => e.name),
  ];

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto" data-testid="control-editor-sheet">
        <SheetHeader>
          <SheetTitle>Edit security control</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Control title</Label>
            <Input value={control.title || ""} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Domain</Label>
              <Select value={control.category || CATEGORIES[0]} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={control.severity || "high"} onValueChange={(v) => set("severity", v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["critical", "high", "medium", "low"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={control.status || "planned"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="implemented">Implemented</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="n/a">Not Applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Technical mitigation</Label>
            <Textarea rows={3} value={control.mitigation || ""} onChange={(e) => set("mitigation", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Verification / audit assertion</Label>
            <Textarea rows={2} value={control.verification || ""} onChange={(e) => set("verification", e.target.value)} />
          </div>

          {availableRefs.length > 0 && (
            <div className="space-y-2">
              <Label>Linked endpoints & tables</Label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {availableRefs.map((ref) => {
                  const active = refs.includes(ref);
                  return (
                    <button
                      key={ref}
                      type="button"
                      onClick={() => set("linked_refs", active ? refs.filter((r) => r !== ref) : [...refs, ref])}
                      className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                        active ? "border-foreground bg-foreground text-background" : "hairline text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {ref}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-3 border-t hairline flex justify-between">
            <Button variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete control
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

export default function SecurityPlan() {
  const art = useArtifact("security");
  const apiArt = useArtifact("api");
  const schemaArt = useArtifact("schema");
  const { setAiOpen } = useProject();

  const [draft, setDraft] = useDraft(art.content, (c) => ({
    posture_summary: c?.posture_summary || "",
    controls: c?.controls || [],
    threats: c?.threats || [],
  }));

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editingControlId, setEditingControlId] = useState(null);

  const controls = draft.controls || [];
  const threats = draft.threats || [];
  const endpoints = apiArt.content?.endpoints || [];
  const entities = schemaArt.content?.entities || [];

  const stats = useMemo(() => {
    const applicable = controls.filter((c) => c.status !== "n/a");
    const implemented = controls.filter((c) => c.status === "implemented").length;
    const planned = controls.filter((c) => c.status === "planned").length;
    const na = controls.filter((c) => c.status === "n/a").length;
    const critTotal = applicable.filter((c) => c.severity === "critical").length;
    const critDone = applicable.filter((c) => c.severity === "critical" && c.status === "implemented").length;
    const pct = applicable.length ? Math.round((implemented / applicable.length) * 100) : 0;
    return { implemented, planned, na, critTotal, critDone, pct };
  }, [controls]);

  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;

  const orig = {
    posture_summary: art.content?.posture_summary || "",
    controls: art.content?.controls || [],
    threats: art.content?.threats || [],
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(orig);
  const save = () => art.save(draft, { summary: `Updated security plan (${stats.implemented}/${controls.length} implemented)` });

  const filteredControls = statusFilter === "ALL" ? controls : controls.filter((c) => c.status === statusFilter);
  const activeControl = controls.find((c) => c.id === editingControlId) || null;

  const cycleStatus = (id) => {
    setDraft({
      ...draft,
      controls: controls.map((c) => (c.id === id ? { ...c, status: NEXT_STATUS[c.status] || "implemented" } : c)),
    });
  };

  const addControl = () => {
    const nc = {
      id: tmpId(),
      category: "Authorization & IDOR",
      title: "New Security Control",
      severity: "high",
      status: "planned",
      mitigation: "Specify concrete server-side enforcement mechanism.",
      verification: "Specify automated or manual verification test.",
      linked_refs: [],
    };
    setDraft({ ...draft, controls: [nc, ...controls] });
    setEditingControlId(nc.id);
  };

  const addThreat = () => {
    setDraft({
      ...draft,
      threats: [
        ...threats,
        {
          id: tmpId(),
          risk: "New threat scenario",
          severity: "high",
          vector: "Attack surface / entry vector",
          mitigation: "Concrete defense control",
        },
      ],
    });
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl fade-up">
      <PageHeader
        eyebrow="Engineer · Phase 2"
        title="Security plan"
        description="Honest separation between implemented and planned controls across auth, IDOR, validation, secrets, database policies, payments, rate limiting, and backups."
      >
        <ArtifactBar kind="security" art={art} workflow="security" dirty={dirty} onSave={save} />
      </PageHeader>

      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />

      {!controls.length ? (
        <EmptyState
          icon={ShieldCheck}
          title="No security controls defined yet"
          body="Generate a tailored security checklist and threat review linked to your architecture, database tables, and API endpoints."
          action="Generate with AI"
          onAction={() => setAiOpen({ workflow: "security" })}
          testid="security-empty"
        >
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={addControl}>
            or add a control manually
          </button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {/* Posture & Readiness Meter */}
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-md border hairline bg-card/30 p-4 space-y-2">
              <div className="eyebrow">Security posture summary</div>
              <Textarea
                rows={2}
                value={draft.posture_summary || ""}
                onChange={(e) => setDraft({ ...draft, posture_summary: e.target.value })}
                className="text-sm bg-transparent border-0 p-0 focus-visible:ring-0 resize-none"
                placeholder="Summarize defense-in-depth posture..."
              />
            </div>

            <div className="rounded-md border hairline bg-card/30 p-4 flex flex-col justify-between gap-3" data-testid="security-readiness-card">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Implemented vs Planned</span>
                <span className="font-mono text-lg font-semibold">{stats.pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-[hsl(var(--success))] transition-all duration-300" style={{ width: `${stats.pct}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                <span>
                  <b className="text-foreground">{stats.implemented}</b> implemented
                </span>
                <span>
                  <b className="text-foreground">{stats.planned}</b> planned
                </span>
                <span>
                  <b className="text-foreground">
                    {stats.critDone}/{stats.critTotal}
                  </b>{" "}
                  critical active
                </span>
              </div>
            </div>
          </div>

          {/* Filter & Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b hairline">
            <div className="flex flex-wrap items-center gap-1.5" data-testid="security-status-filters">
              {[
                ["ALL", `ALL (${controls.length})`],
                ["implemented", `IMPLEMENTED (${stats.implemented})`],
                ["planned", `PLANNED (${stats.planned})`],
                ["n/a", `N/A (${stats.na})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`px-2.5 py-1 rounded font-mono text-xs transition-colors ${
                    statusFilter === id ? "bg-foreground text-background" : "border hairline text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={addControl} data-testid="add-control-btn">
              <Plus className="h-3.5 w-3.5" />
              Add control
            </Button>
          </div>

          {/* Controls Matrix */}
          <div className="rounded-md border hairline divide-y divide-border/60 bg-card/20" data-testid="security-controls-list">
            {filteredControls.map((c) => (
              <div key={c.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between hover:bg-muted/25 transition-colors">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{c.category}</span>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${SEVERITY_STYLE[c.severity] || SEVERITY_STYLE.high}`}>
                      {c.severity}
                    </span>
                  </div>
                  <div className="text-sm font-semibold">{c.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.mitigation}</p>
                  {c.verification && (
                    <div className="text-xs font-mono text-muted-foreground pt-0.5">
                      <span className="text-foreground">VERIFY:</span> {c.verification}
                    </div>
                  )}
                  {(c.linked_refs || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {c.linked_refs.map((ref) => (
                        <span key={ref} className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => cycleStatus(c.id)}
                    title="Click to toggle status (Implemented / Planned / N/A)"
                    data-testid={`toggle-control-${c.id}`}
                    className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
                      c.status === "implemented"
                        ? "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]"
                        : c.status === "planned"
                        ? "border-border bg-accent text-accent-foreground"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {c.status === "implemented" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {c.status === "planned" && <Clock className="h-3.5 w-3.5" />}
                    {c.status === "n/a" && <MinusCircle className="h-3.5 w-3.5" />}
                    <span className="uppercase">{c.status}</span>
                  </button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingControlId(c.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Threat Model & Risk Review */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                <h2 className="text-sm font-semibold">Threat review & attack vectors</h2>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addThreat} data-testid="add-threat-btn">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add threat
              </Button>
            </div>

            <div className="rounded-md border hairline divide-y divide-border/60 bg-card/20">
              {threats.map((t, idx) => {
                const upThreat = (k, v) =>
                  setDraft({
                    ...draft,
                    threats: threats.map((item, i) => (i === idx ? { ...item, [k]: v } : item)),
                  });
                return (
                  <div key={t.id || idx} className="p-3.5 grid gap-2 md:grid-cols-[120px_1fr_1fr_1.2fr_auto] items-center text-xs">
                    <Select value={t.severity || "high"} onValueChange={(v) => upThreat("severity", v)}>
                      <SelectTrigger className="h-7 font-mono text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["critical", "high", "medium", "low"].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      className="font-medium bg-transparent border-b border-transparent focus:border-border outline-none py-0.5"
                      value={t.risk || ""}
                      onChange={(e) => upThreat("risk", e.target.value)}
                      placeholder="Threat / risk"
                    />
                    <input
                      className="text-muted-foreground focus:text-foreground bg-transparent border-b border-transparent focus:border-border outline-none py-0.5"
                      value={t.vector || ""}
                      onChange={(e) => upThreat("vector", e.target.value)}
                      placeholder="Attack vector"
                    />
                    <input
                      className="text-muted-foreground focus:text-foreground bg-transparent border-b border-transparent focus:border-border outline-none py-0.5"
                      value={t.mitigation || ""}
                      onChange={(e) => upThreat("mitigation", e.target.value)}
                      placeholder="Mitigation"
                    />
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, threats: threats.filter((_, i) => i !== idx) })}
                      className="p-1 text-muted-foreground hover:text-destructive justify-self-end"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              {!threats.length && <div className="p-4 text-xs text-muted-foreground">No specific threats documented yet.</div>}
            </div>
          </section>
        </div>
      )}

      {activeControl && (
        <ControlEditorSheet
          control={activeControl}
          endpoints={endpoints}
          entities={entities}
          onClose={() => setEditingControlId(null)}
          onChange={(updated) => setDraft({ ...draft, controls: controls.map((c) => (c.id === updated.id ? updated : c)) })}
          onDelete={() => {
            setDraft({ ...draft, controls: controls.filter((c) => c.id !== activeControl.id) });
            setEditingControlId(null);
          }}
        />
      )}
    </div>
  );
}

