import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Globe, Loader2, Activity, Cpu } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  http,
  errMsg,
  DEFAULT_LLM_CONFIG,
  loadStoredLlmConfig,
  saveStoredLlmConfig,
} from "@/lib/api";

const FALLBACK_MODELS = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", model: "gemini-2.5-pro", badge: "Reasoning", serverReady: false },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", model: "gemini-2.5-flash", badge: "Fast", serverReady: false },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "anthropic", model: "claude-sonnet-4-20250514", badge: "Architect", serverReady: false },
  { id: "claude-3.7-sonnet", label: "Claude 3.7 Sonnet", provider: "anthropic", model: "claude-3-7-sonnet-latest", badge: "Thinking", serverReady: false },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", model: "gpt-4.1", badge: "Structured", serverReady: false },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", model: "gpt-4o-mini", badge: "Fast", serverReady: false },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "deepseek", model: "deepseek-chat", badge: "Coder", serverReady: false },
  { id: "deepseek-r1", label: "DeepSeek R1", provider: "deepseek", model: "deepseek-reasoner", badge: "Reasoning", serverReady: false },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B", provider: "groq", model: "llama-3.3-70b-versatile", badge: "Ultra-fast", serverReady: false },
];

const PROVIDER_PRESETS = [
  {
    id: "custom",
    short: "Custom URL",
    label: "Custom Endpoint (OpenAI / Anthropic)",
    defaultBaseUrl: "",
    defaultModel: "",
    placeholderBaseUrl: "https://your-gateway.example.com/v1",
    placeholderModel: "deepseek-chat / gpt-4.1 / qwen2.5-coder",
    placeholderKey: "Bearer key (optional for local/internal)",
    needsBaseUrl: true,
  },
  {
    id: "openrouter",
    short: "OpenRouter",
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-sonnet-4",
    placeholderModel: "anthropic/claude-sonnet-4",
    placeholderKey: "sk-or-v1-...",
    needsBaseUrl: false,
  },
  {
    id: "gemini",
    short: "Gemini",
    label: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    placeholderModel: "gemini-2.5-flash",
    placeholderKey: "AIza...",
    needsBaseUrl: false,
  },
  {
    id: "anthropic",
    short: "Claude",
    label: "Anthropic Claude",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    placeholderModel: "claude-sonnet-4-20250514",
    placeholderKey: "sk-ant-...",
    needsBaseUrl: false,
  },
  {
    id: "openai",
    short: "OpenAI",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1",
    placeholderModel: "gpt-4.1",
    placeholderKey: "sk-...",
    needsBaseUrl: false,
  },
  {
    id: "deepseek",
    short: "DeepSeek",
    label: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    placeholderModel: "deepseek-chat",
    placeholderKey: "sk-...",
    needsBaseUrl: false,
  },
  {
    id: "groq",
    short: "Groq",
    label: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    placeholderModel: "llama-3.3-70b-versatile",
    placeholderKey: "gsk_...",
    needsBaseUrl: false,
  },
  {
    id: "ollama",
    short: "Ollama",
    label: "Ollama (Local)",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5-coder:7b",
    placeholderBaseUrl: "http://localhost:11434/v1",
    placeholderModel: "qwen2.5-coder:7b",
    placeholderKey: "Optional",
    needsBaseUrl: true,
  },
];

let cachedCapabilities = null;
let capabilitiesPromise = null;

function fetchAiCapabilitiesOnce() {
  if (cachedCapabilities) return Promise.resolve(cachedCapabilities);
  if (!capabilitiesPromise) {
    capabilitiesPromise = http
      .get("/ai/providers")
      .then(({ data }) => {
        cachedCapabilities = data;
        return data;
      })
      .catch(() => null)
      .finally(() => {
        capabilitiesPromise = null;
      });
  }
  return capabilitiesPromise;
}

