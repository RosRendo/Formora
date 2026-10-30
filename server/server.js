import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SEED_USER, SEED_PROJECT, SEED_ARTIFACTS, SEED_DECISIONS } from "./seedData.js";
import {
  generateSql,
  generatePrisma,
  generateBlueprintMarkdown,
  generateModuleMarkdowns,
  validateSchema,
} from "./generator.js";
import { runArchitectChat, normalizeModuleUpdates } from "./aiArchitect.js";
import { derivePhase2FromProject } from "./phase2Architect.js";
import { deriveDeploymentFromProject } from "./phase3Architect.js";
import {
  PLANS,
  verifyLemonSqueezySignature,
  createCheckoutSession,
  handleLemonSqueezyWebhookEvent,
} from "./billing.js";
import {
  initializeSqliteDatabase,
  persistStateToSqlite,
  storeRefreshToken,
  consumeRefreshToken,
  revokeRefreshToken,
  getDatabaseHealth,
} from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_PROD = process.env.NODE_ENV === "production";
if (IS_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error("FATAL: Production requires a strong JWT_SECRET environment variable (>= 32 chars).");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || "formora-dev-only-secret-key-2026-local";

const ACCESS_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const app = express();
app.disable("x-powered-by");

// --- Security Headers ---
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (IS_PROD) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  express.json({
    limit: "5mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(cookieParser());

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
  : null;
app.use(
  cors({
    origin: IS_PROD && allowedOrigins?.length ? allowedOrigins : true,
    credentials: true,
  })
);

// --- Sliding-Window Rate Limiter ---
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 20, detail = "Too many requests. Please try again shortly." }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const recent = (buckets.get(ip) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= max) {
      const retryAfterSec = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ detail });
    }
    recent.push(now);
    buckets.set(ip, recent);
    if (buckets.size > 2000) {
      for (const [k, timestamps] of buckets.entries()) {
        if (!timestamps.some((ts) => now - ts < windowMs)) buckets.delete(k);
      }
    }
    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 25,
  detail: "Too many authentication attempts. Please wait a few minutes and try again.",
});

const checkoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  detail: "Too many checkout requests. Please wait a moment and try again.",
});

// --- Relational SQLite WAL Persistence Initialization ---
function createInitialSeedState() {
  const now = new Date().toISOString();
  const seedProj = {
    ...SEED_PROJECT,
    user_id: SEED_USER.id,
  };
  return {
    users: [
      {
        ...SEED_USER,
        plan: "free",
        password_hash: bcrypt.hashSync(SEED_USER.password, 10),
        created_at: now,
        updated_at: now,
      },
    ],
    projects: [seedProj],
    artifacts: {
      [SEED_PROJECT.id]: SEED_ARTIFACTS,
    },
    artifact_versions: {
      [SEED_PROJECT.id]: {
        brief: [{ version_number: 1, content: SEED_ARTIFACTS.brief?.content, summary: "Initial brief approved", created_at: now }],
        spec: [{ version_number: 1, content: SEED_ARTIFACTS.spec?.content, summary: "Product requirements spec", created_at: now }],
        features: [{ version_number: 1, content: SEED_ARTIFACTS.features?.content, summary: "Initial feature list", created_at: now }],
        architecture: [{ version_number: 1, content: SEED_ARTIFACTS.architecture?.content, summary: "Initial topology", created_at: now }],
        schema: [{ version_number: 1, content: SEED_ARTIFACTS.schema?.content, summary: "PostgreSQL initial tables", created_at: now }],
        api: [{ version_number: 1, content: SEED_ARTIFACTS.api?.content, summary: "REST API endpoints", created_at: now }],
        roadmap: [{ version_number: 1, content: SEED_ARTIFACTS.roadmap?.content, summary: "Tasks roadmap", created_at: now }],
      },
    },
    decisions: {
      [SEED_PROJECT.id]: SEED_DECISIONS,
    },
    ai_jobs: {
      [SEED_PROJECT.id]: [
        {
          id: "job-seed-api",
          workflow: "api",
          workflow_id: "api",
          target_kind: "api",
          status: "applied",
          input_chars: 1840,
          output_chars: 4120,
          duration_ms: 2100,
          notes: "Generated 7 REST endpoints matching book club organizer criteria.",
          created_at: now,
        },
      ],
    },
    chats: {},
    module_docs: {},
    processed_webhooks: [],
    subscriptions: {},
    transactions: [],
  };
}

let DB = initializeSqliteDatabase(createInitialSeedState);

// Ensure legacy migrated projects always have an explicit owner user_id (zero orphan leakage)
let repairedOwners = false;
const defaultOwnerId = DB.users.find((u) => u.id === SEED_USER.id)?.id || DB.users[0]?.id || null;
for (const proj of DB.projects) {
  if (!proj.user_id && defaultOwnerId) {
    proj.user_id = defaultOwnerId;
    repairedOwners = true;
  }
}

function saveDb() {
  persistStateToSqlite(DB);
}

if (repairedOwners) {
  saveDb();
}

// --- Helper: Apply Structured Module Updates Directly Into Their Own Panels ---
const ARTIFACT_KINDS = ["brief", "spec", "features", "flows", "ui", "architecture", "schema", "api", "security", "roadmap", "testing", "deployment"];
const PHASE2_KINDS = ["flows", "ui", "security", "testing", "deployment"];

function backfillMissingPhase2ForProject(project) {
  if (!project) return false;
  const pid = project.id;
  if (!DB.artifacts[pid]) DB.artifacts[pid] = {};
  if (!DB.artifact_versions[pid]) DB.artifact_versions[pid] = {};
  const arts = DB.artifacts[pid];
  const missing = PHASE2_KINDS.filter((k) => !arts[k]);
  if (!missing.length) return false;

  const derived = {
    ...derivePhase2FromProject(project, arts),
    deployment: deriveDeploymentFromProject(project, arts),
  };
  const now = new Date().toISOString();
  const isApprovedSample = Boolean(project.is_sample);

  for (const kind of missing) {
    const content = derived[kind] || {};
    arts[kind] = {
      artifact: {
        id: `art-${pid}-${kind}`,
        project_id: pid,
        kind,
        current_version: 1,
        approved_version: isApprovedSample ? 1 : null,
        approved_at: isApprovedSample ? now : null,
        status: isApprovedSample ? "approved" : "draft",
        needs_review: false,
        review_reason: null,
        updated_at: now,
      },
      content,
      approved_content: isApprovedSample ? JSON.parse(JSON.stringify(content)) : null,
    };
    if (!DB.artifact_versions[pid][kind] || !DB.artifact_versions[pid][kind].length) {
      DB.artifact_versions[pid][kind] = [
        {
          version_number: 1,
          content: JSON.parse(JSON.stringify(content)),
          summary: `Initial ${kind} blueprint`,
          created_at: now,
        },
      ];
    }
  }
  return true;
}

let backfilledPhase2 = false;
for (const proj of DB.projects) {
  if (backfillMissingPhase2ForProject(proj)) {
    backfilledPhase2 = true;
  }
}
if (backfilledPhase2) {
  saveDb();
}

