import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquareText,
  Send,
  Sparkles,
  Database,
  Braces,
  Network,
  ListChecks,
  FileText,
  FileSignature,
  Map as MapIcon,
  FolderCode,
  ArrowUpRight,
  Check,
  Loader2,
  Trash2,
  PanelRightClose,
  Settings2,
  Wand2,
  Route as RouteIcon,
  PenTool,
  ShieldCheck,
  FlaskConical,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { http, errMsg, notifyArtifactsUpdated } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";

const MODULE_STYLE = {
  brief: { icon: FileSignature, tint: "#64748b", tag: "Brief" },
  spec: { icon: FileText, tint: "#3b82f6", tag: "PRD" },
  features: { icon: ListChecks, tint: "#f59e0b", tag: "Features" },
  architecture: { icon: Network, tint: "#8b5cf6", tag: "Architecture" },
  schema: { icon: Database, tint: "#10b981", tag: "Database ERD" },
  api: { icon: Braces, tint: "#0ea5e9", tag: "REST API" },
  roadmap: { icon: MapIcon, tint: "#14b8a6", tag: "Roadmap" },
  flows: { icon: RouteIcon, tint: "#6366f1", tag: "User Flows" },
  ui: { icon: PenTool, tint: "#d97706", tag: "UI/UX Wireframes" },
  security: { icon: ShieldCheck, tint: "#dc2626", tag: "Security Plan" },
  testing: { icon: FlaskConical, tint: "#059669", tag: "Testing Center" },
  deployment: { icon: Rocket, tint: "#0284c7", tag: "Deployment" },
  docs: { icon: FolderCode, tint: "#ec4899", tag: "Separate .md" },
};

const TARGET_PILLS = [
  { id: "auto", label: "Auto-route all" },
  { id: "schema", label: "Database" },
  { id: "api", label: "API" },
  { id: "architecture", label: "Architecture" },
  { id: "features", label: "Features" },
  { id: "spec", label: "Requirements" },
  { id: "roadmap", label: "Roadmap" },
  { id: "flows", label: "Flows" },
  { id: "ui", label: "UI/UX" },
  { id: "security", label: "Security" },
  { id: "testing", label: "Testing" },
  { id: "deployment", label: "Deploy" },
  { id: "docs", label: "Docs (.md)" },
];

const STARTER_PROMPTS = [
  {
    badge: "Full Idea → All Panels",
    text: "Build a multi-vendor food delivery platform with restaurants, menus, orders, live driver tracking, and ABA PayWay KHQR + Stripe payments.",
  },
  {
    badge: "Full Idea → All Panels",
    text: "Create a clinic appointment & prescription app where patients book doctors, doctors issue prescriptions, and admins manage billing.",
  },
  {
    badge: "Targeted → DB + API",
    text: "Add a star ratings & reviews table with foreign keys and REST API endpoints.",
  },
  {
    badge: "Targeted → Architecture",
    text: "Add Upstash Redis caching, object storage for uploads, and a background worker to architecture.",
  },
];

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true));
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => setDesktop(e.matches);
    setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

function loadLlmConfig() {
  try {
    const raw = localStorage.getItem("bp:llm-config");
    return raw ? JSON.parse(raw) : { provider: "gemini", apiKey: "", model: "" };
  } catch {
    return { provider: "gemini", apiKey: "", model: "" };
  }
}

function RichReplyText({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <p className="text-[13px] leading-relaxed text-foreground/90">
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={idx} className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px] text-primary">{part.slice(1, -1)}</code>;
        }
        return <span key={idx}>{part}</span>;
      })}
    </p>
  );
}

