import { useState } from "react";
import { PenTool, Monitor, Smartphone, Plus, Pencil, Trash2, Copy, Check, Lock, Globe } from "lucide-react";
import { toast } from "sonner";
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

const tmpId = () => `ui-${Math.random().toString(36).slice(2, 9)}`;

const SECTION_TYPES = [
  ["topbar", "Top Header / Action Bar"],
  ["hero", "Hero / Positioning Block"],
  ["metrics", "KPI Metrics Strip"],
  ["filter_bar", "Search & Filter Toolbar"],
  ["table", "Structured Data Table"],
  ["cards", "Card Grid / List"],
  ["detail_panel", "Two-Column Detail Split"],
  ["form", "Validated Input Form"],
];

const DEFAULT_TOKENS = {
  aesthetic: "Precision Swiss editorial workspace — crisp 1px hairlines, high contrast",
  primary_color: "#18181b",
  accent_color: "#2563eb",
  surface_color: "#fafafa",
  success_color: "#16a34a",
  warning_color: "#d97706",
  danger_color: "#dc2626",
  heading_font: "IBM Plex Sans",
  body_font: "IBM Plex Sans",
  mono_font: "JetBrains Mono",
  radius: "6px",
  density: "Compact (4px / 8px spatial grid)",
};

function WireframeSectionBlock({ section, viewport, accentColor }) {
  const isMobile = viewport === "mobile";
  const type = section.type || "cards";

  return (
    <div className="rounded border border-dashed border-border bg-background/90 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">[{type}]</span>
        <span className="text-[11px] font-medium truncate">{section.label}</span>
      </div>

      {type === "topbar" && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: accentColor }} />
            <div className="h-2.5 w-20 rounded bg-foreground/20" />
          </div>
          <div className="flex items-center gap-1.5">
            {!isMobile && <div className="h-5 w-24 rounded border hairline bg-muted/50" />}
            <div className="h-5 w-16 rounded text-[9px] font-mono grid place-items-center text-white" style={{ backgroundColor: accentColor }}>
              ACTION
            </div>
          </div>
        </div>
      )}

      {type === "hero" && (
        <div className={`grid gap-3 pt-1 ${isMobile ? "grid-cols-1" : "grid-cols-[1.2fr_1fr]"}`}>
          <div className="space-y-2 py-2">
            <div className="h-2 w-16 rounded bg-foreground/20" />
            <div className="h-4 w-4/5 rounded bg-foreground/75" />
            <div className="h-2.5 w-3/4 rounded bg-muted-foreground/30" />
            <div className="flex gap-2 pt-1">
              <div className="h-6 w-20 rounded" style={{ backgroundColor: accentColor }} />
              <div className="h-6 w-20 rounded border hairline bg-muted/40" />
            </div>
          </div>
          <div className="rounded border hairline bg-muted/40 p-2.5 grid place-items-center min-h-[76px]">
            <div className="font-mono text-[10px] text-muted-foreground">INTERACTIVE SCHEMATIC</div>
          </div>
        </div>
      )}

      {type === "metrics" && (
        <div className={`grid gap-2 pt-1 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {["METRIC 01", "METRIC 02", "METRIC 03"].map((m) => (
            <div key={m} className="rounded border hairline bg-muted/25 p-2">
              <div className="font-mono text-[9px] text-muted-foreground">{m}</div>
              <div className="mt-1 h-3.5 w-12 rounded bg-foreground/70" />
            </div>
          ))}
        </div>
      )}

      {type === "filter_bar" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex gap-1">
            <div className="h-5 w-12 rounded bg-foreground/80" />
            <div className="h-5 w-12 rounded border hairline bg-muted/40" />
            <div className="h-5 w-12 rounded border hairline bg-muted/40" />
          </div>
          <div className="h-5 w-28 rounded border hairline bg-muted/30" />
        </div>
      )}

      {type === "table" && (
        <div className="rounded border hairline overflow-hidden">
          <div className="grid grid-cols-4 gap-2 bg-muted/50 px-2.5 py-1.5 font-mono text-[9px] text-muted-foreground">
            <span>RECORD</span>
            <span>OWNER</span>
            <span>STATUS</span>
            <span className="text-right">UPDATED</span>
          </div>
          {[1, 2, 3].map((r) => (
            <div key={r} className="grid grid-cols-4 gap-2 px-2.5 py-2 border-t hairline items-center">
              <div className="h-2.5 w-4/5 rounded bg-foreground/60" />
              <div className="h-2 w-3/5 rounded bg-muted-foreground/30" />
              <div className="h-3.5 w-12 rounded-full bg-muted" />
              <div className="h-2 w-10 rounded bg-muted-foreground/30 justify-self-end" />
            </div>
          ))}
        </div>
      )}

      {type === "cards" && (
        <div className={`grid gap-2 pt-1 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
          {[1, 2, 3].map((c) => (
            <div key={c} className="rounded border hairline bg-muted/20 p-2.5 space-y-1.5">
              <div className="h-2.5 w-2/3 rounded bg-foreground/65" />
              <div className="h-2 w-full rounded bg-muted-foreground/25" />
              <div className="h-2 w-4/5 rounded bg-muted-foreground/25" />
            </div>
          ))}
        </div>
      )}

      {type === "detail_panel" && (
        <div className={`grid gap-2.5 pt-1 ${isMobile ? "grid-cols-1" : "grid-cols-[1.5fr_1fr]"}`}>
          <div className="rounded border hairline p-2.5 space-y-2 bg-muted/15">
            <div className="h-3 w-1/2 rounded bg-foreground/70" />
            <div className="h-2 w-full rounded bg-muted-foreground/30" />
            <div className="h-2 w-5/6 rounded bg-muted-foreground/30" />
          </div>
          <div className="rounded border hairline p-2.5 space-y-1.5 bg-muted/30">
            <div className="font-mono text-[9px] text-muted-foreground">METADATA RAIL</div>
            <div className="h-2 w-3/4 rounded bg-muted-foreground/40" />
            <div className="h-2 w-1/2 rounded bg-muted-foreground/40" />
          </div>
        </div>
      )}

      {type === "form" && (
        <div className="max-w-xs mx-auto w-full rounded border hairline p-3 space-y-2 bg-muted/15">
          <div className="h-2 w-16 rounded bg-muted-foreground/40" />
          <div className="h-6 w-full rounded border hairline bg-background" />
          <div className="h-2 w-20 rounded bg-muted-foreground/40" />
          <div className="h-6 w-full rounded border hairline bg-background" />
          <div className="h-6 w-full rounded text-[9px] font-mono grid place-items-center text-white" style={{ backgroundColor: accentColor }}>
            SUBMIT
          </div>
        </div>
      )}
    </div>
  );
}