function createEmptyArtifacts(pid, name, description, answers = {}) {
  const baseline = normalizeModuleUpdates({
    brief: {
      name,
      description: description || "",
      problems: answers?.problems || answers?.problem || "",
      target_users: answers?.target_users || answers?.audience || "",
      platform: answers?.platform || "Web (responsive)",
      languages: answers?.languages || answers?.language || "TypeScript",
      database: answers?.database || "PostgreSQL",
      auth: answers?.auth || "Email magic link",
      payments: answers?.payments || "Not in MVP",
      hosting: answers?.hosting || "Vercel + managed Postgres",
      budget: answers?.budget || "Under $100/mo",
      deadline: answers?.deadline || "6 weeks",
      available_time: answers?.available_time || "15 hours/week",
      scale: answers?.scale || "Up to 5,000 users",
      business_model: answers?.business_model || "SaaS subscription",
      mvp_features: answers?.mvp_features?.length
        ? answers.mvp_features
        : ["User authentication & workspace setup", "Core workflow execution", "Dashboard and exports"],
      assumptions: [{ field: "auth", assumption: "MVP relies on magic links to reduce signup friction." }],
    },
    spec: {
      problem_statement: answers?.problems || "Users face friction coordinating the workflow across scattered tools.",
      value_proposition: description || "One structured workspace to execute the workflow end-to-end.",
      target_audience: answers?.target_users || "Founders, operators, and team members",
      goals: [{ goal: "Deliver core MVP workflow", metric: ">= 60% onboarding completion in week 1" }],
      roles: [
        { name: "Admin", permissions: ["Configure workspace", "Invite members", "Export data"] },
        { name: "Member", permissions: ["Create and update items", "Collaborate on workflows"] },
      ],
      mvp_scope: answers?.mvp_features?.length ? answers.mvp_features : ["Authentication", "Core CRUD", "Exports"],
      phase2_scope: ["Analytics & third-party webhooks"],
      out_of_scope: ["On-premise enterprise SSO in MVP"],
      functional_requirements: ["Email magic-link sign in", "Create and manage core records", "Structured exports"],
      nonfunctional_requirements: ["P95 API latency under 200ms", "Daily PostgreSQL backups"],
      risks: ["Scope creep delaying initial launch"],
      open_questions: ["Should guest read-only links be enabled in MVP?"],
    },
    features: {
      features: [
        {
          id: `feat-${pid}-1`,
          title: "Authentication & Workspace Access",
          description: "Passwordless or credential sign-in with role permissions.",
          priority: "P0",
          scope: "mvp",
          completion_criteria: ["Users sign in and maintain sessions"],
          stories: [
            {
              as_a: "user",
              i_want: "to sign in smoothly",
              so_that: "I can access my workspace securely",
              acceptance_criteria: ["Protected routes require valid session"],
            },
          ],
        },
        {
          id: `feat-${pid}-2`,
          title: "Core Resource Management",
          description: "Create, filter, and update primary domain records.",
          priority: "P0",
          scope: "mvp",
          depends_on: [`feat-${pid}-1`],
          completion_criteria: ["CRUD operations validated and persisted"],
          stories: [],
        },
      ],
    },
    architecture: {
      summary: "Modular 3-tier web architecture with React SPA, REST API, PostgreSQL, Auth, Hosting, and Monitoring.",
      nodes: [
        { id: "n-web", name: "Web App", type: "web_frontend", technology: "React + TypeScript + Tailwind", responsibility: "User interface and state", rationale: "Fast component iteration", x: 0, y: 120 },
        { id: "n-api", name: "API Service", type: "backend", technology: "Node.js + Express", responsibility: "Business logic and REST contracts", rationale: "Simple modular monolith", x: 340, y: 120 },
        { id: "n-db", name: "Primary DB", type: "database", technology: answers?.database || "PostgreSQL", responsibility: "Relational persistence", rationale: "ACID integrity & FK constraints", x: 680, y: 40 },
        { id: "n-auth", name: "Auth", type: "auth", technology: answers?.auth || "JWT / Magic Link", responsibility: "Sessions & role verification", rationale: "Low-friction onboarding", x: 680, y: 220 },
        { id: "n-host", name: "Hosting", type: "hosting", technology: answers?.hosting || "Vercel", responsibility: "Automated builds & deploys", rationale: "Zero-config CI/CD", x: 0, y: 320 },
        { id: "n-mon", name: "Monitoring", type: "monitoring", technology: "Sentry", responsibility: "Error & latency tracking", rationale: "Immediate production visibility", x: 340, y: 320 },
      ],
      edges: [
        { source: "n-web", target: "n-api", protocol: "HTTPS REST", label: "JSON API calls" },
        { source: "n-api", target: "n-db", protocol: "SQL / database access", label: "Parameterized queries" },
        { source: "n-api", target: "n-auth", protocol: "SDK", label: "Session checks" },
        { source: "n-host", target: "n-web", protocol: "Deploy", label: "CI on push" },
        { source: "n-api", target: "n-mon", protocol: "SDK", label: "Error telemetry" },
      ],
    },
    schema: {
      entities: [
        {
          id: "ent-users",
          name: "users",
          purpose: "Authenticated users.",
          timestamps: true,
          x: 0,
          y: 40,
          fields: [
            { id: "f-u1", name: "id", type: "uuid", primary_key: true, default: "gen_random_uuid()" },
            { id: "f-u2", name: "email", type: "varchar(255)", unique: true },
            { id: "f-u3", name: "name", type: "varchar(120)" },
          ],
        },
        {
          id: "ent-items",
          name: "items",
          purpose: "Primary workspace records.",
          timestamps: true,
          x: 360,
          y: 40,
          fields: [
            { id: "f-i1", name: "id", type: "uuid", primary_key: true, default: "gen_random_uuid()" },
            { id: "f-i2", name: "user_id", type: "uuid", indexed: true },
            { id: "f-i3", name: "title", type: "varchar(180)" },
            { id: "f-i4", name: "status", type: "varchar(40)", default: "'active'" },
          ],
        },
      ],
      relationships: [
        { source_entity: "ent-items", source_field: "f-i2", target_entity: "ent-users", target_field: "f-u1", kind: "one_to_many", on_delete: "CASCADE" },
      ],
    },
    api: {
      endpoints: [
        {
          method: "GET",
          path: "/api/items",
          purpose: "List items belonging to the signed-in user.",
          auth_required: true,
          role: "Member",
          request_schema: "// ?status=active",
          response_schema: '{ "items": [{ "id": "uuid", "title": "Sample", "status": "active" }] }',
          validation: ["Scoped to caller user_id"],
          errors: ["401 Unauthorized"],
          rate_limit: "60/min",
          entity_ids: ["ent-items"],
          test_cases: ["Returns 200 with caller's items"],
        },
        {
          method: "POST",
          path: "/api/items",
          purpose: "Create a new workspace item.",
          auth_required: true,
          role: "Member",
          request_schema: '{ "title": "Launch checklist" }',
          response_schema: '{ "id": "uuid", "title": "Launch checklist", "status": "active" }',
          validation: ["title: required, 1..180 chars"],
          errors: ["401 Unauthorized", "422 Unprocessable Entity"],
          rate_limit: "20/min",
          entity_ids: ["ent-items"],
          test_cases: ["Valid title creates row and returns 201"],
        },
      ],
    },
    roadmap: {
      tasks: [
        { milestone: 1, title: "Scaffold repository & environment config", deliverable: "Running dev skeleton", files: ["package.json"], acceptance_criteria: ["App boots locally"], complexity: "S", status: "ready" },
        { milestone: 2, title: "Create initial PostgreSQL migration", deliverable: "Applied schema migration", files: ["prisma/schema.prisma"], acceptance_criteria: ["Tables & FKs created"], complexity: "M", status: "ready", entity_ids: ["ent-users", "ent-items"] },
        { milestone: 4, title: "Implement items REST endpoints", deliverable: "Tested CRUD endpoints", files: ["src/routes/items.ts"], acceptance_criteria: ["GET and POST /api/items pass tests"], complexity: "M", status: "ready", entity_ids: ["ent-items"] },
      ],
    },
  });

  const now = new Date().toISOString();
  const derivedPhase2 = derivePhase2FromProject(
    { id: pid, name, description },
    Object.fromEntries(Object.entries(baseline).map(([k, v]) => [k, { content: v }]))
  );
  Object.assign(baseline, derivedPhase2);
  baseline.deployment = deriveDeploymentFromProject(
    { id: pid, name, description },
    Object.fromEntries(Object.entries(baseline).map(([k, v]) => [k, { content: v }]))
  );

  const artifacts = {};
  const versions = {};
  for (const kind of ARTIFACT_KINDS) {
    artifacts[kind] = {
      artifact: {
        id: `art-${pid}-${kind}`,
        project_id: pid,
        kind,
        current_version: 1,
        approved_version: null,
        approved_at: null,
        status: "draft",
        needs_review: false,
        review_reason: null,
        updated_at: now,
      },
      content: baseline[kind],
      approved_content: null,
    };
    versions[kind] = [
      {
        version_number: 1,
        content: JSON.parse(JSON.stringify(baseline[kind])),
        summary: `Initial ${kind} draft`,
        created_at: now,
      },
    ];
  }
  return { artifacts, versions };
}

