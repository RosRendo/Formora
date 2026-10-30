// Phase 3 Blueprint Module Architect & Normalizer for Formora
// Powers: Deployment Center (deployment) — Readiness gates, Environment Variable Catalog, Runbook, Rollback & CI/CD

import crypto from "crypto";

const uid = () => crypto.randomUUID();

export function buildDeploymentPlan({
  projectName = "Workspace",
  brief = {},
  architecture = {},
  schema = {},
  endpoints = [],
  security = {},
  testing = {},
}) {
  const hosting = brief?.hosting || "Vercel + Managed PostgreSQL";
  const database = brief?.database || "PostgreSQL";
  const auth = brief?.auth || "JWT HttpOnly Session";
  const payments = brief?.payments || "Not in MVP";
  const hasPayments = payments && !/not in mvp|none|free only/i.test(payments);
  const archNodes = architecture?.nodes || [];
  const hasRedis = archNodes.some((n) => n.type === "cache" || n.type === "worker" || /redis|bullmq|upstash/i.test(n.technology || ""));
  const hasStorage = archNodes.some((n) => n.type === "storage" || /s3|r2|supabase storage|cloudinary/i.test(n.technology || ""));
  const hasMonitoring = archNodes.some((n) => n.type === "monitoring" || /sentry|datadog|posthog|axiom/i.test(n.technology || ""));
  const slug = String(projectName || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "app";

  // 1. Environment Variable Catalog tailored to actual stack & architecture nodes
  const env_vars = [
    {
      id: uid(),
      key: "NODE_ENV",
      scope: "server",
      required: true,
      secret: false,
      example: "production",
      description: "Enables production cookie flags (Secure), HSTS headers, and static asset caching.",
    },
    {
      id: uid(),
      key: "PORT",
      scope: "server",
      required: true,
      secret: false,
      example: "3001",
      description: "HTTP port bound by the API and SPA server container.",
    },
    {
      id: uid(),
      key: "APP_URL",
      scope: "server",
      required: true,
      secret: false,
      example: `https://${slug}.app`,
      description: "Canonical public origin used for CORS allowlisting, OAuth callbacks, and billing redirects.",
    },
    {
      id: uid(),
      key: "CORS_ORIGIN",
      scope: "server",
      required: true,
      secret: false,
      example: `https://${slug}.app`,
      description: "Comma-separated allowlist of trusted browser origins permitted to send credentialed requests.",
    },
    {
      id: uid(),
      key: /sqlite/i.test(database) ? "DATABASE_PATH" : "DATABASE_URL",
      scope: "server",
      required: true,
      secret: !/sqlite/i.test(database),
      example: /sqlite/i.test(database)
        ? "/data/app.sqlite"
        : `postgresql://app_user:STRONG_PASSWORD@db.${slug}.internal:5432/${slug.replace(/-/g, "_")}_prod?sslmode=require`,
      description: `Primary ${database} connection string with TLS/WAL persistence enabled.`,
    },
    {
      id: uid(),
      key: "JWT_SECRET",
      scope: "server",
      required: true,
      secret: true,
      example: "generate-with-openssl-rand-hex-32-minimum-64-chars",
      description: `Cryptographic signing key (>= 32 chars) for ${auth} access & rotated refresh tokens.`,
    },
  ];

  if (hasPayments) {
    const isLemon = /lemon/i.test(payments);
    const isPayway = /payway|khqr|aba/i.test(payments);
    if (isLemon) {
      env_vars.push(
        {
          id: uid(),
          key: "LEMONSQUEEZY_API_KEY",
          scope: "server",
          required: true,
          secret: true,
          example: "eyJ0eXAiOiJKV1QiLCJhbGci...",
          description: "Live Lemon Squeezy API key for creating hosted checkout sessions.",
        },
        {
          id: uid(),
          key: "LEMONSQUEEZY_WEBHOOK_SECRET",
          scope: "server",
          required: true,
          secret: true,
          example: "whsec_live_random_hmac_secret",
          description: "HMAC-SHA256 signing secret verifying X-Signature on /api/billing/webhook/lemonsqueezy.",
        }
      );
    } else if (isPayway) {
      env_vars.push(
        {
          id: uid(),
          key: "ABA_PAYWAY_MERCHANT_ID",
          scope: "server",
          required: true,
          secret: false,
          example: "ec402910",
          description: "Production ABA PayWay Merchant identifier for KHQR checkout.",
        },
        {
          id: uid(),
          key: "ABA_PAYWAY_API_KEY",
          scope: "server",
          required: true,
          secret: true,
          example: "aba_live_rsa_or_hmac_key",
          description: "Cryptographic key for signing PayWay requests and verifying pushback webhooks.",
        }
      );
    } else {
      env_vars.push(
        {
          id: uid(),
          key: "STRIPE_SECRET_KEY",
          scope: "server",
          required: true,
          secret: true,
          example: "sk_live_51P...",
          description: `Live ${payments} API secret key for checkout and subscription management.`,
        },
        {
          id: uid(),
          key: "STRIPE_WEBHOOK_SECRET",
          scope: "server",
          required: true,
          secret: true,
          example: "whsec_live_...",
          description: "Webhook signing secret verifying raw-body Stripe-Signature headers.",
        }
      );
    }
  }

  if (hasRedis) {
    env_vars.push({
      id: uid(),
      key: "REDIS_URL",
      scope: "server",
      required: true,
      secret: true,
      example: "rediss://default:TOKEN@global-cache.upstash.io:6379",
      description: "TLS Redis connection string for rate-limit buckets, caching, and background job queues.",
    });
  }

  if (hasStorage) {
    env_vars.push(
      {
        id: uid(),
        key: "STORAGE_BUCKET_NAME",
        scope: "server",
        required: true,
        secret: false,
        example: `${slug}-prod-uploads`,
        description: "Private object storage bucket for user uploads and generated exports.",
      },
      {
        id: uid(),
        key: "STORAGE_ACCESS_KEY_SECRET",
        scope: "server",
        required: true,
        secret: true,
        example: "r2_or_s3_secret_access_key",
        description: "Scoped IAM / R2 secret key restricted to bucket read/write operations.",
      }
    );
  }

  if (hasMonitoring) {
    env_vars.push({
      id: uid(),
      key: "SENTRY_DSN",
      scope: "server",
      required: false,
      secret: false,
      example: "https://public@o0.ingest.sentry.io/0",
      description: "Production error & P95 latency telemetry DSN.",
    });
  }

  // 2. Target Environments
  const environments = [
    {
      id: uid(),
      name: "Staging / Preview",
      branch: "staging",
      url: `https://staging.${slug}.app`,
      compute: hosting,
      database_tier: `${database} (Isolated staging instance)`,
      auto_deploy: true,
      healthcheck_path: "/api/health",
    },
    {
      id: uid(),
      name: "Production",
      branch: "main",
      url: `https://${slug}.app`,
      compute: hosting,
      database_tier: `${database} (Daily backups + PITR / WAL)`,
      auto_deploy: false,
      healthcheck_path: "/api/health",
    },
  ];

  // 3. Pre-Flight Readiness Checklist Gates
  const checklist = [
    {
      id: uid(),
      category: "Build & Bundle",
      title: "Zero-error production frontend & server build (`npm run build`)",
      required: true,
      checked: true,
      notes: "Verify Vite asset bundle compiles cleanly and static SPA fallback serves index.html.",
    },
    {
      id: uid(),
      category: "Database & Migrations",
      title: `Apply ${database} schema migrations (${(schema?.entities || []).length || 2} tables) & verify foreign keys`,
      required: true,
      checked: false,
      notes: "Run migration against staging first, confirm indexes on all *_id foreign keys.",
    },
    {
      id: uid(),
      category: "Secrets & Auth",
      title: "Provision production secrets (>= 32-char JWT_SECRET, CORS_ORIGIN, cookies Secure=true)",
      required: true,
      checked: false,
      notes: "Confirm zero .env or runtime .sqlite/.json files are tracked in Git.",
    },
    {
      id: uid(),
      category: "Security & IDOR",
      title: `Verify critical security controls (${(security?.controls || []).filter((c) => c.severity === "critical").length || 3} critical gates) & rate limits`,
      required: true,
      checked: false,
      notes: "Confirm cross-tenant UUID requests return 404 and auth endpoints enforce 429 limits.",
    },
    {
      id: uid(),
      category: "Testing & QA",
      title: `Pass automated test suite (${(testing?.cases || []).length || 6} specs across Unit, API & Playwright E2E)`,
      required: true,
      checked: false,
      notes: "Block production deploy in CI if any integration or E2E smoke test fails.",
    },
    ...(hasPayments
      ? [
          {
            id: uid(),
            category: "Billing & Webhooks",
            title: `Register live ${payments} webhook URL and verify HMAC signature rejection`,
            required: true,
            checked: false,
            notes: "Test live webhook ping and confirm processed_webhooks idempotency table records event_id.",
          },
        ]
      : []),
    {
      id: uid(),
      category: "DNS, SSL & Backups",
      title: "Configure TLS domain records, /api/health uptime monitor, and automated daily DB backups",
      required: true,
      checked: false,
      notes: "Set 60-second health probe on GET /api/health and verify 14-day backup retention.",
    },
  ];

  // 4. Step-by-Step Deployment Runbook
  const steps = [
    {
      id: uid(),
      order: 1,
      stage: "Provision Infrastructure",
      title: `Create production ${database} instance and compute service on ${hosting}`,
      command: /sqlite/i.test(database)
        ? "mkdir -p /data && chmod 700 /data"
        : "psql \"$DATABASE_URL\" -c \"SELECT version();\"",
      verification: "Database accepts authenticated connection over private network / TLS.",
      done: false,
    },
    {
      id: uid(),
      order: 2,
      stage: "Configure Secrets",
      title: `Load all ${env_vars.filter((v) => v.required).length} required environment variables into ${hosting} secret store`,
      command: "openssl rand -hex 32 # generate production JWT_SECRET",
      verification: "All required keys present; zero secrets hardcoded in repository.",
      done: false,
    },
    {
      id: uid(),
      order: 3,
      stage: "Apply Schema Migrations",
      title: `Execute schema DDL / migrations for ${(schema?.entities || []).length || 2} tables`,
      command: /sqlite/i.test(database)
        ? "NODE_ENV=production node server/server.js --check"
        : "npx prisma migrate deploy",
      verification: "All tables, primary keys, foreign key cascades, and indexes exist cleanly.",
      done: false,
    },
    {
      id: uid(),
      order: 4,
      stage: "Build & Smoke Test",
      title: "Compile production assets, run test suite, and start server",
      command: "npm ci && npm run build && npm start",
      verification: `GET /api/health returns 200 OK with database.ok === true (${endpoints.length || 2} API contracts mounted).`,
      done: false,
    },
    {
      id: uid(),
      order: 5,
      stage: "DNS Cutover & Post-Launch Watch",
      title: `Point custom domain (${slug}.app) CNAME/A record, verify HTTPS, and test end-to-end login`,
      command: `curl -i https://${slug}.app/api/health`,
      verification: "TLS certificate valid, Strict-Transport-Security active, and primary user flow succeeds.",
      done: false,
    },
  ];

  return {
    target_summary: `Production deployment architecture for ${projectName} on ${hosting} backed by ${database}, strict environment-injected secrets, health-checked zero-downtime releases, and daily automated backups.`,
    hosting_target: hosting,
    database_target: database,
    healthcheck_url: "/api/health",
    environments,
    env_vars,
    checklist,
    steps,
    rollback_plan: `1. Revert ${hosting} deployment pointer to previous green release SHA immediately if /api/health or P95 error rate degrades.\n2. Keep database migrations backward-compatible (expand-and-contract; never drop columns in the same release as code deploy).\n3. If data corruption occurs, pause writes, restore latest verified ${database} snapshot into a clean instance, and repoint DATABASE_URL.`,
  };
}

export function deriveDeploymentFromProject(project, existingArtifacts = {}) {
  const projectName = existingArtifacts?.brief?.content?.name || project?.name || "Workspace";
  const brief = existingArtifacts?.brief?.content || {};
  const architecture = existingArtifacts?.architecture?.content || {};
  const schema = existingArtifacts?.schema?.content || {};
  const endpoints = existingArtifacts?.api?.content?.endpoints || [];
  const security = existingArtifacts?.security?.content || {};
  const testing = existingArtifacts?.testing?.content || {};

  return buildDeploymentPlan({
    projectName,
    brief,
    architecture,
    schema,
    endpoints,
    security,
    testing,
  });
}

export function normalizeDeploymentUpdates(updates, existingArtifacts = {}) {
  if (!updates.deployment) return {};
  const prev = existingArtifacts.deployment?.content || {};
  const d = updates.deployment;

  return {
    deployment: {
      target_summary: d.target_summary ?? prev.target_summary ?? "Production deployment plan and environment catalog.",
      hosting_target: d.hosting_target ?? prev.hosting_target ?? "Vercel + Managed PostgreSQL",
      database_target: d.database_target ?? prev.database_target ?? "PostgreSQL",
      healthcheck_url: d.healthcheck_url ?? prev.healthcheck_url ?? "/api/health",
      environments: Array.isArray(d.environments)
        ? d.environments.map((env) => ({
            id: env.id || uid(),
            name: env.name || "Production",
            branch: env.branch || "main",
            url: env.url || "https://app.example.com",
            compute: env.compute || d.hosting_target || "Managed Container",
            database_tier: env.database_tier || "Managed DB",
            auto_deploy: Boolean(env.auto_deploy),
            healthcheck_path: env.healthcheck_path || "/api/health",
          }))
        : prev.environments || [],
      env_vars: Array.isArray(d.env_vars)
        ? d.env_vars.map((ev) => ({
            id: ev.id || uid(),
            key: String(ev.key || "APP_VAR").toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
            scope: ["server", "client", "build"].includes(ev.scope) ? ev.scope : "server",
            required: ev.required !== false,
            secret: Boolean(ev.secret),
            example: ev.example ?? "",
            description: ev.description ?? "",
          }))
        : prev.env_vars || [],
      checklist: Array.isArray(d.checklist)
        ? d.checklist.map((item) => ({
            id: item.id || uid(),
            category: item.category || "Readiness",
            title: item.title || "Readiness check",
            required: item.required !== false,
            checked: Boolean(item.checked),
            notes: item.notes || "",
          }))
        : prev.checklist || [],
      steps: Array.isArray(d.steps)
        ? d.steps.map((st, idx) => ({
            id: st.id || uid(),
            order: Number.isFinite(st.order) ? st.order : idx + 1,
            stage: st.stage || `Step ${idx + 1}`,
            title: st.title || "Deployment step",
            command: st.command || "",
            verification: st.verification || "",
            done: Boolean(st.done),
          }))
        : prev.steps || [],
      rollback_plan: d.rollback_plan ?? prev.rollback_plan ?? "Revert compute release to last healthy commit and verify /api/health.",
    },
  };
}

export function summarizeDeploymentPlacements(normalizedUpdates, moduleMeta) {
  if (!normalizedUpdates.deployment) return [];
  const dep = normalizedUpdates.deployment;
  const envCount = (dep.env_vars || []).length;
  const stepCount = (dep.steps || []).length;
  const gateCount = (dep.checklist || []).length;
  return [
    {
      kind: "deployment",
      ...moduleMeta.deployment,
      summary: `${gateCount} pre-flight gates · ${envCount} documented env vars · ${stepCount}-step runbook & CI/CD`,
      highlights: [dep.hosting_target, `${envCount} env vars`, `${stepCount} deploy steps`].filter(Boolean),
    },
  ];
}