function ScreenEditorSheet({ screen, onChange, onDelete, onClose }) {
  if (!screen) return null;
  const set = (k, v) => onChange({ ...screen, [k]: v });
  const setStateSpec = (sk, val) => onChange({ ...screen, states: { ...(screen.states || {}), [sk]: val } });

  const sections = screen.sections || [];
  const updateSec = (idx, k, v) =>
    set(
      "sections",
      sections.map((s, i) => (i === idx ? { ...s, [k]: v } : s))
    );

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[560px] overflow-y-auto" data-testid="screen-editor-sheet">
        <SheetHeader>
          <SheetTitle>Edit screen specification</SheetTitle>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Screen name</Label>
              <Input value={screen.name || ""} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Route path</Label>
              <Input value={screen.route || ""} onChange={(e) => set("route", e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Target role</Label>
              <Input value={screen.role || ""} onChange={(e) => set("role", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Shell layout</Label>
              <Select value={screen.layout || "sidebar_table"} onValueChange={(v) => set("layout", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public_hero">Public Top-Nav Shell</SelectItem>
                  <SelectItem value="auth_split">Centered Auth Gate</SelectItem>
                  <SelectItem value="sidebar_table">App Sidebar + Workspace</SelectItem>
                  <SelectItem value="sidebar_detail">App Sidebar + Split Detail</SelectItem>
                  <SelectItem value="settings_form">App Sidebar + Form Stack</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Screen purpose</Label>
            <Textarea rows={2} value={screen.purpose || ""} onChange={(e) => set("purpose", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Components (comma-separated)</Label>
            <Input
              value={(screen.components || []).join(", ")}
              onChange={(e) =>
                set(
                  "components",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="DataTable, FilterToolbar, StatusPill"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Wireframe sections</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => set("sections", [...sections, { type: "cards", label: "New Content Block" }])}
              >
                <Plus className="h-3 w-3 mr-1" />
                Section
              </Button>
            </div>
            <div className="space-y-2">
              {sections.map((sec, idx) => (
                <div key={idx} className="grid grid-cols-[150px_1fr_auto] gap-2 items-center">
                  <Select value={sec.type || "cards"} onValueChange={(v) => updateSec(idx, "type", v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_TYPES.map(([val, lbl]) => (
                        <SelectItem key={val} value={val}>
                          {lbl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="h-8 text-xs" value={sec.label || ""} onChange={(e) => updateSec(idx, "label", e.target.value)} />
                  <button
                    type="button"
                    onClick={() => set("sections", sections.filter((_, i) => i !== idx))}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t hairline">
            <div className="eyebrow">Mandatory UI states</div>
            {[
              ["loading", "Loading state"],
              ["empty", "Empty state"],
              ["error", "Error state"],
              ["success", "Success state"],
            ].map(([k, lbl]) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{lbl}</Label>
                <Input className="h-8 text-xs" value={screen.states?.[k] || ""} onChange={(e) => setStateSpec(k, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t hairline flex justify-between">
            <Button variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete screen
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

export default function UiBlueprint() {
  const art = useArtifact("ui");
  const { setAiOpen } = useProject();
  const [draft, setDraft] = useDraft(art.content, (c) => ({
    sitemap: c?.sitemap || [],
    screens: c?.screens || [],
    tokens: { ...DEFAULT_TOKENS, ...(c?.tokens || {}) },
  }));

  const [tab, setTab] = useState("wireframes");
  const [viewport, setViewport] = useState("desktop");
  const [simState, setSimState] = useState("default");
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [editingScreen, setEditingScreen] = useState(false);
  const [copiedCss, setCopiedCss] = useState(false);

  if (art.loading) return <PageLoading />;
  if (art.error) return <PageError message={art.error} onRetry={art.load} />;

  const origNormalized = {
    sitemap: art.content?.sitemap || [],
    screens: art.content?.screens || [],
    tokens: { ...DEFAULT_TOKENS, ...(art.content?.tokens || {}) },
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(origNormalized);
  const save = () => art.save(draft, { summary: `Updated UI/UX blueprint (${draft.screens.length} screens)` });

  const screens = draft.screens || [];
  const sitemap = draft.sitemap || [];
  const tokens = draft.tokens || DEFAULT_TOKENS;
  const activeScreen = screens.find((s) => s.id === selectedScreenId) || screens[0] || null;

  const addScreen = () => {
    const ns = {
      id: tmpId(),
      name: "New Workspace View",
      route: "/new-view",
      role: "Member",
      layout: "sidebar_table",
      purpose: "Manage domain records with clear status feedback.",
      feature_ids: [],
      sections: [
        { type: "topbar", label: "Title + Search + Primary Create Action" },
        { type: "table", label: "Primary Records Table" },
      ],
      components: ["DataTable", "StatusPill", "ActionModal"],
      states: {
        loading: "Table row skeleton shimmer",
        empty: "Guided empty state with Create CTA",
        error: "Inline alert banner with Retry button",
        success: "Optimistic row update + confirmation toast",
      },
    };
    setDraft({ ...draft, screens: [...screens, ns] });
    setSelectedScreenId(ns.id);
    setEditingScreen(true);
  };

  const addRoute = () => {
    setDraft({
      ...draft,
      sitemap: [...sitemap, { id: tmpId(), path: "/new-route", label: "New Route", auth: true, role: "Member", purpose: "Protected view" }],
    });
  };

  const copyCssVariables = () => {
    const css = `:root {
  --color-primary: ${tokens.primary_color};
  --color-accent: ${tokens.accent_color};
  --color-surface: ${tokens.surface_color};
  --color-success: ${tokens.success_color};
  --color-warning: ${tokens.warning_color};
  --color-danger: ${tokens.danger_color};
  --font-heading: "${tokens.heading_font}", sans-serif;
  --font-body: "${tokens.body_font}", sans-serif;
  --font-mono: "${tokens.mono_font}", monospace;
  --radius-base: ${tokens.radius};
}`;
    navigator.clipboard.writeText(css);
    setCopiedCss(true);
    toast.success("Copied CSS design tokens");
    setTimeout(() => setCopiedCss(false), 1800);
  };

  const hasSidebar = activeScreen && ["sidebar_table", "sidebar_detail", "settings_form"].includes(activeScreen.layout);

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl fade-up">
      <PageHeader
        eyebrow="Plan · Phase 2"
        title="UI/UX blueprint"
        description="Sitemap hierarchy, rendered desktop and mobile low-fidelity wireframes, mandatory UI states, and design system tokens."
      >
        <ArtifactBar kind="ui" art={art} workflow="ui" dirty={dirty} onSave={save} />
      </PageHeader>

      <ReviewBanner artifact={art.artifact} onResolve={art.resolveReview} />

      {!screens.length && !sitemap.length ? (
        <EmptyState
          icon={PenTool}
          title="No UI blueprint generated yet"
          body="Generate screens, low-fidelity wireframes, sitemap routes, and design tokens from your features."
          action="Generate with AI"
          onAction={() => setAiOpen({ workflow: "ui" })}
          testid="ui-empty"
        >
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={addScreen}>
            or add a screen manually
          </button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {/* Sub-navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b hairline pb-3">
            <div className="flex items-center gap-1.5" data-testid="ui-tabs">
              {[
                ["wireframes", `Wireframes & Screens (${screens.length})`],
                ["sitemap", `Sitemap Hierarchy (${sitemap.length})`],
                ["tokens", "Design Tokens & Typography"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  data-testid={`ui-tab-${id}`}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "wireframes" && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={addScreen} data-testid="add-screen-btn">
                <Plus className="h-3.5 w-3.5" />
                Add screen
              </Button>
            )}
            {tab === "sitemap" && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={addRoute} data-testid="add-route-btn">
                <Plus className="h-3.5 w-3.5" />
                Add route
              </Button>
            )}
            {tab === "tokens" && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={copyCssVariables} data-testid="copy-tokens-css-btn">
                {copiedCss ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy CSS `:root`
              </Button>
            )}
          </div>

          {/* TAB 1: WIREFRAMES & SCREENS */}
          {tab === "wireframes" && (
            <div className="grid gap-8 lg:grid-cols-[270px_1fr]">
              {/* Screen List Rail */}
              <aside className="space-y-2">
                <div className="eyebrow px-1">Screen inventory</div>
                <div className="divide-y divide-border/60 rounded-md border hairline bg-card/40">
                  {screens.map((sc, i) => {
                    const active = activeScreen?.id === sc.id;
                    return (
                      <button
                        key={sc.id}
                        onClick={() => setSelectedScreenId(sc.id)}
                        data-testid={`screen-item-${i}`}
                        className={`w-full text-left p-3.5 transition-colors ${active ? "bg-accent/70" : "hover:bg-muted/40"}`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                          <span>{sc.route}</span>
                          <span>{sc.role}</span>
                        </div>
                        <div className="mt-1 text-sm font-medium">{sc.name}</div>
                        <div className="mt-1.5 text-[11px] text-muted-foreground font-mono">
                          {(sc.sections || []).length} blocks · {(sc.components || []).length} components
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Wireframe Previewer + Specs */}
              {activeScreen && (
                <div className="space-y-6">
                  {/* Toolbar: Viewport Switcher + UI State Simulator */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border hairline bg-card/40 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">{activeScreen.name}</h2>
                        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{activeScreen.route}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{activeScreen.purpose}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Desktop / Mobile Toggle */}
                      <div className="inline-flex rounded border hairline p-0.5 bg-background" data-testid="viewport-switcher">
                        <button
                          type="button"
                          onClick={() => setViewport("desktop")}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono ${
                            viewport === "desktop" ? "bg-foreground text-background" : "text-muted-foreground"
                          }`}
                        >
                          <Monitor className="h-3.5 w-3.5" />
                          Desktop
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewport("mobile")}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono ${
                            viewport === "mobile" ? "bg-foreground text-background" : "text-muted-foreground"
                          }`}
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          Mobile
                        </button>
                      </div>

                      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setEditingScreen(true)} data-testid="edit-screen-btn">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit spec
                      </Button>
                    </div>
                  </div>

                  {/* State Simulator Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-mono text-[11px] text-muted-foreground mr-1">SIMULATE STATE:</span>
                    {[
                      ["default", "Default Wireframe"],
                      ["loading", "Loading"],
                      ["empty", "Empty"],
                      ["error", "Error"],
                      ["success", "Success"],
                    ].map(([st, lbl]) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSimState(st)}
                        className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                          simState === st ? "bg-foreground text-background" : "border hairline text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  {/* Rendered Architectural Wireframe Frame */}
                  <div className="rounded-md border hairline blueprint-grid-bg p-4 md:p-8 flex justify-center" data-testid="wireframe-canvas">
                    <div
                      className={`w-full transition-all duration-300 rounded-md border hairline bg-card shadow-sm overflow-hidden ${
                        viewport === "mobile" ? "max-w-[375px]" : "max-w-full"
                      }`}
                    >
                      {/* Browser / Device Frame Header */}
                      <div className="flex items-center justify-between border-b hairline bg-muted/50 px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
                        <span>{viewport === "mobile" ? "390 × 844 · MOBILE" : "1280 × 800 · DESKTOP"}</span>
                        <span className="truncate max-w-[200px] text-foreground">{activeScreen.route}</span>
                        <span>{activeScreen.role}</span>
                      </div>

                      {/* Interior Shell */}
                      <div className={`grid min-h-[340px] ${hasSidebar && viewport === "desktop" ? "grid-cols-[168px_1fr]" : "grid-cols-1"}`}>
                        {hasSidebar && viewport === "desktop" && (
                          <div className="border-r hairline bg-muted/20 p-3 space-y-2">
                            <div className="font-mono text-[9px] text-muted-foreground uppercase">Navigation</div>
                            {sitemap.slice(2, 6).map((navItem) => (
                              <div
                                key={navItem.id}
                                className={`rounded px-2 py-1 text-[11px] font-mono truncate ${
                                  navItem.path === activeScreen.route ? "bg-foreground text-background" : "text-muted-foreground bg-muted/40"
                                }`}
                              >
                                {navItem.label}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="p-4 space-y-3">
                          {simState === "default" &&
                            (activeScreen.sections || []).map((sec, idx) => (
                              <WireframeSectionBlock
                                key={idx}
                                section={sec}
                                viewport={viewport}
                                accentColor={tokens.accent_color || "#2563eb"}
                              />
                            ))}

                          {simState === "loading" && (
                            <div className="space-y-3 py-6">
                              <div className="font-mono text-[11px] text-muted-foreground uppercase">Loading State Preview</div>
                              <p className="text-xs text-foreground">{activeScreen.states?.loading}</p>
                              <div className="space-y-2 pt-2">
                                {[75, 92, 64, 85].map((w, i) => (
                                  <div key={i} className="h-7 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />
                                ))}
                              </div>
                            </div>
                          )}

                          {simState === "empty" && (
                            <div className="my-6 rounded border border-dashed border-border p-8 text-center space-y-2">
                              <div className="font-mono text-[11px] uppercase text-muted-foreground">Empty State Specification</div>
                              <p className="text-sm font-medium max-w-md mx-auto">{activeScreen.states?.empty}</p>
                              <div className="pt-2">
                                <span
                                  className="inline-block rounded px-3 py-1 font-mono text-[11px] text-white"
                                  style={{ backgroundColor: tokens.accent_color }}
                                >
                                  + PRIMARY ACTION
                                </span>
                              </div>
                            </div>
                          )}

                          {simState === "error" && (
                            <div
                              className="my-6 rounded border p-5 space-y-2"
                              style={{ borderColor: tokens.danger_color, backgroundColor: `${tokens.danger_color}10` }}
                            >
                              <div className="font-mono text-[11px] uppercase" style={{ color: tokens.danger_color }}>
                                Error Recovery Specification
                              </div>
                              <p className="text-sm">{activeScreen.states?.error}</p>
                            </div>
                          )}

                          {simState === "success" && (
                            <div
                              className="my-6 rounded border p-5 space-y-2"
                              style={{ borderColor: tokens.success_color, backgroundColor: `${tokens.success_color}10` }}
                            >
                              <div className="font-mono text-[11px] uppercase" style={{ color: tokens.success_color }}>
                                Success Confirmation Specification
                              </div>
                              <p className="text-sm">{activeScreen.states?.success}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Component Inventory & 4 Mandatory States Matrix */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-md border hairline p-4 space-y-2">
                      <div className="eyebrow">Component inventory</div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(activeScreen.components || []).map((c) => (
                          <span key={c} className="rounded border hairline bg-muted/40 px-2.5 py-1 font-mono text-xs">
                            {`<${c} />`}
                          </span>
                        ))}
                        {!(activeScreen.components || []).length && (
                          <span className="text-xs text-muted-foreground">No components listed.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border hairline p-4 space-y-2 text-xs">
                      <div className="eyebrow">State matrix summary</div>
                      <div className="space-y-1.5">
                        <div>
                          <span className="font-mono text-muted-foreground">LOADING: </span>
                          <span>{activeScreen.states?.loading}</span>
                        </div>
                        <div>
                          <span className="font-mono text-muted-foreground">EMPTY: </span>
                          <span>{activeScreen.states?.empty}</span>
                        </div>
                        <div>
                          <span className="font-mono text-muted-foreground">ERROR: </span>
                          <span>{activeScreen.states?.error}</span>
                        </div>
                        <div>
                          <span className="font-mono text-muted-foreground">SUCCESS: </span>
                          <span>{activeScreen.states?.success}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SITEMAP HIERARCHY */}
          {tab === "sitemap" && (
            <div className="rounded-md border hairline overflow-hidden bg-card/30" data-testid="sitemap-table">
              <div className="grid grid-cols-12 gap-3 border-b hairline bg-muted/40 px-4 py-2.5 font-mono text-[11px] uppercase text-muted-foreground">
                <span className="col-span-3">Route Path</span>
                <span className="col-span-3">Screen Label</span>
                <span className="col-span-2">Access</span>
                <span className="col-span-3">Purpose</span>
                <span className="col-span-1 text-right">Edit</span>
              </div>
              <div className="divide-y divide-border/60">
                {sitemap.map((item, idx) => {
                  const updateRoute = (k, v) =>
                    setDraft({
                      ...draft,
                      sitemap: sitemap.map((r, i) => (i === idx ? { ...r, [k]: v } : r)),
                    });
                  return (
                    <div key={item.id || idx} className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm">
                      <input
                        className="col-span-3 font-mono text-xs bg-transparent border-b border-transparent focus:border-border outline-none"
                        value={item.path || ""}
                        onChange={(e) => updateRoute("path", e.target.value)}
                      />
                      <input
                        className="col-span-3 font-medium bg-transparent border-b border-transparent focus:border-border outline-none"
                        value={item.label || ""}
                        onChange={(e) => updateRoute("label", e.target.value)}
                      />
                      <div className="col-span-2">
                        <button
                          type="button"
                          onClick={() => updateRoute("auth", !item.auth)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] border hairline ${
                            item.auth ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {item.auth ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                          {item.auth ? "Protected" : "Public"}
                        </button>
                      </div>
                      <input
                        className="col-span-3 text-xs text-muted-foreground focus:text-foreground bg-transparent border-b border-transparent focus:border-border outline-none"
                        value={item.purpose || ""}
                        onChange={(e) => updateRoute("purpose", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, sitemap: sitemap.filter((_, i) => i !== idx) })}
                        className="col-span-1 justify-self-end p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DESIGN TOKENS */}
          {tab === "tokens" && (
            <div className="grid gap-8 lg:grid-cols-2" data-testid="design-tokens-panel">
              <div className="rounded-md border hairline p-5 space-y-4 bg-card/30">
                <div className="eyebrow">Color roles</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["primary_color", "Primary Ink"],
                    ["accent_color", "Interactive Accent"],
                    ["surface_color", "Canvas Surface"],
                    ["success_color", "Success Semantic"],
                    ["warning_color", "Warning Semantic"],
                    ["danger_color", "Danger Semantic"],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3 rounded border hairline bg-background p-2.5">
                      <input
                        type="color"
                        value={tokens[key] || "#18181b"}
                        onChange={(e) => setDraft({ ...draft, tokens: { ...tokens, [key]: e.target.value } })}
                        className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">{label}</div>
                        <input
                          value={tokens[key] || ""}
                          onChange={(e) => setDraft({ ...draft, tokens: { ...tokens, [key]: e.target.value } })}
                          className="w-full bg-transparent font-mono text-[11px] text-muted-foreground outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border hairline p-5 space-y-4 bg-card/30">
                <div className="eyebrow">Typography & spatial scale</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["heading_font", "Heading font"],
                    ["body_font", "Body font"],
                    ["mono_font", "Monospace font"],
                  ].map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        value={tokens[key] || ""}
                        onChange={(e) => setDraft({ ...draft, tokens: { ...tokens, [key]: e.target.value } })}
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Border radius</Label>
                    <Input
                      value={tokens.radius || ""}
                      onChange={(e) => setDraft({ ...draft, tokens: { ...tokens, radius: e.target.value } })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grid density</Label>
                    <Input
                      value={tokens.density || ""}
                      onChange={(e) => setDraft({ ...draft, tokens: { ...tokens, density: e.target.value } })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aesthetic direction</Label>
                  <Textarea
                    rows={2}
                    value={tokens.aesthetic || ""}
                    onChange={(e) => setDraft({ ...draft, tokens: { ...tokens, aesthetic: e.target.value } })}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {editingScreen && activeScreen && (
        <ScreenEditorSheet
          screen={activeScreen}
          onClose={() => setEditingScreen(false)}
          onChange={(updated) => setDraft({ ...draft, screens: screens.map((s) => (s.id === updated.id ? updated : s)) })}
          onDelete={() => {
            const next = screens.filter((s) => s.id !== activeScreen.id);
            setDraft({ ...draft, screens: next });
            setSelectedScreenId(next[0]?.id || null);
            setEditingScreen(false);
          }}
        />
      )}
    </div>
  );
}