function applyUpdatesToProject(pid, updates, { summaryNote = "Placed via AI Architect Chat", projectName = null, kindsFilter = null } = {}) {
  const project = DB.projects.find((pr) => pr.id === pid);
  const arts = DB.artifacts[pid];
  if (!project || !arts) return { updatedKinds: [], versions: {} };

  const now = new Date().toISOString();
  const updatedKinds = [];
  const appliedVersions = {};

  if (!DB.artifact_versions[pid]) DB.artifact_versions[pid] = {};
  if (!DB.module_docs[pid]) DB.module_docs[pid] = {};

  for (const kind of ARTIFACT_KINDS) {
    if (kindsFilter && !kindsFilter.includes(kind)) continue;
    if (!updates[kind]) continue;

    if (!arts[kind]) {
      arts[kind] = {
        artifact: { id: `art-${pid}-${kind}`, project_id: pid, kind, current_version: 0, status: "draft", needs_review: false, review_reason: null },
        content: {},
      };
    }

    const artObj = arts[kind];
    artObj.content = JSON.parse(JSON.stringify(updates[kind]));
    artObj.artifact.current_version = (artObj.artifact.current_version || 0) + 1;
    artObj.artifact.status = artObj.artifact.approved_version ? "changed" : "draft";
    artObj.artifact.needs_review = false;
    artObj.artifact.review_reason = null;
    artObj.artifact.updated_at = now;

    if (!DB.artifact_versions[pid][kind]) DB.artifact_versions[pid][kind] = [];
    DB.artifact_versions[pid][kind].unshift({
      version_number: artObj.artifact.current_version,
      content: JSON.parse(JSON.stringify(updates[kind])),
      summary: summaryNote,
      created_at: now,
    });

    updatedKinds.push(kind);
    appliedVersions[kind] = artObj.artifact.current_version;
  }

  if ((!kindsFilter || kindsFilter.includes("docs")) && updates.docs) {
    DB.module_docs[pid].notes = {
      notes: updates.docs.notes || "",
      updated_at: now,
    };
    updatedKinds.push("docs");
  }

  if (projectName && (/^(new project|untitled|my project)/i.test(project.name) || updates.brief?.name === projectName)) {
    if (/^(new project|untitled|my project)/i.test(project.name)) {
      project.name = projectName;
    }
  }
  if (updates.brief?.description && (!project.description || project.description === "New software blueprint")) {
    project.description = updates.brief.description.slice(0, 240);
  }

  project.updated_at = now;
  project.ai_usage = {
    jobs: (project.ai_usage?.jobs || 0) + 1,
    chars: (project.ai_usage?.chars || 0) + JSON.stringify(updates).length,
  };

  if (updatedKinds.length > 0) {
    if (!DB.decisions[pid]) DB.decisions[pid] = [];
    DB.decisions[pid].unshift({
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "ai",
      title: `AI Chat routed updates to ${updatedKinds.length} module panel(s)`,
      decision: `Updated separate panels: ${updatedKinds.join(", ")}.`,
      reasoning: summaryNote,
      artifact_kind: updatedKinds[0] || null,
      created_at: now,
    });
  }

  return { updatedKinds, versions: appliedVersions };
}

// --- Auth & Tenant Isolation Middleware ---
const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax",
  path: "/",
};

function sanitizeUser(user) {
  const { password_hash, password: _pw, ...safeUser } = user;
  safeUser.plan = user.plan || "free";
  safeUser.subscription = DB.subscriptions?.[user.id] || user.subscription || null;
  return safeUser;
}

function setAuthCookies(res, user) {
  const token = jwt.sign(
    { sub: user.id, email: user.email, type: "access" },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
  const refresh = jwt.sign(
    { sub: user.id, type: "refresh", jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  const expiresAtIso = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  storeRefreshToken(refresh, user.id, expiresAtIso);

  res.cookie("access_token", token, { ...COOKIE_BASE, maxAge: ACCESS_TTL_MS });
  res.cookie("refresh_token", refresh, { ...COOKIE_BASE, maxAge: REFRESH_TTL_MS });
}

function clearAuthCookies(res) {
  res.clearCookie("access_token", COOKIE_BASE);
  res.clearCookie("refresh_token", COOKIE_BASE);
}

function authRequired(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ detail: "Not authenticated" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type && decoded.type !== "access") {
      return res.status(401).json({ detail: "Invalid access token type" });
    }
    const user = DB.users.find((u) => u.id === decoded.sub);
    if (!user) return res.status(401).json({ detail: "User not found" });
    user.plan = user.plan || "free";
    user.subscription = DB.subscriptions?.[user.id] || user.subscription || null;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: "Invalid or expired token" });
  }
}

/**
 * Multi-tenant IDOR Protection Middleware across ALL /api/projects/:pid* routes.
 * - Owner has full read/write/delete access.
 * - Global sample projects (is_sample === true) allow read-only GET/preview exploration for any signed-in user,
 *   but block non-owner writes/deletes with 403.
 * - Cross-tenant private projects return 404 to prevent ID enumeration.
 */
function requireProjectAccess(req, res, next) {
  const p = DB.projects.find((pr) => pr.id === req.params.pid);
  if (!p) return res.status(404).json({ detail: "Project not found" });

  if (p.user_id === req.user.id) {
    req.project = p;
    return next();
  }

  if (p.is_sample) {
    const isReadOnlyRequest = req.method === "GET" || req.path === "/schema/preview";
    if (isReadOnlyRequest) {
      req.project = p;
      return next();
    }
    return res.status(403).json({
      detail: "Sample blueprint is read-only for guest accounts. Create your own project to edit.",
    });
  }

  return res.status(404).json({ detail: "Project not found" });
}

