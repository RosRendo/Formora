import { Monitor, Smartphone, Server, Waypoints, Database, Zap, KeyRound, HardDrive, Mail, CreditCard, Cog, Globe, Cloud, Activity } from "lucide-react";

export const NODE_TYPES = {
  web_frontend: { label: "Web frontend", icon: Monitor, tint: "#6366f1" },
  mobile_frontend: { label: "Mobile frontend", icon: Smartphone, tint: "#6366f1" },
  backend: { label: "Backend application", icon: Server, tint: "#0ea5e9" },
  api_gateway: { label: "API gateway", icon: Waypoints, tint: "#0ea5e9" },
  database: { label: "Database", icon: Database, tint: "#10b981" },
  cache: { label: "Cache", icon: Zap, tint: "#f59e0b" },
  auth: { label: "Authentication", icon: KeyRound, tint: "#a855f7" },
  storage: { label: "Object storage", icon: HardDrive, tint: "#10b981" },
  email: { label: "Email provider", icon: Mail, tint: "#ec4899" },
  payments: { label: "Payment provider", icon: CreditCard, tint: "#ec4899" },
  worker: { label: "Background worker", icon: Cog, tint: "#0ea5e9" },
  external_api: { label: "External API", icon: Globe, tint: "#64748b" },
  hosting: { label: "Hosting & deploy", icon: Cloud, tint: "#64748b" },
  monitoring: { label: "Monitoring & logs", icon: Activity, tint: "#64748b" },
};

export const PROTOCOLS = ["HTTPS REST", "SQL / database access", "Events", "Background job", "Webhook", "SDK", "WebSocket", "Deploy"];

export function reviewArchitecture(nodes, edges, brief) {
  const types = nodes.map((n) => n.type);
  const has = (t) => types.includes(t);
  const out = [];
  if (!has("web_frontend") && !has("mobile_frontend")) out.push({ level: "missing", text: "No client (web or mobile frontend)." });
  if (!has("backend")) out.push({ level: "missing", text: "No backend application." });
  if (!has("database")) out.push({ level: "missing", text: "No database." });
  if (!has("auth") && brief?.auth && !/none|no auth/i.test(brief.auth)) out.push({ level: "missing", text: `Brief requires authentication (${brief.auth}) but no auth component exists.` });
  if (!has("payments") && brief?.payments && !/^no|none|not in mvp/i.test(brief.payments)) out.push({ level: "missing", text: `Brief mentions payments (${brief.payments}) but no payment provider exists.` });
  if (/mobile/i.test(brief?.platform || "") && !has("mobile_frontend")) out.push({ level: "missing", text: "Brief targets mobile but there is no mobile frontend." });
  if (!has("hosting")) out.push({ level: "missing", text: "No hosting / deployment target." });
  if (!has("monitoring")) out.push({ level: "missing", text: "No monitoring or error logging." });
  if (has("api_gateway") && types.filter((t) => t === "backend").length <= 1) out.push({ level: "complexity", text: "API gateway in front of a single backend adds complexity without clear benefit." });
  if (types.filter((t) => t === "backend").length > 1) out.push({ level: "complexity", text: "Multiple backend services — make sure there is a concrete reason not to keep one modular app." });
  if (has("cache") && /^(fewer|under|<)?\s*\d{1,3}\b|fewer than 1,000/i.test(brief?.scale || "")) out.push({ level: "complexity", text: "Cache at small expected scale is probably premature." });
  const connected = new Set(edges.flatMap((e) => [e.source, e.target]));
  nodes.filter((n) => !connected.has(n.id)).forEach((n) => out.push({ level: "warning", text: `"${n.name}" is not connected to anything.` }));
  return out;
}