function PlacementCard({ pl, pid, currentSeg, onNavigate, onApplySingle, busyApply }) {
  const style = MODULE_STYLE[pl.kind] || MODULE_STYLE.docs;
  const Icon = style.icon;
  const isCurrentPanel = currentSeg === pl.path;

  return (
    <div
      className={`group rounded-lg border p-2.5 transition-all ${
        isCurrentPanel
          ? "border-primary/60 bg-accent/60"
          : "hairline bg-background/70 hover:border-primary/40 hover:bg-muted/40"
      }`}
      data-testid={`chat-placement-${pl.kind}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
          style={{ background: `${style.tint}1a`, color: style.tint }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <button
          type="button"
          onClick={() => onNavigate(pl.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="truncate text-[12.5px] font-semibold group-hover:text-primary transition-colors">
            {pl.label}
          </span>
          {isCurrentPanel && (
            <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[9.5px] font-medium text-primary">
              viewing
            </span>
          )}
        </button>

        {pl.applied ? (
          <button
            type="button"
            onClick={() => onNavigate(pl.path)}
            className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--success)/0.13)] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.22)] transition-colors"
          >
            <Check className="h-2.5 w-2.5" />
            Placed{pl.version ? ` · v${pl.version}` : ""}
            <ArrowUpRight className="h-2.5 w-2.5" />
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10.5px]"
            disabled={busyApply}
            onClick={() => onApplySingle(pl.kind)}
            data-testid={`chat-apply-${pl.kind}`}
          >
            Place in panel
          </Button>
        )}
      </div>

      <div className="mt-1.5 pl-8">
        <div className="text-[11.5px] text-muted-foreground">{pl.summary}</div>
        {pl.highlights?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {pl.highlights.map((h, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onNavigate(pl.path)}
                className="max-w-[190px] truncate rounded border hairline bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 hover:border-primary/50 hover:text-primary transition-colors"
                title={h}
              >
                {h}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanelBody({ onCloseMobile }) {
  const { pid, refresh, setChatOpen } = useProject();
  const nav = useNavigate();
  const loc = useLocation();
  const currentSeg = loc.pathname.split("/")[3] || "";

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [input, setInput] = useState("");
  const [targets, setTargets] = useState(["auto"]);
  const [autoApply, setAutoApply] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hasEnvLlm, setHasEnvLlm] = useState(false);
  const [llmCfg, setLlmCfg] = useState(loadLlmConfig);

  const endRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    http
      .get(`/projects/${pid}/chat`)
      .then(({ data }) => {
        if (!active) return;
        setMessages(data.messages || []);
        setHasEnvLlm(Boolean(data.has_env_llm));
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const toggleTarget = (id) => {
    if (id === "auto") {
      setTargets(["auto"]);
      return;
    }
    setTargets((prev) => {
      const clean = prev.filter((x) => x !== "auto");
      if (clean.includes(id)) {
        const next = clean.filter((x) => x !== id);
        return next.length ? next : ["auto"];
      }
      return [...clean, id];
    });
  };

  const saveLlmSettings = (next) => {
    setLlmCfg(next);
    try {
      localStorage.setItem("bp:llm-config", JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const goToPanel = (path) => {
    nav(`/p/${pid}/${path}`);
    onCloseMobile?.();
  };

  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const optimisticUser = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: text,
      targets,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);
    if (!overrideText) setInput("");
    setSending(true);

    try {
      const activeLlm = llmCfg.apiKey?.trim() ? llmCfg : null;
      const { data } = await http.post(`/projects/${pid}/chat`, {
        message: text,
        targets,
        auto_apply: autoApply,
        llm_config: activeLlm,
      });

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        data.user_message,
        data.assistant_message,
      ]);

      if (data.updated_kinds?.length) {
        notifyArtifactsUpdated(data.updated_kinds);
        refresh();
        toast.success(`Placed into ${data.updated_kinds.length} separate panel(s)`);
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const applyPending = async (msgId, singleKind = null) => {
    setApplyingId(msgId);
    try {
      const { data } = await http.post(`/projects/${pid}/chat/${msgId}/apply`, { kind: singleKind });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? data.message : m)));
      if (data.updated_kinds?.length) {
        notifyArtifactsUpdated(data.updated_kinds);
        refresh();
        toast.success(
          singleKind
            ? `Placed into ${MODULE_STYLE[singleKind]?.tag || singleKind} panel`
            : `Placed all ${data.updated_kinds.length} modules into their panels`
        );
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setApplyingId(null);
    }
  };

  const clearChat = async () => {
    await http.delete(`/projects/${pid}/chat`);
    setMessages([]);
    toast("Chat history cleared (panel data preserved)");
  };

  return (
    <div className="flex h-full flex-col bg-card/85 backdrop-blur-xl" data-testid="ai-chat-panel">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b hairline px-3.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold">AI Architect Chat</span>
            <span className="rounded-full bg-accent px-1.5 py-0.2 font-mono text-[9.5px] font-medium text-accent-foreground">
              modular
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            Places DB, API, Diagrams &amp; .md into separate panels
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAutoApply((v) => !v)}
          title={
            autoApply
              ? "Auto-place ON: Immediately places each module into its panel (with version history)"
              : "Review-first ON: Preview cards before placing into panels"
          }
          data-testid="chat-auto-apply-toggle"
          className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
            autoApply
              ? "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]"
              : "hairline text-muted-foreground hover:bg-muted"
          }`}
        >
          {autoApply ? "Auto-place" : "Review first"}
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowSettings((s) => !s)}
          title="AI Engine & Optional API Key"
          data-testid="chat-settings-btn"
        >
          <Settings2 className={`h-3.5 w-3.5 ${llmCfg.apiKey || hasEnvLlm ? "text-primary" : ""}`} />
        </Button>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={clearChat}
            title="Clear chat messages"
            data-testid="chat-clear-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            setChatOpen(false);
            onCloseMobile?.();
          }}
          title="Collapse chat panel (Ctrl+J)"
          data-testid="chat-close-btn"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Optional LLM API Key Drawer */}
      {showSettings && (
        <div className="border-b hairline bg-muted/40 px-3.5 py-3 space-y-2.5 text-xs fade-up" data-testid="chat-llm-settings">
          <div className="flex items-center justify-between">
            <span className="font-medium">AI Architect Engine</span>
            <span className="font-mono text-[10px] text-[hsl(var(--success))]">
              {llmCfg.apiKey ? `${llmCfg.provider.toUpperCase()} Key Active` : hasEnvLlm ? "Server LLM Active" : "Built-in Semantic Engine Ready"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Works immediately out-of-the-box with the built-in Semantic Architect, or paste a Gemini / OpenAI key for live LLM synthesis.
          </p>
          <div className="flex gap-1.5">
            {["gemini", "openai"].map((prov) => (
              <button
                key={prov}
                type="button"
                onClick={() => saveLlmSettings({ ...llmCfg, provider: prov })}
                className={`rounded border px-2.5 py-1 text-[11px] font-medium capitalize ${
                  llmCfg.provider === prov ? "border-primary bg-accent text-accent-foreground" : "hairline bg-card"
                }`}
              >
                {prov === "gemini" ? "Google Gemini" : "OpenAI"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              type="password"
              className="h-7 text-xs font-mono bg-card"
              placeholder={llmCfg.provider === "gemini" ? "AIza... (optional Gemini API key)" : "sk-... (optional OpenAI API key)"}
              value={llmCfg.apiKey}
              onChange={(e) => saveLlmSettings({ ...llmCfg, apiKey: e.target.value })}
              data-testid="chat-apikey-input"
            />
            {llmCfg.apiKey && (
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => saveLlmSettings({ ...llmCfg, apiKey: "" })}>
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4 space-y-4" data-testid="chat-messages">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading architect thread…
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4 fade-up" data-testid="chat-empty-state">
            <div className="rounded-xl border hairline bg-accent/45 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground">
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                No more giant single-file Markdown dumps
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Describe your app idea or a feature below. AI automatically separates and places it directly into{" "}
                <b className="text-foreground">Database ERD</b>, <b className="text-foreground">API Contracts</b>,{" "}
                <b className="text-foreground">Architecture Diagram</b>, <b className="text-foreground">PRD</b>,{" "}
                <b className="text-foreground">Roadmap</b>, and <b className="text-foreground">Separate .md Docs</b>.
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {Object.entries(MODULE_STYLE).map(([k, st]) => {
                  const Icon = st.icon;
                  return (
                    <span
                      key={k}
                      className="inline-flex items-center gap-1 rounded-md border hairline bg-card px-1.5 py-0.5 text-[10px] font-medium"
                    >
                      <Icon className="h-2.5 w-2.5" style={{ color: st.tint }} />
                      {st.tag}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="eyebrow px-0.5">Try an example prompt</div>
              {STARTER_PROMPTS.map((sp, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(sp.text)}
                  data-testid={`chat-starter-${i}`}
                  className="group block w-full rounded-lg border hairline bg-background/70 p-2.5 text-left transition-all hover:border-primary/50 hover:bg-accent/30"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-medium text-primary">{sp.badge}</span>
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[12px] leading-snug text-foreground/90">{sp.text}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="space-y-2 fade-up" data-testid={`chat-msg-${m.role}`}>
              {m.role === "user" ? (
                <div className="ml-7 rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground shadow-sm">
                  {m.content}
                  {m.targets && !m.targets.includes("auto") && (
                    <div className="mt-1.5 flex flex-wrap gap-1 opacity-85">
                      {m.targets.map((t) => (
                        <span key={t} className="rounded bg-primary-foreground/15 px-1.5 py-0.2 font-mono text-[9.5px]">
                          → {MODULE_STYLE[t]?.tag || t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 rounded-xl border hairline bg-background/60 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Blueprint Router</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {m.placements?.length || 0} panels separated
                    </span>
                  </div>

                  <RichReplyText text={m.content} />

                  {m.placements?.length > 0 && (
                    <div className="space-y-1.5 pt-1" data-testid="chat-placements-list">
                      {m.placements.map((pl) => (
                        <PlacementCard
                          key={pl.kind}
                          pl={pl}
                          pid={pid}
                          currentSeg={currentSeg}
                          onNavigate={goToPanel}
                          onApplySingle={(kind) => applyPending(m.id, kind)}
                          busyApply={applyingId === m.id}
                        />
                      ))}

                      {!m.applied && m.placements.some((p) => !p.applied) && (
                        <Button
                          size="sm"
                          className="w-full h-8 gap-1.5 mt-1"
                          disabled={applyingId === m.id}
                          onClick={() => applyPending(m.id, null)}
                          data-testid="chat-apply-all-btn"
                        >
                          {applyingId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Place all into separate panels
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="flex items-center gap-2.5 rounded-xl border hairline bg-accent/40 px-3.5 py-3 text-xs fade-up" data-testid="chat-sending">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <div>
              <div className="font-medium text-foreground">Decomposing &amp; placing into modules…</div>
              <div className="text-[11px] text-muted-foreground">
                Separating Database ERD, REST API, Architecture, PRD &amp; .md specs
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Target Module Pills + Input Composer */}
      <div className="shrink-0 border-t hairline bg-background/80 p-3 space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar" data-testid="chat-target-pills">
          {TARGET_PILLS.map((tp) => {
            const active = targets.includes(tp.id);
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => toggleTarget(tp.id)}
                data-testid={`chat-target-${tp.id}`}
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition-colors ${
                  active
                    ? "border-primary bg-accent text-accent-foreground"
                    : "hairline text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tp.label}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="relative"
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Describe your app idea or module change (e.g. 'Build a pet adoption & vet booking app' or 'Add coupons table + API')…"
            data-testid="chat-input"
            className="w-full resize-none rounded-lg border border-input bg-card pl-3 pr-10 py-2 text-[13px] leading-snug outline-none focus:ring-1 focus:ring-ring [field-sizing:content] max-h-36"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
            data-testid="chat-send-btn"
            className="absolute bottom-2 right-2 h-7 w-7 rounded-md"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const { chatOpen, setChatOpen } = useProject();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setChatOpen]);

  if (!chatOpen) return null;

  if (isDesktop) {
    return (
      <aside className="flex w-[390px] xl:w-[420px] shrink-0 flex-col border-l hairline h-full">
        <ChatPanelBody />
      </aside>
    );
  }

  return (
    <Sheet open={chatOpen} onOpenChange={setChatOpen}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] p-0">
        <ChatPanelBody onCloseMobile={() => setChatOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