// ========================
// AUTH ENDPOINTS
// ========================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/login", authLimiter, (req, res) => {
  const rawEmail = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!rawEmail || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  const user = DB.users.find((u) => u.email?.toLowerCase() === rawEmail);
  if (!user || !user.password_hash) {
    return res.status(400).json({ detail: "Incorrect email or password" });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(400).json({ detail: "Incorrect email or password" });

  setAuthCookies(res, user);
  res.json(sanitizeUser(user));
});

app.post("/api/auth/register", authLimiter, (req, res) => {
  const rawEmail = String(req.body?.email || "").trim().toLowerCase();
  const rawName = String(req.body?.name || "").trim();
  const password = req.body?.password;

  if (!rawEmail || !password || !rawName) {
    return res.status(400).json({ detail: "All fields are required" });
  }
  if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
    return res.status(400).json({ detail: "Please enter a valid email address" });
  }
  if (rawName.length < 2 || rawName.length > 120) {
    return res.status(400).json({ detail: "Name must be between 2 and 120 characters" });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return res.status(400).json({ detail: "Password must be at least 8 characters" });
  }

  const existing = DB.users.find((u) => u.email?.toLowerCase() === rawEmail);
  if (existing) {
    return res.status(400).json({ detail: "An account with this email already exists" });
  }

  const now = new Date().toISOString();
  const newUser = {
    id: crypto.randomUUID(),
    email: rawEmail,
    name: rawName,
    picture: null,
    plan: "free",
    subscription: null,
    auth_provider: "password",
    password_hash: bcrypt.hashSync(password, 10),
    created_at: now,
    updated_at: now,
  };

  DB.users.push(newUser);
  saveDb();
  setAuthCookies(res, newUser);
  res.json(sanitizeUser(newUser));
});

app.post("/api/auth/google/session", authLimiter, async (req, res) => {
  const sessionId = String(req.body?.session_id || "").trim();
  if (!sessionId) {
    return res.status(400).json({ detail: "Missing OAuth session_id" });
  }

  const sessionEndpoint =
    process.env.GOOGLE_AUTH_SESSION_URL ||
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data";

  try {
    const upstream = await fetch(sessionEndpoint, {
      method: "GET",
      headers: { "X-Session-ID": sessionId },
      signal: AbortSignal.timeout(6000),
    });

    if (!upstream.ok) {
      return res.status(401).json({ detail: "Google OAuth session expired or invalid" });
    }

    const profile = await upstream.json();
    const email = String(profile?.email || "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(401).json({ detail: "Google profile did not include a verified email" });
    }

    const now = new Date().toISOString();
    let user = DB.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email,
        name: String(profile?.name || email.split("@")[0]).slice(0, 120),
        picture: profile?.picture || null,
        plan: "free",
        subscription: null,
        auth_provider: "google",
        password_hash: null,
        created_at: now,
        updated_at: now,
      };
      DB.users.push(user);
    } else {
      if (profile?.picture && !user.picture) user.picture = profile.picture;
      user.updated_at = now;
    }

    saveDb();
    setAuthCookies(res, user);
    return res.json(sanitizeUser(user));
  } catch (err) {
    console.warn("[OAuth] Google session exchange error:", err.message);
    return res.status(401).json({ detail: "Unable to verify Google sign-in session" });
  }
});

app.get("/api/auth/me", (req, res) => {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ detail: "Not authenticated" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type && decoded.type !== "access") {
      return res.status(401).json({ detail: "Invalid access token" });
    }
    const user = DB.users.find((u) => u.id === decoded.sub);
    if (!user) return res.status(401).json({ detail: "User not found" });
    res.json(sanitizeUser(user));
  } catch {
    return res.status(401).json({ detail: "Session expired" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  revokeRefreshToken(req.cookies?.refresh_token);
  clearAuthCookies(res);
  res.json({ ok: true });
});

app.post("/api/auth/refresh", (req, res) => {
  const refToken = req.cookies?.refresh_token;
  if (!refToken) return res.status(401).json({ detail: "No refresh token" });
  try {
    const decoded = jwt.verify(refToken, JWT_SECRET);
    if (decoded.type !== "refresh") {
      clearAuthCookies(res);
      return res.status(401).json({ detail: "Invalid refresh token type" });
    }
    const stored = consumeRefreshToken(refToken);
    if (!stored || stored.user_id !== decoded.sub) {
      clearAuthCookies(res);
      return res.status(401).json({ detail: "Refresh token expired or revoked" });
    }
    const user = DB.users.find((u) => u.id === decoded.sub);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ detail: "User not found" });
    }
    setAuthCookies(res, user);
    res.json({ ok: true });
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ detail: "Invalid refresh token" });
  }
});

// ========================
// PROJECTS ENDPOINTS
// ========================

app.get("/api/projects", authRequired, (req, res) => {
  const includeArchived = req.query.include_archived === "true";
  const list = DB.projects
    .filter((p) => (p.user_id === req.user.id || p.is_sample) && (includeArchived || p.status !== "archived"))
    .map((p) => {
      const arts = DB.artifacts[p.id] || {};
      const tasks = arts.roadmap?.content?.tasks || [];
      let approved = 0;
      let needsReview = 0;
      for (const v of Object.values(arts)) {
        if (v.artifact?.status === "approved") approved++;
        if (v.artifact?.needs_review) needsReview++;
      }
      return {
        ...p,
        approved,
        artifacts: Object.keys(arts).length || ARTIFACT_KINDS.length,
        needs_review: needsReview,
        tasks_total: tasks.length,
        tasks_done: tasks.filter((t) => t.status === "completed").length,
      };
    });
  res.json(list);
});

app.post("/api/projects", authRequired, async (req, res) => {
  const { name, description, answers, idea_prompt, llm_config } = req.body || {};
  if (!name && !idea_prompt) {
    return res.status(400).json({ detail: "Project name or idea description is required" });
  }

  // SaaS Multi-tenant Tier Quota Enforcement
  const userPlan = req.user?.plan || "free";
  const planConfig = PLANS[userPlan] || PLANS.free;
  const maxProjects = planConfig.limits.max_active_projects;

  const activeProjects = DB.projects.filter(
    (p) => p.user_id === req.user.id && p.status !== "archived" && !p.is_sample
  );

  if (activeProjects.length >= maxProjects) {
    return res.status(403).json({
      code: "TIER_LIMIT_REACHED",
      detail: `Your ${planConfig.name} plan is limited to ${maxProjects} active blueprint${maxProjects === 1 ? "" : "s"}. Upgrade to Pro for unlimited projects, team collaboration, and automated exports.`,
      current: activeProjects.length,
      limit: maxProjects,
      plan: userPlan,
    });
  }

  const pid = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialName = String(name || "").trim().slice(0, 180) || "New Project";
  const initialDesc =
    String(description || "").trim().slice(0, 500) ||
    (idea_prompt ? String(idea_prompt).trim().slice(0, 240) : "New software blueprint");

  const newProject = {
    id: pid,
    user_id: req.user.id,
    name: initialName,
    description: initialDesc,
    status: "active",
    is_sample: false,
    archived_at: null,
    created_at: now,
    updated_at: now,
    approved: 0,
    artifacts: ARTIFACT_KINDS.length,
    needs_review: 0,
    tasks_total: 3,
    tasks_done: 0,
    brief_status: "draft",
    task_counts: { ready: 3, in_progress: 0, completed: 0, blocked: 0 },
    flagged: { endpoints: [], tasks: [] },
    ai_usage: { jobs: 0, chars: 0 },
  };

  const { artifacts, versions } = createEmptyArtifacts(pid, initialName, initialDesc, answers);

  DB.projects.unshift(newProject);
  DB.artifacts[pid] = artifacts;
  DB.artifact_versions[pid] = versions;
  DB.decisions[pid] = [
    {
      id: `dec-${Date.now()}`,
      category: "approval",
      title: "Project created",
      decision: `Project initialized with modular panels.`,
      reasoning: idea_prompt ? "Created from Idea Chat prompt" : "Created via wizard",
      created_at: now,
    },
  ];
  DB.ai_jobs[pid] = [];
  DB.chats[pid] = [];
  DB.module_docs[pid] = {};

  // If created directly from an Idea Prompt, decompose and place into every panel immediately!
  if (idea_prompt?.trim()) {
    const plan = await runArchitectChat({
      message: idea_prompt.trim(),
      project: newProject,
      existingArtifacts: artifacts,
      isFreshProject: true,
      llmConfig: llm_config || null,
    });

    if (!name?.trim() && plan.project_name) {
      newProject.name = plan.project_name;
      if (plan.updates.brief) plan.updates.brief.name = plan.project_name;
    } else if (name?.trim() && plan.updates.brief) {
      plan.updates.brief.name = name.trim();
    }

    const { versions: vMap } = applyUpdatesToProject(pid, plan.updates, {
      summaryNote: `AI Idea Decomposition: "${idea_prompt.trim().slice(0, 80)}"`,
      projectName: name?.trim() || plan.project_name,
    });

    const placements = plan.placements.map((pl) => ({
      ...pl,
      applied: true,
      version: vMap[pl.kind] || 1,
    }));

    DB.chats[pid].push(
      {
        id: `msg-${Date.now()}-u`,
        role: "user",
        content: idea_prompt.trim(),
        targets: ["auto"],
        created_at: now,
      },
      {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: plan.reply,
        engine: plan.engine,
        mode: plan.mode,
        applied: true,
        placements,
        created_at: new Date().toISOString(),
      }
    );
  }

  saveDb();
  res.json(newProject);
});

