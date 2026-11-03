import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Loader2,
  Trash2,
  PanelRightClose,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  http,
  errMsg,
  notifyArtifactsUpdated,
  getActiveClientLlmConfig,
} from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import ModelSelector from "@/components/ai/ModelSelector";

const MODULE_META = {
  brief: { code: "01", tag: "Brief" },
  spec: { code: "02", tag: "Requirements" },
  features: { code: "03", tag: "Features" },
  flows: { code: "04", tag: "Flows" },
  ui: { code: "05", tag: "UI/UX" },
  architecture: { code: "06", tag: "Architecture" },
  schema: { code: "07", tag: "Database" },
  api: { code: "08", tag: "API" },
  security: { code: "09", tag: "Security" },
  roadmap: { code: "10", tag: "Roadmap" },
  testing: { code: "11", tag: "Testing" },
  deployment: { code: "12", tag: "Deploy" },
  docs: { code: "MD", tag: "Specs (.md)" },
};

const TARGET_PILLS = [
  { id: "auto", label: "All modules" },
  { id: "schema", label: "Database" },
  { id: "api", label: "API" },
  { id: "architecture", label: "Architecture" },
  { id: "features", label: "Features" },
  { id: "spec", label: "PRD" },
  { id: "flows", label: "Flows" },
  { id: "ui", label: "UI/UX" },
  { id: "security", label: "Security" },
  { id: "roadmap", label: "Roadmap" },
  { id: "testing", label: "Testing" },
  { id: "deployment", label: "Deploy" },
  { id: "docs", label: "Docs" },
];

const STARTER_PROMPTS = [
  {
    code: "01",
    scope: "Full blueprint",
    text: "Multi-vendor food delivery platform with menus, live driver tracking, and ABA PayWay KHQR + Stripe.",
  },
  {
    code: "02",
    scope: "Full blueprint",
    text: "Clinic scheduling & prescription system for patients, doctors, clinical notes, and billing.",
  },
  {
    code: "03",
    scope: "Schema + API",
    text: "Add a ratings and reviews table with foreign keys and REST endpoints.",
  },
  {
    code: "04",
    scope: "Infra + Deploy",
    text: "Add Redis caching, S3 object storage, and production environment variables.",
  },
];

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => setDesktop(e.matches);
    setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

function RichReplyText({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <p className="text-[12.5px] leading-relaxed text-foreground/90">
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={idx}
              className="rounded border hairline bg-muted/60 px-1 py-0.2 font-mono text-[11px] text-foreground"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </p>
  );
}

