import axios from "axios";

export const API = "/api";
export const http = axios.create({ baseURL: API, withCredentials: true });

let refreshing = null;
http.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config;
    if (err.response?.status === 401 && !cfg._retry && !cfg.url.includes("/auth/")) {
      cfg._retry = true;
      try {
        refreshing = refreshing || http.post("/auth/refresh");
        await refreshing;
        refreshing = null;
        return http(cfg);
      } catch {
        refreshing = null;
      }
    }
    return Promise.reject(err);
  }
);

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  return d.msg || String(d);
}

export function download(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function notifyArtifactsUpdated(kinds = []) {
  for (const kind of kinds) {
    window.dispatchEvent(new CustomEvent("bp:artifact", { detail: { kind } }));
  }
  window.dispatchEvent(new CustomEvent("bp:docs-updated"));
}

export const DEFAULT_LLM_CONFIG = {
  mode: "server",
  provider: "server",
  selectedModel: "gemini-2.5-flash",
  apiKey: "",
  model: "",
  baseUrl: "",
  protocol: "openai",
};

export function loadStoredLlmConfig() {
  try {
    const raw = localStorage.getItem("bp:llm-config");
    if (!raw) return { ...DEFAULT_LLM_CONFIG };
    const parsed = JSON.parse(raw);
    if (!parsed.mode) {
      const hasCustom = Boolean(parsed.apiKey?.trim() || parsed.baseUrl?.trim());
      return {
        ...DEFAULT_LLM_CONFIG,
        ...parsed,
        mode: hasCustom ? "override" : "server",
        provider: hasCustom ? parsed.provider || "gemini" : "server",
      };
    }
    return { ...DEFAULT_LLM_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export function saveStoredLlmConfig(next) {
  const merged = { ...DEFAULT_LLM_CONFIG, ...next };
  try {
    localStorage.setItem("bp:llm-config", JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("bp:llm-config", { detail: merged }));
  } catch {
    // ignore storage quota errors
  }
  return merged;
}

export function getActiveClientLlmConfig(cfgInput = null) {
  const cfg = cfgInput || loadStoredLlmConfig();
  if (!cfg) return null;

  if (cfg.mode === "builtin" || cfg.provider === "builtin") {
    return { mode: "builtin", provider: "builtin" };
  }

  if (cfg.mode === "override" && cfg.provider && cfg.provider !== "server") {
    if (cfg.provider === "custom" || cfg.provider === "ollama") {
      return cfg.baseUrl?.trim() ? cfg : null;
    }
    return cfg.apiKey?.trim() ? cfg : null;
  }

  if (cfg.selectedModel) {
    return {
      mode: "server",
      provider: "server",
      selectedModel: cfg.selectedModel,
    };
  }

  return null;
}

export const KIND_LABEL = {
  brief: "Project brief",
  spec: "Product requirements",
  features: "Features",
  architecture: "Architecture",
  schema: "Database schema",
  api: "API catalog",
  roadmap: "Roadmap",
  flows: "User flows",
  ui: "UI/UX blueprint",
  security: "Security plan",
  testing: "Testing center",
  deployment: "Deployment center",
  docs: "Module docs (.md)",
};

export const KIND_PATH = {
  brief: "brief",
  spec: "requirements",
  features: "features",
  architecture: "architecture",
  schema: "database",
  api: "api",
  roadmap: "roadmap",
  flows: "flows",
  ui: "ui",
  security: "security",
  testing: "testing",
  deployment: "deployment",
  docs: "docs",
};
