// Unified Multi-Provider, Multi-Model & Custom Endpoint AI Engine for Formora
// Supports:
//   1. Antigravity-style Curated Model Selector (Gemini 2.5 Pro/Flash, Claude Sonnet 4 / 3.7, GPT-4.1 / 4o-mini, DeepSeek V3 / R1, Llama 3.3 70B)
//   2. Server-Managed SaaS AI via .env (direct provider keys OR universal OpenRouter / Custom LiteLLM Gateway)
//   3. Custom OpenAI-Compatible or Anthropic-Compatible Endpoints (Base URL + Model ID + Optional Key)
//   4. SSRF protection for untrusted client-supplied endpoint URLs in production

export const PROVIDER_CATALOG = {
  custom: {
    id: "custom",
    label: "Custom Endpoint",
    protocol: "openai",
    defaultBaseUrl: "",
    defaultModel: "",
    requiresKey: false,
    placeholderBaseUrl: "https://your-gateway.example.com/v1",
    placeholderModel: "e.g. deepseek-chat, gpt-4.1, qwen2.5-coder",
    placeholderKey: "Bearer API key (optional for local servers)",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    protocol: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.5-flash",
    requiresKey: true,
    placeholderModel: "gemini-2.5-flash",
    placeholderKey: "AIza...",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    requiresKey: true,
    placeholderModel: "claude-sonnet-4-20250514",
    placeholderKey: "sk-ant-...",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    protocol: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    requiresKey: true,
    placeholderModel: "gpt-4.1",
    placeholderKey: "sk-...",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.7-sonnet",
    requiresKey: true,
    placeholderModel: "anthropic/claude-3.7-sonnet",
    placeholderKey: "sk-or-v1-...",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    requiresKey: true,
    placeholderModel: "deepseek-chat",
    placeholderKey: "sk-...",
  },
  groq: {
    id: "groq",
    label: "Groq",
    protocol: "openai",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    requiresKey: true,
    placeholderModel: "llama-3.3-70b-versatile",
    placeholderKey: "gsk_...",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (Local)",
    protocol: "openai",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "qwen2.5-coder:7b",
    requiresKey: false,
    placeholderBaseUrl: "http://localhost:11434/v1",
    placeholderModel: "qwen2.5-coder:7b",
    placeholderKey: "Optional (leave blank for local Ollama)",
  },
};

export const CURATED_MODELS = [
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    model: "gemini-2.5-pro",
    openrouterModel: "google/gemini-2.5-pro-preview",
    badge: "Reasoning",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    model: "gemini-2.5-flash",
    openrouterModel: "google/gemini-2.5-flash-preview",
    badge: "Fast",
  },
  {
    id: "claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    openrouterModel: "anthropic/claude-sonnet-4",
    badge: "Architect",
  },
  {
    id: "claude-3.7-sonnet",
    label: "Claude 3.7 Sonnet",
    provider: "anthropic",
    model: "claude-3-7-sonnet-latest",
    openrouterModel: "anthropic/claude-3.7-sonnet",
    badge: "Thinking",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    provider: "openai",
    model: "gpt-4.1",
    openrouterModel: "openai/gpt-4.1",
    badge: "Structured",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "openai",
    model: "gpt-4o-mini",
    openrouterModel: "openai/gpt-4o-mini",
    badge: "Fast",
  },
  {
    id: "deepseek-v3",
    label: "DeepSeek V3",
    provider: "deepseek",
    model: "deepseek-chat",
    openrouterModel: "deepseek/deepseek-chat",
    badge: "Coder",
  },
  {
    id: "deepseek-r1",
    label: "DeepSeek R1",
    provider: "deepseek",
    model: "deepseek-reasoner",
    openrouterModel: "deepseek/deepseek-r1",
    badge: "Reasoning",
  },
  {
    id: "llama-3.3-70b",
    label: "Llama 3.3 70B",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    openrouterModel: "meta-llama/llama-3.3-70b-instruct",
    badge: "Ultra-fast",
  },
];

