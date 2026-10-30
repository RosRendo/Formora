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
  docs: "docs",
};