function PlacementCard({ pl, currentSeg, onNavigate, onApplySingle, busyApply }) {
  const meta = MODULE_META[pl.kind] || MODULE_META.docs;
  const isCurrentPanel = currentSeg === pl.path;

  return (
    <div
      className={`group rounded-md border p-2.5 transition-colors ${
        isCurrentPanel
          ? "border-foreground/50 bg-muted/50"
          : "hairline bg-background hover:border-foreground/30"
      }`}
      data-testid={`chat-placement-${pl.kind}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-5 min-w-[24px] shrink-0 place-items-center rounded border hairline bg-muted/50 px-1 font-mono text-[10px] text-muted-foreground">
          {meta.code}
        </span>

        <button
          type="button"
          onClick={() => onNavigate(pl.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="truncate text-[12px] font-medium text-foreground group-hover:underline">
            {pl.label}
          </span>
          {isCurrentPanel && (
            <span className="rounded border hairline bg-card px-1 py-0.2 font-mono text-[9px] uppercase text-muted-foreground">
              active
            </span>
          )}
        </button>

        {pl.applied ? (
          <button
            type="button"
            onClick={() => onNavigate(pl.path)}
            className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Check className="h-2.5 w-2.5 text-[hsl(var(--success))]" />
            <span>{pl.version ? `v${pl.version}` : "synced"}</span>
            <ArrowUpRight className="h-2.5 w-2.5" />
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 font-mono text-[10px]"
            disabled={busyApply}
            onClick={() => onApplySingle(pl.kind)}
            data-testid={`chat-apply-${pl.kind}`}
          >
            Apply
          </Button>
        )}
      </div>

      {(pl.summary || pl.highlights?.length > 0) && (
        <div className="mt-1.5 pl-8 space-y-1.5">
          {pl.summary && (
            <div className="text-[11.5px] text-muted-foreground leading-snug">{pl.summary}</div>
          )}
          {pl.highlights?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pl.highlights.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onNavigate(pl.path)}
                  className="max-w-[185px] truncate rounded border hairline bg-muted/30 px-1.5 py-0.2 font-mono text-[10px] text-foreground/80 hover:border-foreground/40 transition-colors"
                  title={h}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
  const [allowOverride, setAllowOverride] = useState(true);

  const endRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    http
      .get(`/projects/${pid}/chat`)
      .then(({ data }) => {
        if (!active) return;
        setMessages(data.messages || []);
        if (data.ai_capabilities?.allow_user_override === false) {
          setAllowOverride(false);
        }
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
      const activeLlm = getActiveClientLlmConfig();
      const sanitizedLlm =
        !allowOverride && activeLlm?.mode === "override" ? null : activeLlm;

      const { data } = await http.post(`/projects/${pid}/chat`, {
        message: text,
        targets,
        auto_apply: autoApply,
        llm_config: sanitizedLlm,
      });

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        data.user_message,
        data.assistant_message,
      ]);

      if (data.updated_kinds?.length) {
        notifyArtifactsUpdated(data.updated_kinds);
        refresh();
        toast.success(`Updated ${data.updated_kinds.length} module(s)`);
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
      const { data } = await http.post(`/projects/${pid}/chat/${msgId}/apply`, {
        kind: singleKind,
      });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? data.message : m)));
      if (data.updated_kinds?.length) {
        notifyArtifactsUpdated(data.updated_kinds);
        refresh();
        toast.success(
          singleKind
            ? `Applied to ${MODULE_META[singleKind]?.tag || singleKind}`
            : `Applied ${data.updated_kinds.length} modules`
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
    toast("Thread cleared (blueprint artifacts preserved)");
  };

  return (
    <div className="flex h-full flex-col bg-background" data-testid="ai-chat-panel">
      {/* Precision Swiss Header */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b hairline px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
          <span className="truncate text-[12.5px] font-semibold tracking-tight">Architect</span>
          <span className="font-mono text-[10px] text-muted-foreground">12 modules</span>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={clearChat}
              title="Clear thread"
              data-testid="chat-clear-btn"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setChatOpen(false);
              onCloseMobile?.();
            }}
            title="Collapse panel (Ctrl+J)"
            data-testid="chat-close-btn"
          >
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Thread Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5" data-testid="chat-messages">
        {loading ? (
          <div className="flex items-center justify-center py-12 font-mono text-[11px] text-muted-foreground gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading thread…
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3 pt-1" data-testid="chat-empty-state">
            <div className="space-y-1 px-0.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Prompt &rarr; Structured Modules
              </div>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                Ask to generate or modify schema tables, API contracts, topology nodes, security controls, or deployment specs.
              </p>
            </div>

            <div className="divide-y hairline rounded-md border hairline bg-card">
              {STARTER_PROMPTS.map((sp, i) => (
                <button
                  key={sp.code}
                  type="button"
                  onClick={() => sendMessage(sp.text)}
                  data-testid={`chat-starter-${i}`}
                  className="group flex w-full items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {sp.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {sp.scope}
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="mt-0.5 text-[12px] leading-snug text-foreground/90">
                      {sp.text}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="space-y-2" data-testid={`chat-msg-${m.role}`}>
              {m.role === "user" ? (
                <div className="border-l-2 border-foreground bg-muted/35 px-3 py-2 text-[12.5px] leading-relaxed text-foreground">
                  <div>{m.content}</div>
                  {m.targets && !m.targets.includes("auto") && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.targets.map((t) => (
                        <span
                          key={t}
                          className="rounded border hairline bg-background px-1.5 py-0.2 font-mono text-[9.5px] text-muted-foreground"
                        >
                          &rarr; {MODULE_META[t]?.tag || t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 rounded-md border hairline bg-card p-3">
                  <div className="flex items-center justify-between gap-2 border-b hairline pb-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-foreground font-medium">
                        Router
                      </span>
                      {m.engine && (
                        <span className="truncate rounded border hairline bg-muted/40 px-1.5 py-0.2 font-mono text-[9.5px] text-muted-foreground">
                          {m.engine}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {m.placements?.length || 0} modules
                    </span>
                  </div>

                  <RichReplyText text={m.content} />

                  {m.placements?.length > 0 && (
                    <div className="space-y-1.5 pt-0.5" data-testid="chat-placements-list">
                      {m.placements.map((pl) => (
                        <PlacementCard
                          key={pl.kind}
                          pl={pl}
                          currentSeg={currentSeg}
                          onNavigate={goToPanel}
                          onApplySingle={(kind) => applyPending(m.id, kind)}
                          busyApply={applyingId === m.id}
                        />
                      ))}

                      {!m.applied && m.placements.some((p) => !p.applied) && (
                        <Button
                          size="sm"
                          className="mt-1 h-7 w-full gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs"
                          disabled={applyingId === m.id}
                          onClick={() => applyPending(m.id, null)}
                          data-testid="chat-apply-all-btn"
                        >
                          {applyingId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Apply all modules
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
          <div
            className="flex items-center gap-2.5 rounded-md border hairline bg-card px-3 py-2.5 font-mono text-[11px] text-muted-foreground"
            data-testid="chat-sending"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground shrink-0" />
            <span>Synthesizing &amp; routing across blueprint modules…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Antigravity-Style Composer Footer with Model Selector */}
      <div className="shrink-0 border-t hairline bg-background p-2.5 space-y-2">
        {/* Target Module Scope Bar */}
        <div
          className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar"
          data-testid="chat-target-pills"
        >
          {TARGET_PILLS.map((tp) => {
            const active = targets.includes(tp.id);
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => toggleTarget(tp.id)}
                data-testid={`chat-target-${tp.id}`}
                className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "hairline bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {tp.label}
              </button>
            );
          })}
        </div>

        {/* Unified Composer Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="overflow-hidden rounded-lg border hairline bg-card transition-colors focus-within:border-foreground/50"
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
            placeholder="Describe a feature, schema change, or architecture update…"
            data-testid="chat-input"
            className="w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-snug text-foreground placeholder:text-muted-foreground outline-none [field-sizing:content] max-h-36"
          />

          <div className="flex items-center justify-between gap-1.5 border-t hairline bg-muted/20 px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <ModelSelector preferredDirection="up" testId="chat-model-selector" />

              <button
                type="button"
                onClick={() => setAutoApply((v) => !v)}
                title={
                  autoApply
                    ? "Auto-place ON: Updates modules immediately with version history"
                    : "Review ON: Preview module cards before applying"
                }
                data-testid="chat-auto-apply-toggle"
                className={`rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                  autoApply
                    ? "hairline bg-background text-foreground"
                    : "hairline bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {autoApply ? "Auto-apply" : "Review"}
              </button>
            </div>

            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sending}
              data-testid="chat-send-btn"
              className="h-7 w-7 shrink-0 rounded-md bg-foreground text-background hover:bg-foreground/90"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
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