// Mount centralized IDOR & tenant ownership guard across ALL /api/projects/:pid* routes
app.use("/api/projects/:pid", authRequired, requireProjectAccess);

app.get("/api/projects/:pid", (req, res) => {
  const p = req.project;

  const arts = DB.artifacts[p.id] || {};
  const artifactSummaries = {};
  let approvedCount = 0;
  let reviewCount = 0;

  for (const [k, v] of Object.entries(arts)) {
    artifactSummaries[k] = {
      kind: k,
      status: v.artifact?.status || "draft",
      needs_review: !!v.artifact?.needs_review,
      review_reason: v.artifact?.review_reason || null,
      current_version: v.artifact?.current_version || 1,
      approved_version: v.artifact?.approved_version || null,
      updated_at: v.artifact?.updated_at || p.updated_at,
    };
    if (v.artifact?.status === "approved") approvedCount++;
    if (v.artifact?.needs_review) reviewCount++;
  }

  const tasks = arts.roadmap?.content?.tasks || [];
  const endpoints = arts.api?.content?.endpoints || [];
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  const flaggedEndpoints = endpoints
    .filter((e) => e.needs_review)
    .map((e) => ({ id: e.id, label: `${e.method} ${e.path}`, reason: e.review_reason || "Upstream changed" }));
  const flaggedTasks = tasks
    .filter((t) => t.needs_review)
    .map((t) => ({ id: t.id, title: t.title, reason: t.review_reason || "Upstream changed" }));

  const result = {
    ...p,
    artifacts: artifactSummaries,
    approved: approvedCount,
    needs_review: reviewCount,
    tasks_total: tasks.length,
    tasks_done: completedTasks,
    flagged: {
      endpoints: flaggedEndpoints,
      tasks: flaggedTasks,
    },
    ai_usage: p.ai_usage || { jobs: 0, chars: 0 },
    task_counts: {
      completed: completedTasks,
      review: tasks.filter((t) => t.status === "review").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
      ready: tasks.filter((t) => t.status === "ready" || !t.status).length,
    },
  };

  res.json(result);
});

app.patch("/api/projects/:pid", (req, res) => {
  const p = req.project;

  if (typeof req.body?.name === "string" && req.body.name.trim()) {
    p.name = req.body.name.trim().slice(0, 180);
  }
  if (typeof req.body?.description === "string") {
    p.description = req.body.description.slice(0, 1000);
  }
  if (req.body?.status === "active" || req.body?.status === "archived") {
    p.status = req.body.status;
    p.archived_at = req.body.status === "archived" ? new Date().toISOString() : null;
  }
  p.updated_at = new Date().toISOString();

  saveDb();
  res.json(p);
});

app.delete("/api/projects/:pid", (req, res) => {
  DB.projects = DB.projects.filter((pr) => pr.id !== req.params.pid);
  delete DB.artifacts[req.params.pid];
  delete DB.artifact_versions[req.params.pid];
  delete DB.decisions[req.params.pid];
  delete DB.ai_jobs[req.params.pid];
  delete DB.chats[req.params.pid];
  delete DB.module_docs[req.params.pid];
  saveDb();
  res.json({ ok: true });
});

// ========================
// AI ARCHITECT CHAT PANEL ENDPOINTS
// ========================

app.get("/api/projects/:pid/chat", (req, res) => {
  const list = DB.chats[req.params.pid] || [];
  res.json({
    messages: list,
    has_env_llm: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
  });
});

app.post("/api/projects/:pid/chat", async (req, res) => {
  const p = req.project;

  const { message, targets = null, auto_apply = true, llm_config = null } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ detail: "Please describe your idea or module update." });
  }

  const arts = DB.artifacts[req.params.pid] || {};
  const existingChats = DB.chats[req.params.pid] || [];
  const isFresh =
    existingChats.length === 0 &&
    !p.is_sample &&
    Object.values(arts).every((a) => (a.artifact?.current_version || 1) <= 1 && a.artifact?.status !== "approved");

  const userMsg = {
    id: `msg-${Date.now()}-u`,
    role: "user",
    content: String(message).trim(),
    targets: targets || ["auto"],
    created_at: new Date().toISOString(),
  };

  const plan = await runArchitectChat({
    message: userMsg.content,
    project: p,
    existingArtifacts: arts,
    explicitTargets: targets,
    isFreshProject: isFresh,
    llmConfig: llm_config,
  });

  let updatedKinds = [];
  let appliedVersions = {};

  if (auto_apply) {
    const applied = applyUpdatesToProject(req.params.pid, plan.updates, {
      summaryNote: `AI Chat: "${userMsg.content.slice(0, 90)}"`,
      projectName: plan.project_name,
    });
    updatedKinds = applied.updatedKinds;
    appliedVersions = applied.versions;
  }

  const placements = plan.placements.map((pl) => ({
    ...pl,
    applied: Boolean(auto_apply),
    version: appliedVersions[pl.kind] || arts[pl.kind]?.artifact?.current_version || 1,
  }));

  const assistantMsg = {
    id: `msg-${Date.now()}-a`,
    role: "assistant",
    content: plan.reply,
    engine: plan.engine,
    mode: plan.mode,
    applied: Boolean(auto_apply),
    placements,
    pending_updates: auto_apply ? undefined : plan.updates,
    pending_project_name: auto_apply ? undefined : plan.project_name,
    created_at: new Date().toISOString(),
  };

  if (!DB.chats[req.params.pid]) DB.chats[req.params.pid] = [];
  DB.chats[req.params.pid].push(userMsg, assistantMsg);
  saveDb();

  res.json({
    user_message: userMsg,
    assistant_message: assistantMsg,
    updated_kinds: updatedKinds,
    project_name: p.name,
  });
});