export function isUserLlmOverrideAllowed() {
  const raw = String(process.env.ALLOW_USER_LLM_CONFIG ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

function parseExtraHeaders(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const clean = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k === "string" && typeof v === "string" && /^[\w-]+$/.test(k)) {
        clean[k] = v;
      }
    }
    return clean;
  }
  if (typeof raw === "string") {
    try {
      return parseExtraHeaders(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return {};
}

export function validateClientEndpointUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") {
    return { ok: false, error: "Custom endpoint Base URL is required." };
  }
  let parsed;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { ok: false, error: "Invalid Custom Endpoint URL format (expected https://host/v1)." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Custom Endpoint URL must use https:// or http://." };
  }

  const isProd = process.env.NODE_ENV === "production";
  const allowLocal = String(process.env.ALLOW_LOCAL_LLM_ENDPOINTS || "").toLowerCase() === "true";

  if (isProd && !allowLocal) {
    if (parsed.protocol !== "https:") {
      return { ok: false, error: "Custom Endpoint URL must use https:// in production." };
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const blockedHost =
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^fc00:/i.test(host) ||
      /^fe80:/i.test(host);

    if (blockedHost) {
      return { ok: false, error: "Private, loopback, or metadata IP endpoints are blocked in production." };
    }
  }

  return { ok: true, url: parsed.toString().replace(/\/$/, "") };
}

function getServerKeys() {
  const explicitProvider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  const genericKey = process.env.AI_API_KEY || process.env.CUSTOM_AI_API_KEY || "";
  const genericBaseUrl = (process.env.AI_BASE_URL || process.env.CUSTOM_AI_BASE_URL || "").replace(/\/$/, "");
  const genericModel = process.env.AI_MODEL || process.env.CUSTOM_AI_MODEL || "";
  const extraModels = String(process.env.AI_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const customHeaders = parseExtraHeaders(process.env.AI_CUSTOM_HEADERS);

  return {
    explicitProvider,
    genericKey,
    genericBaseUrl,
    genericModel,
    extraModels,
    customHeaders,
    keys: {
      gemini: process.env.GEMINI_API_KEY || (explicitProvider === "gemini" ? genericKey : ""),
      openai: process.env.OPENAI_API_KEY || (explicitProvider === "openai" ? genericKey : ""),
      anthropic: process.env.ANTHROPIC_API_KEY || (explicitProvider === "anthropic" ? genericKey : ""),
      openrouter: process.env.OPENROUTER_API_KEY || (explicitProvider === "openrouter" ? genericKey : ""),
      groq: process.env.GROQ_API_KEY || (explicitProvider === "groq" ? genericKey : ""),
      deepseek: process.env.DEEPSEEK_API_KEY || (explicitProvider === "deepseek" ? genericKey : ""),
      ollama: explicitProvider === "ollama" ? genericKey : "",
      custom: genericKey,
    },
  };
}

/**
 * Detects the default Server-Managed AI configuration from environment variables (.env).
 */
export function getServerLlmConfig(requestedModelChoice = null) {
  const srv = getServerKeys();

  // If user selected a specific model from the Antigravity-style Model Picker in Server Mode:
  if (requestedModelChoice) {
    const curated = CURATED_MODELS.find(
      (m) => m.id === requestedModelChoice || m.model === requestedModelChoice
    );
    // 1. Direct provider key available on server
    if (curated && srv.keys[curated.provider]) {
      const meta = PROVIDER_CATALOG[curated.provider];
      return {
        source: "server",
        provider: curated.provider,
        protocol: meta.protocol,
        label: curated.label,
        apiKey: srv.keys[curated.provider],
        baseUrl: meta.defaultBaseUrl,
        model: curated.model,
        extraHeaders: srv.customHeaders,
      };
    }
    // 2. Server OpenRouter universal key available -> route any curated model seamlessly!
    if (curated && srv.keys.openrouter) {
      const meta = PROVIDER_CATALOG.openrouter;
      return {
        source: "server",
        provider: "openrouter",
        protocol: "openai",
        label: curated.label,
        apiKey: srv.keys.openrouter,
        baseUrl: meta.defaultBaseUrl,
        model: curated.openrouterModel || curated.model,
        extraHeaders: srv.customHeaders,
      };
    }
    // 3. Server Custom Gateway (LiteLLM / OneAPI / vLLM) available -> route model ID to server gateway!
    if (srv.genericBaseUrl) {
      return {
        source: "server",
        provider: "custom",
        protocol: String(process.env.AI_PROTOCOL || "openai").toLowerCase(),
        label: curated?.label || requestedModelChoice,
        apiKey: srv.genericKey,
        baseUrl: srv.genericBaseUrl,
        model: curated?.model || requestedModelChoice,
        extraHeaders: srv.customHeaders,
      };
    }
  }

  let provider = srv.explicitProvider;
  if (!provider) {
    if (srv.genericBaseUrl) provider = "custom";
    else if (srv.keys.gemini) provider = "gemini";
    else if (srv.keys.anthropic) provider = "anthropic";
    else if (srv.keys.openai) provider = "openai";
    else if (srv.keys.openrouter) provider = "openrouter";
    else if (srv.keys.deepseek) provider = "deepseek";
    else if (srv.keys.groq) provider = "groq";
  }

  if (!provider || !PROVIDER_CATALOG[provider]) return null;
  const meta = PROVIDER_CATALOG[provider];
  const apiKey = srv.keys[provider] || srv.genericKey || "";
  const baseUrl = (srv.genericBaseUrl || meta.defaultBaseUrl || "").replace(/\/$/, "");
  const model = srv.genericModel || meta.defaultModel || "gpt-4o-mini";

  if (provider === "custom" && !baseUrl) return null;
  if (meta.requiresKey && !apiKey) return null;

  return {
    source: "server",
    provider,
    protocol: String(process.env.AI_PROTOCOL || meta.protocol).toLowerCase(),
    label: meta.label,
    apiKey,
    baseUrl,
    model,
    extraHeaders: srv.customHeaders,
  };
}

/**
 * Resolves the effective LLM config for a request:
 *  - mode === "builtin": explicitly use instant deterministic Blueprint Engine
 *  - mode === "server" (default): uses Server-Managed AI (.env) with optional selectedModel
 *  - mode === "override": uses client-supplied provider / Custom Endpoint (if ALLOW_USER_LLM_CONFIG !== false)
 */
export function resolveEffectiveLlmConfig(clientConfig = null) {
  if (clientConfig?.mode === "builtin" || clientConfig?.provider === "builtin") {
    return null;
  }

  if (clientConfig && clientConfig.mode === "override" && clientConfig.provider && clientConfig.provider !== "server") {
    if (!isUserLlmOverrideAllowed()) {
      throw new Error("Client AI key/endpoint overrides are disabled on this server.");
    }
    const provId = String(clientConfig.provider).toLowerCase();
    const meta = PROVIDER_CATALOG[provId];
    if (!meta) {
      throw new Error(`Unsupported AI provider: ${provId}`);
    }

    const apiKey = String(clientConfig.apiKey || "").trim();
    const model = String(clientConfig.model || meta.defaultModel || "").trim();
    let baseUrl = String(clientConfig.baseUrl || meta.defaultBaseUrl || "").trim().replace(/\/$/, "");

    if (provId === "custom" || provId === "ollama" || clientConfig.baseUrl) {
      const check = validateClientEndpointUrl(baseUrl);
      if (!check.ok) throw new Error(check.error);
      baseUrl = check.url;
    }

    if (meta.requiresKey && !apiKey) {
      throw new Error(`${meta.label} requires an API key.`);
    }
    if (!model) {
      throw new Error(`Model name is required for ${meta.label}.`);
    }

    const protocol =
      clientConfig.protocol === "anthropic" || baseUrl.endsWith("/messages")
        ? "anthropic"
        : meta.protocol;

    return {
      source: "client",
      provider: provId,
      protocol,
      label: meta.label,
      apiKey,
      baseUrl,
      model,
      extraHeaders: parseExtraHeaders(clientConfig.extraHeaders),
    };
  }

  const requestedServerModel = clientConfig?.selectedModel || clientConfig?.model || null;
  return getServerLlmConfig(requestedServerModel);
}

export function getPublicAiCapabilities() {
  const srv = getServerLlmConfig();
  const rawKeys = getServerKeys();
  const hasUniversalGateway = Boolean(rawKeys.keys.openrouter || rawKeys.genericBaseUrl);

  const serverCustomModels = rawKeys.extraModels.map((mId) => ({
    id: mId,
    label: mId,
    provider: rawKeys.explicitProvider || "custom",
    model: mId,
    badge: "Server",
    serverReady: true,
  }));

  const curatedWithStatus = CURATED_MODELS.map((m) => ({
    ...m,
    serverReady: Boolean(rawKeys.keys[m.provider] || hasUniversalGateway),
  }));

  return {
    server_ai: srv
      ? {
          configured: true,
          provider: srv.provider,
          label: srv.label,
          model: srv.model,
          fallback: "semantic-architect",
        }
      : {
          configured: false,
          provider: "semantic-architect",
          label: "Blueprint Engine",
          model: "blueprint-v3",
          fallback: "semantic-architect",
        },
    allow_user_override: isUserLlmOverrideAllowed(),
    allow_local_endpoints:
      process.env.NODE_ENV !== "production" ||
      String(process.env.ALLOW_LOCAL_LLM_ENDPOINTS || "").toLowerCase() === "true",
    models: [...serverCustomModels, ...curatedWithStatus],
    providers: Object.values(PROVIDER_CATALOG).map((p) => ({
      id: p.id,
      label: p.label,
      protocol: p.protocol,
      defaultBaseUrl: p.defaultBaseUrl,
      defaultModel: p.defaultModel,
      requiresKey: p.requiresKey,
      placeholderBaseUrl: p.placeholderBaseUrl || "",
      placeholderModel: p.placeholderModel,
      placeholderKey: p.placeholderKey,
    })),
  };
}

export function extractJsonFromLlmText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty response from AI model");
  }
  const cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    if (start === -1) throw new Error("Model response did not contain a JSON object");
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            return JSON.parse(cleaned.slice(start, i + 1));
          }
        }
      }
    }
    throw new Error("Malformed JSON returned by AI model");
  }
}