export default function ModelSelector({
  preferredDirection = "auto",
  testId = "model-selector",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("models"); // "models" | "custom"
  const [cfg, setCfg] = useState(loadStoredLlmConfig);
  const [caps, setCaps] = useState(
    () =>
      cachedCapabilities || {
        server_ai: { configured: false, label: "Blueprint Engine", model: "blueprint-v3" },
        allow_user_override: true,
        models: FALLBACK_MODELS,
      }
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, openUp: false });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchAiCapabilitiesOnce().then((data) => {
      if (!mounted || !data) return;
      setCaps(data);
      // If user hasn't stored a model yet and server has a configured model, align default
      try {
        if (!localStorage.getItem("bp:llm-config")) {
          const firstReady = (data.models || []).find((m) => m.serverReady);
          if (firstReady) {
            setCfg((prev) => ({ ...prev, mode: "server", provider: "server", selectedModel: firstReady.id }));
          }
        }
      } catch {
        // ignore
      }
    });

    const onSync = () => setCfg(loadStoredLlmConfig());
    window.addEventListener("bp:llm-config", onSync);
    return () => {
      mounted = false;
      window.removeEventListener("bp:llm-config", onSync);
    };
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 316;
      const estimatedHeight = tab === "custom" ? 360 : 370;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp =
        preferredDirection === "up" ||
        (preferredDirection === "auto" && spaceBelow < estimatedHeight && spaceAbove > spaceBelow);

      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
      const top = openUp ? rect.top - 6 : rect.bottom + 6;
      setCoords({ top, left, openUp });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, tab, preferredDirection]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const models = caps?.models?.length ? caps.models : FALLBACK_MODELS;
  const allowOverride = caps?.allow_user_override !== false;

  const updateCfg = (patch) => {
    const next = saveStoredLlmConfig({ ...cfg, ...patch });
    setCfg(next);
    setTestResult(null);
  };

  const selectCuratedModel = (modelItem) => {
    updateCfg({
      mode: "server",
      provider: "server",
      selectedModel: modelItem.id,
    });
    setOpen(false);
  };

  const selectBuiltinEngine = () => {
    updateCfg({
      mode: "builtin",
      provider: "builtin",
    });
    setOpen(false);
  };

  const selectCustomPreset = (provId) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === provId) || PROVIDER_PRESETS[0];
    updateCfg({
      mode: "override",
      provider: provId,
      model: preset.defaultModel || "",
      baseUrl: preset.needsBaseUrl ? preset.defaultBaseUrl || "" : "",
      protocol: provId === "anthropic" ? "anthropic" : "openai",
    });
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload =
        cfg.mode === "override"
          ? { ...cfg, strict: true }
          : cfg.mode === "builtin"
          ? { mode: "builtin", provider: "builtin" }
          : { mode: "server", provider: "server", selectedModel: cfg.selectedModel };
      const { data } = await http.post("/ai/test", { llm_config: payload });
      setTestResult({ ok: true, text: data.message || `Connected (${data.engine})` });
      toast.success(data.message || "Model connection verified");
    } catch (e) {
      const msg = errMsg(e);
      setTestResult({ ok: false, text: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  // Compute active display label & readiness dot
  let activeLabel = "Gemini 2.5 Flash";
  let isLiveReady = false;

  if (cfg.mode === "builtin") {
    activeLabel = "Blueprint Engine";
    isLiveReady = true;
  } else if (cfg.mode === "override" && cfg.provider && cfg.provider !== "server" && allowOverride) {
    const preset = PROVIDER_PRESETS.find((p) => p.id === cfg.provider);
    const shortProv = preset?.short || cfg.provider;
    activeLabel = cfg.model?.trim() ? cfg.model.trim() : `${shortProv} Endpoint`;
    isLiveReady = Boolean(
      cfg.provider === "custom" || cfg.provider === "ollama"
        ? cfg.baseUrl?.trim()
        : cfg.apiKey?.trim()
    );
  } else {
    const found = models.find((m) => m.id === cfg.selectedModel || m.model === cfg.selectedModel) || models[0];
    if (found) {
      activeLabel = found.label;
      isLiveReady = Boolean(found.serverReady || caps?.server_ai?.configured);
    }
  }

  const activePreset =
    PROVIDER_PRESETS.find((p) => p.id === (cfg.provider !== "server" && cfg.provider !== "builtin" ? cfg.provider : "custom")) ||
    PROVIDER_PRESETS[0];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) {
            setTab(cfg.mode === "override" && allowOverride ? "custom" : "models");
          }
          setOpen((v) => !v);
        }}
        data-testid={testId}
        title="Select AI model or configure Custom Endpoint"
        className={`inline-flex items-center gap-1.5 rounded-md border hairline bg-background px-2.5 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-muted/70 ${className}`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isLiveReady ? "bg-[hsl(var(--success))]" : "bg-foreground/45"
          }`}
        />
        <span className="max-w-[165px] truncate">{activeLabel}</span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: `${coords.left}px`,
              top: coords.openUp ? "auto" : `${coords.top}px`,
              bottom: coords.openUp ? `${window.innerHeight - coords.top}px` : "auto",
              width: "316px",
              zIndex: 90,
            }}
            data-testid={`${testId}-popover`}
            className="overflow-hidden rounded-lg border hairline bg-card text-card-foreground shadow-xl"
          >
            {/* Header / Mode Switch */}
            <div className="flex items-center justify-between border-b hairline bg-muted/30 px-2.5 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {tab === "custom" ? "Custom Endpoint" : "Select Model"}
              </span>
              {allowOverride && (
                <div className="inline-flex rounded border hairline bg-background p-0.5 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => setTab("models")}
                    data-testid={`${testId}-tab-models`}
                    className={`rounded-sm px-2 py-0.5 transition-colors ${
                      tab === "models"
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Models
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab("custom");
                      if (cfg.mode !== "override") {
                        selectCustomPreset("custom");
                      }
                    }}
                    data-testid={`${testId}-tab-custom`}
                    className={`rounded-sm px-2 py-0.5 transition-colors ${
                      tab === "custom"
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Custom
                  </button>
                </div>
              )}
            </div>

            {tab === "models" ? (
              <div>
                <div className="max-h-[268px] overflow-y-auto py-1" data-testid={`${testId}-list`}>
                  {models.map((m) => {
                    const selected =
                      cfg.mode === "server" &&
                      (cfg.selectedModel === m.id || cfg.selectedModel === m.model);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectCuratedModel(m)}
                        data-testid={`${testId}-option-${m.id}`}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors ${
                          selected ? "bg-muted/80" : "hover:bg-muted/45"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              m.serverReady ? "bg-[hsl(var(--success))]" : "bg-border"
                            }`}
                            title={
                              m.serverReady
                                ? "Configured on server"
                                : "Server key not set — uses server default or Blueprint Engine"
                            }
                          />
                          <span className="truncate text-[12.5px] font-medium text-foreground">
                            {m.label}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {m.badge && (
                            <span className="rounded border hairline bg-background px-1.5 py-0.2 font-mono text-[9.5px] text-muted-foreground">
                              {m.badge}
                            </span>
                          )}
                          <span className="w-3.5">
                            {selected && <Check className="h-3.5 w-3.5 text-foreground" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  <div className="my-1 border-t hairline" />

                  <button
                    type="button"
                    onClick={selectBuiltinEngine}
                    data-testid={`${testId}-option-builtin`}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors ${
                      cfg.mode === "builtin" ? "bg-muted/80" : "hover:bg-muted/45"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Cpu className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-[12.5px] font-medium text-foreground">
                        Blueprint Engine
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded border hairline bg-background px-1.5 py-0.2 font-mono text-[9.5px] text-muted-foreground">
                        Instant
                      </span>
                      <span className="w-3.5">
                        {cfg.mode === "builtin" && <Check className="h-3.5 w-3.5 text-foreground" />}
                      </span>
                    </div>
                  </button>
                </div>

                <div className="flex items-center justify-between border-t hairline bg-muted/20 px-3 py-1.5">
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {caps?.server_ai?.configured
                      ? `Server: ${caps.server_ai.model}`
                      : "Server: Blueprint Engine ready"}
                  </span>
                  {allowOverride && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab("custom");
                        if (cfg.mode !== "override") selectCustomPreset("custom");
                      }}
                      className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-foreground hover:underline"
                    >
                      <Globe className="h-2.5 w-2.5" />
                      Custom URL / Key
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 p-3 text-xs">
                <div className="flex flex-wrap gap-1">
                  {PROVIDER_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectCustomPreset(p.id)}
                      data-testid={`${testId}-provider-${p.id}`}
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                        cfg.provider === p.id
                          ? "border-foreground bg-foreground text-background"
                          : "hairline bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p.short}
                    </button>
                  ))}
                </div>

                {cfg.provider === "custom" && (
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: "openai", label: "OpenAI (/v1)" },
                      { id: "anthropic", label: "Anthropic" },
                    ].map((proto) => (
                      <button
                        key={proto.id}
                        type="button"
                        onClick={() => updateCfg({ mode: "override", protocol: proto.id })}
                        className={`rounded border px-2 py-1 font-mono text-[10px] ${
                          (cfg.protocol || "openai") === proto.id
                            ? "border-foreground bg-muted font-medium text-foreground"
                            : "hairline bg-background text-muted-foreground"
                        }`}
                      >
                        {proto.label}
                      </button>
                    ))}
                  </div>
                )}

                {(activePreset.needsBaseUrl || cfg.provider === "openai") && (
                  <Input
                    type="url"
                    className="h-7 bg-background font-mono text-[11px]"
                    placeholder={
                      activePreset.placeholderBaseUrl ||
                      `${activePreset.defaultBaseUrl} (optional proxy)`
                    }
                    value={cfg.baseUrl || ""}
                    onChange={(e) => updateCfg({ mode: "override", baseUrl: e.target.value })}
                    data-testid={`${testId}-baseurl`}
                  />
                )}

                <Input
                  type="text"
                  className="h-7 bg-background font-mono text-[11px]"
                  placeholder={`Model ID: ${activePreset.placeholderModel}`}
                  value={cfg.model || ""}
                  onChange={(e) => updateCfg({ mode: "override", model: e.target.value })}
                  data-testid={`${testId}-model`}
                />

                <Input
                  type="password"
                  className="h-7 bg-background font-mono text-[11px]"
                  placeholder={activePreset.placeholderKey}
                  value={cfg.apiKey || ""}
                  onChange={(e) => updateCfg({ mode: "override", apiKey: e.target.value })}
                  data-testid={`${testId}-apikey`}
                />

                {testResult && (
                  <div
                    className={`rounded border px-2 py-1 font-mono text-[10px] leading-snug ${
                      testResult.ok
                        ? "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {testResult.text}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 font-mono text-[10.5px]"
                    disabled={testing}
                    onClick={testConnection}
                    data-testid={`${testId}-test-btn`}
                  >
                    {testing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Activity className="h-3 w-3" />
                    )}
                    Test
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        updateCfg({ ...DEFAULT_LLM_CONFIG });
                        setTab("models");
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 bg-foreground text-background hover:bg-foreground/90 text-[11px]"
                      onClick={() => setOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