app.post("/api/projects/:pid/chat/:msgId/apply", (req, res) => {
  const list = DB.chats[req.params.pid] || [];
  const msg = list.find((m) => m.id === req.params.msgId);
  if (!msg || !msg.pending_updates) {
    return res.status(404).json({ detail: "Pending placement not found or already placed" });
  }

  const singleKind = req.body?.kind || null;
  const kindsFilter = singleKind ? [singleKind] : null;

  const { updatedKinds, versions } = applyUpdatesToProject(req.params.pid, msg.pending_updates, {
    summaryNote: "Placed reviewed AI Chat proposal",
    projectName: msg.pending_project_name,
    kindsFilter,
  });

  msg.placements = (msg.placements || []).map((pl) => {
    if (!singleKind || pl.kind === singleKind) {
      return { ...pl, applied: true, version: versions[pl.kind] || pl.version };
    }
    return pl;
  });

  if (singleKind) {
    delete msg.pending_updates[singleKind];
  }
  const remaining = singleKind ? Object.keys(msg.pending_updates || {}).length : 0;
  if (!remaining) {
    msg.applied = true;
    delete msg.pending_updates;
    delete msg.pending_project_name;
  }

  saveDb();
  res.json({
    ok: true,
    message: msg,
    updated_kinds: updatedKinds,
  });
});

app.delete("/api/projects/:pid/chat", (req, res) => {
  DB.chats[req.params.pid] = [];
  saveDb();
  res.json({ ok: true });
});

// ========================
// SEPARATE MODULE MARKDOWN DOCS ENDPOINTS
// ========================

app.get("/api/projects/:pid/docs", (req, res) => {
  const p = req.project;
  const arts = DB.artifacts[req.params.pid] || {};
  const decs = DB.decisions[req.params.pid] || [];
  const customDocs = DB.module_docs[req.params.pid] || {};
  const modules = generateModuleMarkdowns(p, arts, decs, customDocs);
  res.json({ modules });
});

app.put("/api/projects/:pid/docs/:docKind", (req, res) => {
  const p = req.project;
  if (!DB.module_docs[req.params.pid]) DB.module_docs[req.params.pid] = {};
  DB.module_docs[req.params.pid][req.params.docKind] = {
    notes: String(req.body?.notes ?? ""),
    updated_at: new Date().toISOString(),
  };
  saveDb();
  const arts = DB.artifacts[req.params.pid] || {};
  const decs = DB.decisions[req.params.pid] || [];
  const modules = generateModuleMarkdowns(p, arts, decs, DB.module_docs[req.params.pid]);
  res.json({ ok: true, modules });
});

app.get("/api/projects/:pid/export/markdown/:docKind", (req, res) => {
  const p = req.project;
  const arts = DB.artifacts[req.params.pid] || {};
  const decs = DB.decisions[req.params.pid] || [];
  const customDocs = DB.module_docs[req.params.pid] || {};
  const modules = generateModuleMarkdowns(p, arts, decs, customDocs);
  const found = modules.find((m) => m.kind === req.params.docKind || m.filename === req.params.docKind);
  if (!found) return res.status(404).json({ detail: "Module markdown not found" });
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(found.markdown);
});

// ========================
// ARTIFACTS ENDPOINTS
// ========================

app.get("/api/projects/:pid/artifacts/:kind", (req, res) => {
  const arts = DB.artifacts[req.params.pid];
  if (!arts) return res.status(404).json({ detail: "Project artifacts not found" });
  const art = arts[req.params.kind];
  if (!art) return res.status(404).json({ detail: "Artifact not found" });
  res.json(art);
});

app.put("/api/projects/:pid/artifacts/:kind", (req, res) => {
  const { content, summary, version = true } = req.body || {};
  const arts = DB.artifacts[req.params.pid];
  if (!arts || !arts[req.params.kind]) {
    return res.status(404).json({ detail: "Artifact not found" });
  }

  const artObj = arts[req.params.kind];
  artObj.content = content;
  artObj.artifact.status = artObj.artifact.approved_version ? "changed" : "draft";
  artObj.artifact.needs_review = false;
  artObj.artifact.review_reason = null;
  artObj.artifact.updated_at = new Date().toISOString();

  if (version) {
    artObj.artifact.current_version = (artObj.artifact.current_version || 1) + 1;
    if (!DB.artifact_versions[req.params.pid]) DB.artifact_versions[req.params.pid] = {};
    if (!DB.artifact_versions[req.params.pid][req.params.kind]) DB.artifact_versions[req.params.pid][req.params.kind] = [];

    DB.artifact_versions[req.params.pid][req.params.kind].unshift({
      version_number: artObj.artifact.current_version,
      content,
      summary: summary || `Saved version ${artObj.artifact.current_version}`,
      created_at: new Date().toISOString(),
    });
  }

  // Cross-artifact impact analysis (Phase 1 + Phase 2 downstream cascade)
  const impact = { artifacts: [], endpoints: 0, tasks: 0 };
  const flagDownstream = (...kinds) => {
    for (const k of kinds) {
      if (arts[k] && k !== req.params.kind) {
        impact.artifacts.push(k);
        arts[k].artifact.needs_review = true;
        arts[k].artifact.review_reason = `Upstream ${req.params.kind} changed (v${artObj.artifact.current_version})`;
      }
    }
  };
  if (req.params.kind === "brief") {
    flagDownstream("spec", "architecture", "deployment");
  } else if (req.params.kind === "spec") {
    flagDownstream("features", "flows");
  } else if (req.params.kind === "features") {
    flagDownstream("flows", "ui", "testing");
  } else if (req.params.kind === "architecture") {
    flagDownstream("security", "deployment");
  } else if (req.params.kind === "schema") {
    impact.endpoints = arts.api?.content?.endpoints?.length || 0;
    flagDownstream("api", "security", "testing", "deployment");
  } else if (req.params.kind === "api") {
    flagDownstream("security", "testing");
  } else if (req.params.kind === "security") {
    flagDownstream("deployment");
  } else if (req.params.kind === "flows") {
    flagDownstream("ui", "testing");
  }

  saveDb();
  res.json({ artifact: artObj.artifact, content: artObj.content, impact });
});

app.post("/api/projects/:pid/artifacts/:kind/approve", (req, res) => {
  const arts = DB.artifacts[req.params.pid];
  const artObj = arts?.[req.params.kind];
  if (!artObj) return res.status(404).json({ detail: "Artifact not found" });

  artObj.artifact.status = "approved";
  artObj.artifact.needs_review = false;
  artObj.artifact.review_reason = null;
  artObj.artifact.approved_version = artObj.artifact.current_version;
  artObj.artifact.approved_at = new Date().toISOString();
  artObj.approved_content = JSON.parse(JSON.stringify(artObj.content));

  if (!DB.decisions[req.params.pid]) DB.decisions[req.params.pid] = [];
  DB.decisions[req.params.pid].unshift({
    id: `dec-${Date.now()}`,
    category: "approval",
    title: `Approved: ${req.params.kind.toUpperCase()}`,
    decision: req.body?.note || `Approved version ${artObj.artifact.current_version} of ${req.params.kind}.`,
    reasoning: "User manual sign-off",
    artifact_kind: req.params.kind,
    created_at: new Date().toISOString(),
  });

  saveDb();
  res.json({ ok: true, artifact: artObj.artifact });
});