function resolveOpenAiCompletionsUrl(baseUrl) {
  const clean = baseUrl.replace(/\/$/, "");
  if (clean.endsWith("/chat/completions")) return clean;
  return `${clean}/chat/completions`;
}

function resolveAnthropicMessagesUrl(baseUrl) {
  const clean = baseUrl.replace(/\/$/, "");
  if (clean.endsWith("/messages")) return clean;
  return `${clean}/messages`;
}

export async function invokeStructuredLlm({
  resolvedConfig,
  systemPrompt,
  userPrompt,
  timeoutMs = 45000,
  temperature = 0.35,
}) {
  if (!resolvedConfig) return null;
  const { provider, protocol, apiKey, baseUrl, model, extraHeaders = {}, source } = resolvedConfig;
  const started = Date.now();

  if (protocol === "gemini") {
    const root = (baseUrl || PROVIDER_CATALOG.gemini.defaultBaseUrl).replace(/\/$/, "");
    const url = `${root}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature },
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`Gemini HTTP ${resp.status}: ${errBody.slice(0, 180)}`);
    }
    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return {
      rawText,
      parsed: extractJsonFromLlmText(rawText),
      engine: `${provider}:${model}`,
      source,
      latencyMs: Date.now() - started,
    };
  }

  if (protocol === "anthropic") {
    const url = resolveAnthropicMessagesUrl(baseUrl || PROVIDER_CATALOG.anthropic.defaultBaseUrl);
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      ...extraHeaders,
    };
    if (apiKey) headers["x-api-key"] = apiKey;

    const resp = await fetch(url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      throw new Error(`Anthropic HTTP ${resp.status}: ${errBody.slice(0, 180)}`);
    }
    const data = await resp.json();
    const rawText = (data?.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return {
      rawText,
      parsed: extractJsonFromLlmText(rawText),
      engine: `${provider}:${model}`,
      source,
      latencyMs: Date.now() - started,
    };
  }

  const url = resolveOpenAiCompletionsUrl(baseUrl || PROVIDER_CATALOG.openai.defaultBaseUrl);
  const headers = {
    "Content-Type": "application/json",
    ...(provider === "openrouter"
      ? { "HTTP-Referer": process.env.FRONTEND_URL || "https://formora.dev", "X-Title": "Formora Blueprint OS" }
      : {}),
    ...extraHeaders,
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const sendOpenAiCompat = async (includeJsonFormat) => {
    const payload = {
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
    if (includeJsonFormat) {
      payload.response_format = { type: "json_object" };
    }
    return fetch(url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(payload),
    });
  };

  let resp = await sendOpenAiCompat(true);
  if (!resp.ok && (resp.status === 400 || resp.status === 422)) {
    resp = await sendOpenAiCompat(false);
  }

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`${provider.toUpperCase()} HTTP ${resp.status}: ${errBody.slice(0, 180)}`);
  }

  const data = await resp.json();
  const rawText = data?.choices?.[0]?.message?.content || "";
  return {
    rawText,
    parsed: extractJsonFromLlmText(rawText),
    engine: `${provider}:${model}`,
    source,
    latencyMs: Date.now() - started,
  };
}

const MODULE_JSON_TEMPLATES = {
  brief: `"brief": { "name": "", "description": "", "target_users": "", "problems": "", "business_model": "", "platform": "Web (responsive)", "languages": "TypeScript", "hosting": "Vercel", "database": "PostgreSQL", "auth": "Email + JWT", "payments": "Lemon Squeezy", "budget": "Under $100/mo", "scale": "Up to 10,000 users", "deadline": "6 weeks", "available_time": "20 hrs/week", "mvp_features": ["..."], "assumptions": [{"field":"scale","assumption":"..."}] }`,
  spec: `"spec": { "problem_statement": "", "target_audience": "", "value_proposition": "", "goals": [{"goal":"","metric":""}], "roles": [{"name":"","permissions":["..."]}], "functional_requirements": ["..."], "nonfunctional_requirements": ["..."], "mvp_scope": ["..."], "phase2_scope": ["..."], "out_of_scope": ["..."], "risks": ["..."], "open_questions": ["..."] }`,
  features: `"features": { "features": [{ "title": "", "description": "", "priority": "P0", "scope": "mvp", "completion_criteria": ["..."], "stories": [{"as_a":"","i_want":"","so_that":"","acceptance_criteria":["..."]}] }] }`,
  flows: `"flows": { "flows": [{ "title": "", "role": "Member", "entry_point": "/dashboard", "goal": "", "steps": [{ "order": 1, "actor": "Member", "action": "", "screen": "/dashboard", "system_response": "" }], "success_outcome": "", "branches": [{ "condition": "", "handling": "" }] }] }`,
  ui: `"ui": { "sitemap": [{ "path": "/", "label": "Landing", "auth": false, "role": "Public", "purpose": "" }], "screens": [{ "name": "", "route": "/dashboard", "role": "Member", "layout": "sidebar_table", "purpose": "", "components": ["..."], "states": { "loading": "", "empty": "", "error": "", "success": "" } }], "tokens": { "aesthetic": "Precision Swiss editorial workspace", "primary_color": "#18181b", "accent_color": "#2563eb", "heading_font": "IBM Plex Sans", "mono_font": "JetBrains Mono", "radius": "6px" } }`,
  architecture: `"architecture": { "summary": "", "nodes": [{ "id": "n1", "type": "web_frontend|mobile_frontend|backend|database|cache|auth|storage|email|payments|worker|external_api|hosting|monitoring", "name": "", "technology": "", "responsibility": "", "rationale": "" }], "edges": [{ "source": "n1", "target": "n2", "protocol": "HTTPS REST|SQL / database access|Events|Background job|Webhook|SDK|WebSocket|Deploy", "label": "" }] }`,
  schema: `"schema": { "entities": [{ "name": "snake_case_plural", "purpose": "", "fields": [{ "name": "id", "type": "uuid", "primary_key": true }, { "name": "col", "type": "varchar(140)|text|integer|numeric(10,2)|boolean|timestamptz|jsonb", "nullable": false, "unique": false, "indexed": false }] }], "relationships": [{ "source_entity": "orders", "source_field": "user_id", "target_entity": "users", "kind": "one_to_many", "on_delete": "CASCADE" }] }`,
  api: `"api": { "endpoints": [{ "method": "GET|POST|PUT|PATCH|DELETE", "path": "/api/...", "purpose": "", "auth_required": true, "role": "", "request_schema": "{...}", "response_schema": "{...}", "validation": ["..."], "errors": ["401 Unauthorized"], "rate_limit": "60/min", "entity_ids": ["table_name"], "test_cases": ["..."] }] }`,
  security: `"security": { "posture_summary": "", "controls": [{ "category": "Authentication & Session|Authorization & IDOR|Data & Secrets|Input & Rate Limiting|Webhooks & Billing", "title": "", "severity": "critical|high|medium", "status": "implemented|planned", "mitigation": "", "verification": "" }], "threats": [{ "risk": "", "severity": "high", "vector": "", "mitigation": "" }] }`,
  roadmap: `"roadmap": { "tasks": [{ "milestone": 1, "title": "", "description": "", "deliverable": "", "files": ["..."], "acceptance_criteria": ["..."], "tests": ["..."], "complexity": "S|M|L", "status": "ready", "entity_ids": ["table_name"] }] }`,
  testing: `"testing": { "strategy": "", "runner_stack": { "unit": "Vitest", "integration": "Vitest + Supertest", "e2e": "Playwright" }, "cases": [{ "level": "unit|integration|e2e", "title": "", "target": "", "status": "ready", "steps": ["..."], "expected": "" }] }`,
  deployment: `"deployment": { "target_summary": "", "hosting_target": "Vercel + Managed PostgreSQL", "database_target": "PostgreSQL", "healthcheck_url": "/api/health", "environments": [{ "name": "Production", "branch": "main", "url": "https://app.example.com", "compute": "Container", "database_tier": "Managed Postgres", "auto_deploy": false, "healthcheck_path": "/api/health" }], "env_vars": [{ "key": "DATABASE_URL", "scope": "server", "required": true, "secret": true, "example": "postgresql://...", "description": "" }], "checklist": [{ "category": "Secrets & Auth", "title": "", "required": true, "checked": false, "notes": "" }], "steps": [{ "order": 1, "stage": "Provision", "title": "", "command": "", "verification": "", "done": false }], "rollback_plan": "" }`,
  docs: `"docs": { "notes": "Concise domain-specific architectural guidance and edge-case notes in clean Markdown." }`,
};

export function buildArchitectSystemPrompt(targetList, mode, existingSummary) {
  const activeLines = targetList
    .map((k) => MODULE_JSON_TEMPLATES[k])
    .filter(Boolean)
    .map((line) => `  ${line}`);

  return `You are the Formora AI Software Architect.
Decompose the user's product idea or change request into SEPARATE structured JSON modules so each module renders in its own visual panel.
Mode: ${mode}. Requested target panels: ${targetList.join(", ")}.
Current project state: ${JSON.stringify(existingSummary)}.

Return ONLY valid JSON matching this structure (include ONLY keys in [${targetList.join(", ")}] plus "reply" and optional "project_name"; no markdown fences):
{
  "project_name": "Short clean product name",
  "reply": "2-3 concise sentences explaining how you separated their idea across the visual panels (do NOT dump big markdown tables here).",
${activeLines.join(",\n")}
}`;
}

export async function runUnifiedLiveLlm({ message, project, existingArtifacts, targets, mode, llmConfig }) {
  let resolvedConfig = null;
  try {
    resolvedConfig = resolveEffectiveLlmConfig(llmConfig);
  } catch (cfgErr) {
    if (llmConfig && llmConfig.strict) {
      throw cfgErr;
    }
    console.warn("LLM config error, falling back to built-in Semantic Architect:", cfgErr.message);
    return null;
  }

  if (!resolvedConfig) return null;

  const targetList = [...targets];
  const existingSummary = {
    project_name: project?.name,
    existing_tables: (existingArtifacts.schema?.content?.entities || []).map((e) => e.name),
    existing_endpoints: (existingArtifacts.api?.content?.endpoints || []).map((e) => `${e.method} ${e.path}`),
  };

  const systemPrompt = buildArchitectSystemPrompt(targetList, mode, existingSummary);

  try {
    const res = await invokeStructuredLlm({
      resolvedConfig,
      systemPrompt,
      userPrompt: message,
      timeoutMs: 45000,
    });
    if (!res?.parsed) return null;
    return {
      parsed: res.parsed,
      engine: res.engine,
      source: res.source,
      latencyMs: res.latencyMs,
    };
  } catch (err) {
    console.warn(`Live LLM (${resolvedConfig.provider}:${resolvedConfig.model}) failed, falling back to Semantic Architect:`, err.message);
    return null;
  }
}

export async function testLlmConnection(clientConfig = null) {
  const resolvedConfig = resolveEffectiveLlmConfig(clientConfig);
  if (!resolvedConfig) {
    return {
      ok: true,
      engine: "blueprint-engine",
      model: "blueprint-v3",
      source: "builtin",
      latency_ms: 1,
      message: "Blueprint Engine active (instant deterministic synthesis).",
    };
  }

  const res = await invokeStructuredLlm({
    resolvedConfig,
    systemPrompt: 'Return ONLY valid JSON: {"status":"ok","architect":"ready"}',
    userPrompt: "Health check ping. Respond with JSON.",
    timeoutMs: 15000,
    temperature: 0,
  });

  return {
    ok: true,
    engine: res.engine,
    provider: resolvedConfig.provider,
    model: resolvedConfig.model,
    source: resolvedConfig.source,
    latency_ms: res.latencyMs,
    message: `Connected to ${resolvedConfig.model} in ${res.latencyMs}ms.`,
  };
}