app.post("/api/projects/:pid/artifacts/:kind/resolve-review", (req, res) => {
  const arts = DB.artifacts[req.params.pid];
  const artObj = arts?.[req.params.kind];
  if (artObj) {
    artObj.artifact.needs_review = false;
    artObj.artifact.review_reason = null;
    saveDb();
  }
  res.json({ ok: true });
});

app.get("/api/projects/:pid/artifacts/:kind/versions", (req, res) => {
  const list = DB.artifact_versions[req.params.pid]?.[req.params.kind] || [];
  res.json(list);
});

app.post("/api/projects/:pid/artifacts/:kind/versions/:v/restore", (req, res) => {
  const vNum = parseInt(req.params.v, 10);
  const list = DB.artifact_versions[req.params.pid]?.[req.params.kind] || [];
  const target = list.find((item) => item.version_number === vNum);
  if (!target) return res.status(404).json({ detail: "Version not found" });

  const artObj = DB.artifacts[req.params.pid][req.params.kind];
  artObj.content = JSON.parse(JSON.stringify(target.content));
  artObj.artifact.current_version = (artObj.artifact.current_version || 1) + 1;

  list.unshift({
    version_number: artObj.artifact.current_version,
    content: artObj.content,
    summary: `Restored from v${vNum}`,
    created_at: new Date().toISOString(),
  });

  saveDb();
  res.json({ content: artObj.content, artifact: artObj.artifact });
});

app.post("/api/projects/:pid/items/resolve-review", (req, res) => {
  const { type, id } = req.body || {};
  const arts = DB.artifacts[req.params.pid];
  if (arts && type === "endpoint") {
    const ep = arts.api?.content?.endpoints?.find((x) => x.id === id);
    if (ep) {
      ep.needs_review = false;
      ep.review_reason = null;
    }
  } else if (arts && type === "task") {
    const t = arts.roadmap?.content?.tasks?.find((x) => x.id === id);
    if (t) {
      t.needs_review = false;
      t.review_reason = null;
    }
  } else if (arts && type === "feature") {
    const f = arts.features?.content?.features?.find((x) => x.id === id);
    if (f) {
      f.needs_review = false;
      f.review_reason = null;
    }
  } else if (arts && type === "test_case") {
    const tc = arts.testing?.content?.cases?.find((x) => x.id === id);
    if (tc) {
      tc.needs_review = false;
      tc.review_reason = null;
    }
  }
  saveDb();
  res.json({ ok: true });
});

// ========================
// DECISIONS (ADRs)
// ========================

app.get("/api/projects/:pid/decisions", (req, res) => {
  const list = DB.decisions[req.params.pid] || [];
  res.json(list);
});

app.post("/api/projects/:pid/decisions", (req, res) => {
  const { title, category, decision, reasoning } = req.body || {};
  if (!title || !decision) return res.status(400).json({ detail: "Title and decision are required" });

  const newDec = {
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: String(title).slice(0, 240),
    category: String(category || "architecture").slice(0, 50),
    decision: String(decision),
    reasoning: String(reasoning || ""),
    artifact_kind: null,
    created_at: new Date().toISOString(),
  };

  if (!DB.decisions[req.params.pid]) DB.decisions[req.params.pid] = [];
  DB.decisions[req.params.pid].unshift(newDec);
  saveDb();
  res.json(newDec);
});

// ========================
// TASKS (ROADMAP)
// ========================

const ALLOWED_TASK_FIELDS = [
  "title",
  "deliverable",
  "status",
  "complexity",
  "milestone",
  "files",
  "acceptance_criteria",
  "depends_on",
  "needs_review",
  "review_reason",
  "notes",
];
const VALID_TASK_STATUSES = new Set(["ready", "in_progress", "review", "completed", "blocked"]);

app.patch("/api/projects/:pid/tasks/:taskId", (req, res) => {
  const arts = DB.artifacts[req.params.pid];
  const roadmap = arts?.roadmap?.content?.tasks || [];
  const task = roadmap.find((t) => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ detail: "Task not found" });

  const patch = req.body || {};
  for (const key of ALLOWED_TASK_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      if (key === "status" && !VALID_TASK_STATUSES.has(patch.status)) {
        return res.status(400).json({ detail: "Invalid task status" });
      }
      task[key] = patch[key];
    }
  }

  saveDb();
  res.json(task);
});

// ========================
// SCHEMA DDL & EXPORTS
// ========================

app.post("/api/projects/:pid/schema/preview", (req, res) => {
  const schema = req.body?.content || {};
  const sql = generateSql(schema);
  const prisma = generatePrisma(schema);
  const issues = validateSchema(schema);
  res.json({ sql, prisma, issues });
});

app.get("/api/projects/:pid/schema/code", (req, res) => {
  const arts = DB.artifacts[req.params.pid];
  const schema = arts?.schema?.content || {};
  const sql = generateSql(schema);
  const prisma = generatePrisma(schema);
  const issues = validateSchema(schema);
  res.json({ sql, prisma, issues });
});

app.get("/api/projects/:pid/export/markdown", (req, res) => {
  const p = req.project;
  const arts = DB.artifacts[req.params.pid] || {};
  const decs = DB.decisions[req.params.pid] || [];
  const customDocs = DB.module_docs[req.params.pid] || {};
  const md = generateBlueprintMarkdown(p, arts, decs, customDocs);
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.send(md);
});

// ========================
// AI WORKFLOWS & JOBS (Single-Artifact Diff Review)
// ========================

const WORKFLOWS = [
  { id: "spec", label: "Create product specification", target: "spec", requires: ["brief"] },
  { id: "scope_review", label: "Review feature scope", target: "features", requires: ["spec"] },
  { id: "flows", label: "Generate user flows & branches", target: "flows", requires: ["spec", "features"] },
  { id: "ui", label: "Generate UI/UX wireframes & tokens", target: "ui", requires: ["features", "flows"] },
  { id: "architecture", label: "Propose architecture", target: "architecture", requires: ["spec"] },
  { id: "schema", label: "Generate database schema", target: "schema", requires: ["spec", "features"] },
  { id: "api", label: "Generate API contracts", target: "api", requires: ["features", "schema"] },
  { id: "security", label: "Run security controls & risk review", target: "security", requires: ["architecture", "api"] },
  { id: "tasks", label: "Create implementation tasks", target: "roadmap", requires: ["spec", "features"] },
  { id: "testing", label: "Generate unit, integration & E2E test plan", target: "testing", requires: ["features", "api"] },
  { id: "deployment", label: "Generate deployment guide, env catalog & CI/CD", target: "deployment", requires: ["architecture", "security"] },
];

app.get("/api/ai/workflows", authRequired, (req, res) => {
  res.json(WORKFLOWS);
});

app.get("/api/projects/:pid/ai/jobs", (req, res) => {
  const jobs = DB.ai_jobs[req.params.pid] || [];
  res.json(jobs);
});

app.get("/api/projects/:pid/ai/jobs/:id", (req, res) => {
  const jobs = DB.ai_jobs[req.params.pid] || [];
  const j = jobs.find((job) => job.id === req.params.id);
  if (!j) return res.status(404).json({ detail: "Job not found" });
  res.json(j);
});

app.post("/api/projects/:pid/ai/:workflow", async (req, res) => {
  const wf = WORKFLOWS.find((w) => w.id === req.params.workflow);
  if (!wf) return res.status(404).json({ detail: "Workflow not found" });

  const start = Date.now();
  const p = req.project;
  const arts = DB.artifacts[req.params.pid] || {};
  const instructions = String(req.body?.instructions || "");
  const prompt = instructions.trim() || `${wf.label} for ${p?.name || "this project"}: ${p?.description || ""}`;

  const plan = await runArchitectChat({
    message: prompt,
    project: p,
    existingArtifacts: arts,
    explicitTargets: [wf.target],
    isFreshProject: false,
  });

  const proposedOutput = plan.updates[wf.target] || arts[wf.target]?.content || {};
  const outStr = JSON.stringify(proposedOutput);

  const job = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    workflow: wf.id,
    workflow_id: wf.id,
    target_kind: wf.target,
    status: "proposed",
    instructions,
    output: proposedOutput,
    notes: plan.reply,
    input_chars: prompt.length + 600,
    output_chars: outStr.length,
    duration_ms: Math.max(400, Date.now() - start),
    created_at: new Date().toISOString(),
  };

  if (!DB.ai_jobs[req.params.pid]) DB.ai_jobs[req.params.pid] = [];
  DB.ai_jobs[req.params.pid].unshift(job);
  saveDb();

  res.json(job);
});

app.post("/api/projects/:pid/ai/jobs/:id/accept", (req, res) => {
  const jobs = DB.ai_jobs[req.params.pid] || [];
  const j = jobs.find((job) => job.id === req.params.id);
  if (!j) return res.status(404).json({ detail: "Job not found" });

  const contentToApply = req.body?.content || j.output;
  const arts = DB.artifacts[req.params.pid];
  const artObj = arts?.[j.target_kind];
  if (!artObj) return res.status(404).json({ detail: "Target artifact not found" });

  artObj.content = contentToApply;
  artObj.artifact.current_version = (artObj.artifact.current_version || 1) + 1;
  artObj.artifact.status = artObj.artifact.approved_version ? "changed" : "draft";

  j.status = "applied";

  if (!DB.decisions[req.params.pid]) DB.decisions[req.params.pid] = [];
  DB.decisions[req.params.pid].unshift({
    id: `dec-${Date.now()}`,
    category: "ai",
    title: `Accepted AI proposal: ${j.workflow_id}`,
    decision: j.notes || `Applied AI generated proposal to ${j.target_kind}`,
    reasoning: j.instructions || "Accepted by user",
    artifact_kind: j.target_kind,
    created_at: new Date().toISOString(),
  });

  saveDb();
  res.json({ ok: true, artifact: artObj.artifact, impact: { artifacts: [j.target_kind] } });
});

app.post("/api/projects/:pid/ai/jobs/:id/discard", (req, res) => {
  const jobs = DB.ai_jobs[req.params.pid] || [];
  const j = jobs.find((job) => job.id === req.params.id);
  if (j) {
    j.status = "discarded";
    saveDb();
  }
  res.json({ ok: true });
});

// ========================
// BILLING & SAAS ENDPOINTS
// ========================

app.get("/api/billing/plans", (req, res) => {
  res.json({
    plans: PLANS,
    active_provider: process.env.LEMONSQUEEZY_API_KEY ? "lemonsqueezy" : "simulation",
  });
});

app.get("/api/billing/subscription", authRequired, (req, res) => {
  const userPlan = req.user.plan || "free";
  const planConfig = PLANS[userPlan] || PLANS.free;
  const activeProjects = DB.projects.filter(
    (p) => p.user_id === req.user.id && p.status !== "archived" && !p.is_sample
  );
  const userTransactions = (DB.transactions || []).filter((tx) => tx.user_id === req.user.id);

  res.json({
    plan: userPlan,
    plan_name: planConfig.name,
    subscription: req.user.subscription || null,
    usage: {
      active_projects: activeProjects.length,
      max_projects: planConfig.limits.max_active_projects,
    },
    limits: planConfig.limits,
    transactions: userTransactions,
    simulation_mode: !process.env.LEMONSQUEEZY_API_KEY,
  });
});

app.post("/api/billing/checkout", authRequired, checkoutLimiter, async (req, res) => {
  try {
    const { plan, interval, redirect_url } = req.body || {};
    const session = await createCheckoutSession({
      user: req.user,
      planId: plan || "pro",
      interval: interval || "monthly",
      redirectUrl: redirect_url,
    });
    res.json(session);
  } catch (err) {
    res.status(400).json({ detail: err.message || "Failed to create checkout session" });
  }
});

app.post("/api/billing/webhook/lemonsqueezy", async (req, res) => {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers["x-signature"];

  if (IS_PROD && !secret) {
    console.error("[Webhook] LEMONSQUEEZY_WEBHOOK_SECRET is missing in production.");
    return res.status(503).json({ error: "Webhook verification secret not configured" });
  }

  if (secret) {
    const raw = req.rawBody || JSON.stringify(req.body);
    const isValid = verifyLemonSqueezySignature(raw, signature, secret);
    if (!isValid) {
      console.warn("[Webhook] Invalid Lemon Squeezy webhook signature rejected");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
  }

  try {
    const result = handleLemonSqueezyWebhookEvent(DB, req.body, saveDb);
    res.json({ received: true, ...result });
  } catch (err) {
    console.error("Error processing Lemon Squeezy webhook:", err);
    res.status(500).json({ error: "Internal webhook processing error" });
  }
});

app.post("/api/billing/dev-simulate-webhook", authRequired, (req, res) => {
  if (IS_PROD) {
    return res.status(403).json({ detail: "Webhook simulator is disabled in production" });
  }

  const { event_name = "subscription_created", plan = "pro", interval = "monthly" } = req.body || {};
  const mockPayload = {
    meta: {
      event_name,
      event_id: `sim_evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      custom_data: {
        user_id: req.user.id,
        plan,
        interval,
      },
    },
    data: {
      id: `sim_sub_${Date.now()}`,
      attributes: {
        customer_id: `sim_cust_${req.user.id}`,
        user_email: req.user.email,
        status: event_name === "subscription_cancelled" ? "cancelled" : "active",
        total: interval === "yearly" ? 19000 : 1900,
        currency: "USD",
        renews_at: new Date(Date.now() + (interval === "yearly" ? 365 : 30) * 86400000).toISOString(),
      },
    },
  };

  const result = handleLemonSqueezyWebhookEvent(DB, mockPayload, saveDb);
  res.json({ success: true, simulated_event: event_name, result });
});

app.get("/api/billing/portal", authRequired, (req, res) => {
  if (req.user.subscription?.customer_id && process.env.LEMONSQUEEZY_API_KEY) {
    return res.json({ portal_url: "https://app.lemonsqueezy.com/my-orders" });
  }
  res.json({ portal_url: "/billing", message: "Manage subscriptions on Formora billing dashboard" });
});

app.get("/api/health", (req, res) => {
  const database = getDatabaseHealth();
  res.json({
    ok: database.ok,
    env: IS_PROD ? "production" : "development",
    database,
  });
});

// --- Production Static SPA Bundle Serving ---
const DIST_DIR = path.resolve(__dirname, "..", "dist");
if (IS_PROD && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(DIST_DIR, "index.html"));
    }
    next();
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Formora API Server listening on http://localhost:${PORT} [${IS_PROD ? "production" : "development"}]`);
});
