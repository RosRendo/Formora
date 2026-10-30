// Phase 2 Blueprint Modules Architect & Normalizer for Formora
// Powers: User Flows (flows), UI/UX Blueprint (ui), Security Plan (security), and Testing Center (testing)

import crypto from "crypto";

const uid = () => crypto.randomUUID();

function humanize(snake = "") {
  return String(snake)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function singularizeWord(name = "") {
  const s = String(name).toLowerCase();
  if (s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.endsWith("ses")) return s.slice(0, -2);
  if (s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

// ---------------------------------------------------------------------------
// 1. USER FLOWS BUILDER
// ---------------------------------------------------------------------------
export function buildFlows({ projectName = "Workspace", features = [], schema = {}, endpoints = [], spec = {}, brief = {} }) {
  const roles = (spec?.roles || []).map((r) => r.name).filter(Boolean);
  const primaryRole = roles[0] || "Member";
  const adminRole = roles.find((r) => /admin|owner|host|organizer|founder|doctor|vendor/i.test(r)) || primaryRole;
  const authMethod = brief?.auth || "Email & Session Auth";

  const mvpFeatures = features.filter((f) => f.scope === "mvp" || !f.scope);
  const domainEntities = (schema?.entities || []).filter((e) => !["users", "refresh_tokens", "sessions"].includes(e.name));
  const firstEnt = domainEntities[0];
  const secondEnt = domainEntities[1];

  const flows = [];

  // Flow 1: Onboarding & Authentication
  const authFeat = mvpFeatures.find((f) => /auth|login|sign|onboard|account|member/i.test(f.title)) || mvpFeatures[0];
  flows.push({
    id: uid(),
    title: "Authentication & First-Run Onboarding",
    role: primaryRole,
    entry_point: "Public Landing (/) → Sign In (/login)",
    goal: `Authenticate via ${authMethod} and reach an actionable workspace in under 90 seconds.`,
    feature_ids: authFeat?.id ? [authFeat.id] : [],
    screen_routes: ["/", "/login", "/dashboard"],
    steps: [
      {
        id: uid(),
        order: 1,
        actor: primaryRole,
        action: `Opens ${projectName} landing page and selects primary Get Started CTA`,
        screen: "Public Landing (/)",
        system_response: "Routes to /login preserving intended destination or invite token",
      },
      {
        id: uid(),
        order: 2,
        actor: primaryRole,
        action: `Submits credentials via ${authMethod}`,
        screen: "Authentication (/login)",
        system_response: "Validates payload, sets HttpOnly session cookies, and initializes user profile",
      },
      {
        id: uid(),
        order: 3,
        actor: "System",
        action: "Hydrates workspace context and checks existing records",
        screen: "Workspace Dashboard (/dashboard)",
        system_response: firstEnt
          ? `Renders ${humanize(firstEnt.name)} overview or guided first-item prompt`
          : "Renders interactive workspace dashboard with quick-start actions",
      },
    ],
    success_outcome: `${primaryRole} holds an authenticated session and lands on a populated or guided /dashboard state.`,
    branches: [
      {
        id: uid(),
        condition: "Invalid credentials or expired verification link",
        handling: "Return HTTP 400/401, preserve typed email input, and offer 1-click retry/resend",
      },
      {
        id: uid(),
        condition: "Rate limit threshold exceeded on /api/auth/*",
        handling: "Return HTTP 429 with Retry-After countdown banner",
      },
    ],
  });

  // Flow 2: Primary Domain Creation & Lifecycle
  const coreFeat = mvpFeatures.find((f) => f.id !== authFeat?.id) || mvpFeatures[0];
  const entLabel = firstEnt ? humanize(singularizeWord(firstEnt.name)) : "Primary Record";
  const entRoute = firstEnt ? `/${firstEnt.name.replace(/_/g, "-")}` : "/items";
  const createEp = endpoints.find((e) => e.method === "POST" && !e.path.includes("auth"));

  flows.push({
    id: uid(),
    title: `Create & Manage ${entLabel}`,
    role: primaryRole,
    entry_point: `Dashboard (/dashboard) → ${entRoute}`,
    goal: `Create, validate, and persist a new ${entLabel.toLowerCase()} with immediate UI feedback.`,
    feature_ids: coreFeat?.id ? [coreFeat.id] : [],
    screen_routes: ["/dashboard", entRoute, `${entRoute}/:id`],
    steps: [
      {
        id: uid(),
        order: 1,
        actor: primaryRole,
        action: `Clicks "New ${entLabel}" from the workspace header or empty state`,
        screen: `Workspace List (${entRoute})`,
        system_response: "Opens structured creation form with field defaults and inline constraints",
      },
      {
        id: uid(),
        order: 2,
        actor: primaryRole,
        action: `Completes required ${entLabel.toLowerCase()} fields and submits`,
        screen: `Create ${entLabel} Modal / Form`,
        system_response: createEp
          ? `Dispatches ${createEp.method} ${createEp.path} with schema validation & owner scoping`
          : `Validates input schema and commits new ${entLabel.toLowerCase()} transactionally`,
      },
      {
        id: uid(),
        order: 3,
        actor: primaryRole,
        action: `Opens detail view to inspect or collaborate on ${entLabel.toLowerCase()}`,
        screen: `${entLabel} Detail (${entRoute}/:id)`,
        system_response: secondEnt
          ? `Loads ${entLabel.toLowerCase()} record alongside linked ${humanize(secondEnt.name)}`
          : "Renders canonical state, activity timestamps, and edit controls",
      },
    ],
    success_outcome: `${entLabel} is persisted in database, indexed to caller tenant, and visible across list and detail views.`,
    branches: [
      {
        id: uid(),
        condition: "Validation failure (missing required field or constraint mismatch)",
        handling: "Return HTTP 422 with field-level error map; focus first invalid input without losing draft data",
      },
      {
        id: uid(),
        condition: "Unauthorized cross-tenant ID access on detail route",
        handling: "Return HTTP 404 Not Found to prevent resource enumeration and redirect cleanly",
      },
    ],
  });

  // Flow 3: Secondary Collaboration / Workflow Progression
  const thirdFeat = mvpFeatures[2] || features[1];
  const secLabel = secondEnt ? humanize(secondEnt.name) : thirdFeat?.title || "Status & Permissions";
  const secRoute = secondEnt ? `/${secondEnt.name.replace(/_/g, "-")}` : "/settings";

  flows.push({
    id: uid(),
    title: `${secLabel} & Role Governance`,
    role: adminRole,
    entry_point: `${entRoute}/:id → ${secRoute}`,
    goal: `Coordinate ${secLabel.toLowerCase()}, enforce role permissions, and keep downstream state synchronized.`,
    feature_ids: thirdFeat?.id ? [thirdFeat.id] : [],
    screen_routes: [`${entRoute}/:id`, secRoute],
    steps: [
      {
        id: uid(),
        order: 1,
        actor: adminRole,
        action: `Navigates to ${secLabel} panel and reviews active items`,
        screen: `${secLabel} View (${secRoute})`,
        system_response: "Queries filtered records scoped to workspace permissions",
      },
      {
        id: uid(),
        order: 2,
        actor: adminRole,
        action: "Updates status, assignment, or configuration settings",
        screen: `${secLabel} View (${secRoute})`,
        system_response: "Persists mutation atomically and records audit timestamp",
      },
    ],
    success_outcome: "State transition is committed cleanly with role verification and zero stale UI cache.",
    branches: [
      {
        id: uid(),
        condition: "Non-admin user attempts restricted mutation",
        handling: "Disable destructive controls in UI and enforce HTTP 403 Forbidden at API middleware",
      },
    ],
  });

  return { flows };
}

// ---------------------------------------------------------------------------
// 2. UI/UX BLUEPRINT BUILDER (Sitemap, Wireframes, Inventory & Design Tokens)
// ---------------------------------------------------------------------------
export function buildUiBlueprint({ projectName = "Workspace", features = [], schema = {}, spec = {}, brief = {} }) {
  const roles = (spec?.roles || []).map((r) => r.name).filter(Boolean);
  const primaryRole = roles[0] || "Member";
  const domainEntities = (schema?.entities || []).filter((e) => !["users", "refresh_tokens", "sessions"].includes(e.name));
  const firstEnt = domainEntities[0];
  const secondEnt = domainEntities[1];

  const primarySlug = firstEnt ? firstEnt.name.replace(/_/g, "-") : "items";
  const primaryTitle = firstEnt ? humanize(firstEnt.name) : "Workspace Items";
  const secondarySlug = secondEnt ? secondEnt.name.replace(/_/g, "-") : "activity";
  const secondaryTitle = secondEnt ? humanize(secondEnt.name) : "Activity & Logs";

  const sitemap = [
    { id: uid(), path: "/", label: `${projectName} Landing`, auth: false, role: "Public", purpose: "Product positioning, live preview & conversion CTA" },
    { id: uid(), path: "/login", label: "Sign In / Register", auth: false, role: "Public", purpose: `Authentication via ${brief?.auth || "email & password"}` },
    { id: uid(), path: "/dashboard", label: "Overview Dashboard", auth: true, role: primaryRole, purpose: "Summary KPIs, recent activity & quick creation" },
    { id: uid(), path: `/${primarySlug}`, label: primaryTitle, auth: true, role: primaryRole, purpose: `Filterable list & CRUD for ${primaryTitle.toLowerCase()}` },
    { id: uid(), path: `/${primarySlug}/:id`, label: `${humanize(singularizeWord(primaryTitle))} Detail`, auth: true, role: primaryRole, purpose: `Deep inspection, linked ${secondaryTitle.toLowerCase()} & state actions` },
    { id: uid(), path: "/settings", label: "Workspace Settings", auth: true, role: roles[1] || primaryRole, purpose: "Profile, role permissions, billing & exports" },
  ];

  const featIds = features.map((f) => f.id).filter(Boolean);

  const screens = [
    {
      id: uid(),
      name: "Public Landing & Positioning",
      route: "/",
      role: "Public",
      layout: "public_hero",
      purpose: `Communicate ${projectName}'s core value proposition and convert visitors into signed-in users.`,
      feature_ids: featIds.slice(0, 1),
      sections: [
        { type: "topbar", label: "Brand Wordmark · Navigation Anchors · Sign In / Start CTA" },
        { type: "hero", label: "Value Headline · Interactive Product Schematic · Primary Conversion Action" },
        { type: "cards", label: "3 Core Capability Modules with Proof Metrics" },
      ],
      components: ["TopNavbar", "HeroShowcase", "FeatureGrid", "PricingStrip"],
      states: {
        loading: "Instant static shell render (<100ms FCP) with progressive interactive hydration",
        empty: "Pre-populated interactive product demonstration (never blank)",
        error: "Graceful fallback to Sign In route if live preview API is unreachable",
        success: "Smooth transition into /login?mode=register preserving selected plan/intent",
      },
    },
    {
      id: uid(),
      name: "Workspace Overview Dashboard",
      route: "/dashboard",
      role: primaryRole,
      layout: "sidebar_table",
      purpose: `Give ${primaryRole.toLowerCase()}s immediate visibility into active ${primaryTitle.toLowerCase()} and pending actions.`,
      feature_ids: featIds.slice(0, 2),
      sections: [
        { type: "topbar", label: `Breadcrumb · Global Search · + New ${humanize(singularizeWord(primaryTitle))} Button` },
        { type: "metrics", label: `Summary Strip (Total ${primaryTitle}, Active This Week, Pending Review)` },
        { type: "filter_bar", label: "Status Tabs · Search Filter · Sort Selector" },
        { type: "table", label: `Primary ${primaryTitle} Rows with Status Pills & Quick Actions` },
      ],
      components: ["AppSidebar", "KpiMetricStrip", "FilterToolbar", "DataTable", "StatusPill"],
      states: {
        loading: "3 metric skeleton blocks + 5 table row shimmers matching column geometry",
        empty: `Guided empty state card explaining how to create the first ${singularizeWord(primaryTitle).toLowerCase()} with 1-click CTA`,
        error: "Non-blocking inline alert banner with Retry query button",
        success: "Live row highlight and instant counter update upon record creation",
      },
    },
    {
      id: uid(),
      name: `${humanize(singularizeWord(primaryTitle))} Detail & Inspector`,
      route: `/${primarySlug}/:id`,
      role: primaryRole,
      layout: "sidebar_detail",
      purpose: `Inspect and edit a single ${singularizeWord(primaryTitle).toLowerCase()} alongside related ${secondaryTitle.toLowerCase()}.`,
      feature_ids: featIds.slice(1, 3),
      sections: [
        { type: "topbar", label: "Back Link · Record Title · Status Badge · Save / Archive Actions" },
        { type: "detail_panel", label: `Two-Column Split: Editable ${humanize(singularizeWord(primaryTitle))} Properties + Metadata Rail` },
        { type: "cards", label: `Linked ${secondaryTitle} Timeline & Sub-Item Composer` },
      ],
      components: ["DetailHeader", "PropertyForm", "RelatedItemsList", "ConfirmDeleteDialog"],
      states: {
        loading: "Structured two-column wireframe skeleton preserving scroll stability",
        empty: `Placeholder in ${secondaryTitle.toLowerCase()} sub-panel prompting first entry`,
        error: "404 Not Found recovery view with link back to workspace list",
        success: "Saved badge confirmation with updated version/timestamp indicator",
      },
    },
    {
      id: uid(),
      name: "Authentication & Onboarding Gate",
      route: "/login",
      role: "Public",
      layout: "auth_split",
      purpose: `Frictionless sign-in and account registration via ${brief?.auth || "credentials / OAuth"}.`,
      feature_ids: featIds.slice(0, 1),
      sections: [
        { type: "topbar", label: "Back to Home Link · Brand Mark" },
        { type: "form", label: "Email & Password / Magic Link Inputs · OAuth Button · Submit Action" },
      ],
      components: ["AuthCard", "ValidatedInput", "OAuthButton", "FormErrorAlert"],
      states: {
        loading: "Disabled submit button with inline spinner preventing double submission",
        empty: "Clean focused email input with clear password minimum rules",
        error: "Field-specific validation hint or credential mismatch banner",
        success: "Immediate redirect to /dashboard (or intended deep link)",
      },
    },
  ];

  return {
    sitemap,
    screens,
    tokens: {
      aesthetic: "Precision Swiss editorial workspace — crisp 1px hairlines, high contrast, zero decorative clutter",
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
    },
  };
}

// ---------------------------------------------------------------------------
// 3. SECURITY PLAN BUILDER (10 Categories + Threat Review)
// ---------------------------------------------------------------------------
export function buildSecurityPlan({ projectName = "Workspace", schema = {}, endpoints = [], brief = {} }) {
  const hasPayments = brief?.payments && !/not in mvp|none|free only/i.test(brief.payments);
  const authEndpoints = endpoints.filter((e) => /auth|login|session/i.test(e.path)).map((e) => `${e.method} ${e.path}`);
  const writeEndpoints = endpoints.filter((e) => ["POST", "PUT", "PATCH", "DELETE"].includes(e.method)).map((e) => `${e.method} ${e.path}`);
  const tableNames = (schema?.entities || []).map((e) => e.name);

  const controls = [
    {
      id: uid(),
      category: "Authentication",
      title: "HttpOnly Session Cookies & Single-Use Refresh Token Rotation",
      severity: "critical",
      status: "implemented",
      mitigation: `Issue short-lived access tokens and SHA-256 hashed refresh tokens in HttpOnly, SameSite=Lax, Secure (prod) cookies; revoke consumed refresh tokens immediately.`,
      verification: "Replay old refresh_token after /refresh and assert HTTP 401.",
      linked_refs: authEndpoints.length ? authEndpoints.slice(0, 2) : ["POST /api/auth/login", "POST /api/auth/refresh"],
    },
    {
      id: uid(),
      category: "Authorization & IDOR",
      title: "Centralized Tenant Ownership & Role Enforcement Middleware",
      severity: "critical",
      status: "implemented",
      mitigation: "Derive actor user_id strictly from verified session token (never request body) and scope every resource lookup by owner/tenant ID, returning 404 on cross-tenant access.",
      verification: "Authenticate as User B and request User A's resource UUID across GET/PATCH/DELETE; assert 404.",
      linked_refs: writeEndpoints.slice(0, 3),
    },
    {
      id: uid(),
      category: "Input Validation",
      title: "Strict Schema Whitelisting & Payload Size Caps",
      severity: "high",
      status: "implemented",
      mitigation: "Validate all incoming JSON bodies against explicit field whitelists, string length bounds, and enum sets; cap JSON body parser to prevent memory exhaustion.",
      verification: "Send unknown fields and malformed types to POST/PATCH endpoints; assert HTTP 400/422 and zero prototype/field injection.",
      linked_refs: writeEndpoints.slice(0, 2),
    },
    {
      id: uid(),
      category: "Secrets Hygiene",
      title: "Environment-Only Credentials & Fail-Fast Production Boot Check",
      severity: "critical",
      status: "implemented",
      mitigation: "Load JWT_SECRET, database URLs, and API keys solely from environment variables; abort production boot if JWT_SECRET is missing or < 32 chars; gitignore .env and runtime DB files.",
      verification: "Run git ls-files check for .env/db files and test NODE_ENV=production boot without JWT_SECRET.",
      linked_refs: [".env.example", ".gitignore"],
    },
    {
      id: uid(),
      category: "Database Policies",
      title: "Parameterized Queries & Foreign Key Cascade Integrity",
      severity: "high",
      status: "implemented",
      mitigation: `Execute 100% parameterized prepared statements across ${tableNames.length || "all"} relational tables with PRAGMA foreign_keys = ON / PostgreSQL FK constraints and transactional writes.`,
      verification: "Attempt SQL metacharacter payloads in search/title inputs and verify literal storage.",
      linked_refs: tableNames.slice(0, 4),
    },
    {
      id: uid(),
      category: "Payments & Webhooks",
      title: hasPayments
        ? `Cryptographic Webhook Verification & Event Idempotency (${brief.payments})`
        : "Billing Webhook HMAC Verification & Idempotency Ledger",
      severity: hasPayments ? "critical" : "medium",
      status: hasPayments ? "implemented" : "planned",
      mitigation: "Verify raw request body HMAC-SHA256 signature using crypto.timingSafeEqual and deduplicate webhook event_ids in processed_webhooks table before mutating entitlements.",
      verification: "POST forged X-Signature header (expect 401) and replay identical event_id twice (expect already_processed).",
      linked_refs: ["POST /api/billing/webhook"],
    },
    {
      id: uid(),
      category: "Uploads & Storage",
      title: "MIME Allowlist, File Size Quota & Signed Object Keys",
      severity: "medium",
      status: "planned",
      mitigation: "Restrict uploads to explicit MIME types, enforce per-file byte limits, randomize storage object keys, and serve user uploads with Content-Disposition / nosniff headers.",
      verification: "Attempt executable or oversized file upload and verify rejection.",
      linked_refs: ["Storage Policy"],
    },
    {
      id: uid(),
      category: "Rate Limiting",
      title: "Sliding-Window Rate Limiters on Auth, AI & Checkout Endpoints",
      severity: "high",
      status: "implemented",
      mitigation: "Enforce per-IP / per-user sliding-window request budgets on login, registration, OAuth exchange, checkout, and LLM generation endpoints with Retry-After headers.",
      verification: "Burst >25 auth requests within window and verify HTTP 429 response.",
      linked_refs: ["POST /api/auth/login", "POST /api/billing/checkout"],
    },
    {
      id: uid(),
      category: "Audit Logging",
      title: "Structured Security Event & Decision Trail Without PII Leaks",
      severity: "medium",
      status: "planned",
      mitigation: "Record authentication failures, permission denials, billing transitions, and architectural approvals with timestamps and actor IDs while redacting tokens and passwords.",
      verification: "Inspect logs after login & approval flows to confirm zero token/password exposure.",
      linked_refs: ["decisions", "transactions"],
    },
    {
      id: uid(),
      category: "Backups & Recovery",
      title: "Automated Daily Database Snapshots & Restore Drill",
      severity: "high",
      status: "planned",
      mitigation: `Schedule automated daily encrypted snapshots of ${brief?.database || "primary database"} with WAL checkpointing / point-in-time recovery and 14-day retention.`,
      verification: "Restore latest snapshot into isolated staging DB and run /api/health smoke check.",
      linked_refs: ["GET /api/health"],
    },
  ];

  const threats = [
    {
      id: uid(),
      risk: `Cross-tenant data exposure in ${projectName} resource endpoints`,
      severity: "critical",
      vector: "Authenticated attacker substitutes another tenant's UUID in path parameters",
      mitigation: "Enforce centralized ownership middleware across all /:id routes and return 404 on mismatch.",
    },
    {
      id: uid(),
      risk: "Stolen or replayed refresh token extending unauthorized session",
      severity: "high",
      vector: "Network/XSS token interception or shared-device cookie replay",
      mitigation: "HttpOnly cookies block JS read access; single-use refresh rotation invalidates replayed tokens immediately.",
    },
    {
      id: uid(),
      risk: "Forged or replayed payment webhook elevating account tier",
      severity: hasPayments ? "critical" : "medium",
      vector: "Unauthenticated POST to webhook endpoint with crafted JSON payload",
      mitigation: "Constant-time HMAC-SHA256 verification against rawBody + unique event_id idempotency ledger.",
    },
  ];

  return {
    posture_summary: `Defense-in-depth security blueprint for ${projectName}: HttpOnly rotated sessions, zero-trust tenant scoping across all mutable routes, whitelisted payloads, rate-limited auth/billing surfaces, and auditable recovery controls.`,
    controls,
    threats,
  };
}

// ---------------------------------------------------------------------------
// 4. TESTING CENTER BUILDER (Unit, Integration & E2E Linked Suite)
// ---------------------------------------------------------------------------
export function buildTestingPlan({ projectName = "Workspace", features = [], endpoints = [], schema = {} }) {
  const cases = [];
  const mvpFeatures = features.filter((f) => f.scope === "mvp" || !f.scope);
  const firstFeat = mvpFeatures[0];
  const secondFeat = mvpFeatures[1] || firstFeat;
  const entities = schema?.entities || [];

  // 1. Unit tests from schema / domain invariants
  cases.push({
    id: uid(),
    level: "unit",
    title: "Validate domain payload schemas and reject malformed or empty required fields",
    target: `${entities[0]?.name || "core"} validator`,
    feature_id: firstFeat?.id || null,
    endpoint_path: null,
    status: "ready",
    steps: [
      "Pass valid minimal domain payload into validator",
      "Pass payload with missing required fields and over-length strings",
    ],
    expected: "Valid input normalizes cleanly; invalid payload returns deterministic field error map.",
    needs_review: false,
    review_reason: null,
  });

  cases.push({
    id: uid(),
    level: "unit",
    title: "Enforce role permission matrix and tenant ownership helper invariants",
    target: "Authorization policy helper",
    feature_id: firstFeat?.id || null,
    endpoint_path: null,
    status: "ready",
    steps: [
      "Evaluate owner actor against private resource",
      "Evaluate non-owner actor against private resource and read-only sample resource",
    ],
    expected: "Owner receives full read/write grant; cross-tenant private access denies cleanly.",
    needs_review: false,
    review_reason: null,
  });

  // 2. Integration tests derived directly from API endpoints!
  for (const ep of endpoints.slice(0, 5)) {
    const epLabel = `${ep.method} ${ep.path}`;
    const linkedFeatId = ep.feature_id || secondFeat?.id || firstFeat?.id || null;
    cases.push({
      id: uid(),
      level: "integration",
      title: `${epLabel} — happy path contract & persistence`,
      target: epLabel,
      feature_id: linkedFeatId,
      endpoint_path: epLabel,
      status: "ready",
      steps: [
        ep.auth_required !== false ? "Authenticate test tenant and attach session cookie" : "Send unauthenticated public request",
        `Invoke ${epLabel} with valid payload/query`,
        "Assert response status, JSON schema shape, and persisted database state",
      ],
      expected: (ep.test_cases && ep.test_cases[0]) || `Returns ${ep.method === "POST" ? "200/201" : "200"} matching response contract.`,
      needs_review: false,
      review_reason: null,
    });
  }

  // Always include an explicit Cross-Tenant IDOR & Unauthenticated Guard integration test
  const protectedEp = endpoints.find((e) => e.auth_required !== false) || endpoints[0];
  const protLabel = protectedEp ? `${protectedEp.method} ${protectedEp.path}` : "GET /api/items";
  cases.push({
    id: uid(),
    level: "integration",
    title: "Block unauthenticated requests (401) and cross-tenant IDOR access (404)",
    target: protLabel,
    feature_id: firstFeat?.id || null,
    endpoint_path: protLabel,
    status: "ready",
    steps: [
      `Call ${protLabel} without cookies and assert 401`,
      "Create resource as Tenant A, then request same UUID as Tenant B",
    ],
    expected: "Unauthenticated call returns 401; Tenant B cross-tenant request returns 404 with zero data leakage.",
    needs_review: false,
    review_reason: null,
  });

  // 3. E2E Playwright Smoke Tests from MVP Features
  cases.push({
    id: uid(),
    level: "e2e",
    title: `End-to-end onboarding: visitor signs in and lands on ${projectName} dashboard`,
    target: "Onboarding Flow (/ → /login → /dashboard)",
    feature_id: firstFeat?.id || null,
    endpoint_path: null,
    status: "ready",
    steps: [
      "Open public landing page / and click primary Get Started / Sign In CTA",
      "Complete registration or demo login on /login",
      "Verify /dashboard renders authenticated workspace shell and navigation",
    ],
    expected: "Session persists across full browser reload and protected routes render without console errors.",
    needs_review: false,
    review_reason: null,
  });

  cases.push({
    id: uid(),
    level: "e2e",
    title: `Primary user journey: create, inspect, and update ${secondFeat?.title || "core workspace record"}`,
    target: "Core CRUD Journey",
    feature_id: secondFeat?.id || firstFeat?.id || null,
    endpoint_path: endpoints.find((e) => e.method === "POST") ? `POST ${endpoints.find((e) => e.method === "POST").path}` : null,
    status: "ready",
    steps: [
      "Sign in as active member and trigger primary Create action",
      "Submit valid form values and confirm record appears in list",
      "Reload page to confirm database persistence, then update record status",
    ],
    expected: "Created item survives page reload and updated status badge reflects persisted state.",
    needs_review: false,
    review_reason: null,
  });

  return {
    strategy: `Pragmatic Testing Trophy for ${projectName}: fast Vitest unit tests for validators & permissions, real-database API integration specs covering every REST contract + IDOR tenant isolation, and Playwright E2E journeys for onboarding and core mutations.`,
    runner_stack: {
      unit: "Vitest",
      integration: "Vitest + Supertest (real test DB)",
      e2e: "Playwright",
    },
    cases,
  };
}

// ---------------------------------------------------------------------------
// 5. DERIVE ALL 4 PHASE 2 ARTIFACTS FROM EXISTING PROJECT STATE
// ---------------------------------------------------------------------------
export function derivePhase2FromProject(project, existingArtifacts = {}) {
  const projectName = existingArtifacts?.brief?.content?.name || project?.name || "Workspace";
  const brief = existingArtifacts?.brief?.content || {};
  const spec = existingArtifacts?.spec?.content || {};
  const features = existingArtifacts?.features?.content?.features || [];
  const schema = existingArtifacts?.schema?.content || { entities: [], relationships: [] };
  const endpoints = existingArtifacts?.api?.content?.endpoints || [];

  return {
    flows: buildFlows({ projectName, features, schema, endpoints, spec, brief }),
    ui: buildUiBlueprint({ projectName, features, schema, spec, brief }),
    security: buildSecurityPlan({ projectName, schema, endpoints, brief }),
    testing: buildTestingPlan({ projectName, features, endpoints, schema }),
  };
}

// ---------------------------------------------------------------------------
// 6. STRICT NORMALIZER FOR PHASE 2 ARTIFACTS
// ---------------------------------------------------------------------------
export function normalizePhase2Updates(updates, existingArtifacts = {}) {
  const out = {};

  if (updates.flows) {
    const rawList = Array.isArray(updates.flows) ? updates.flows : updates.flows.flows || [];
    out.flows = {
      flows: rawList.map((fl, idx) => ({
        id: fl.id || uid(),
        title: fl.title || fl.name || `User Flow ${idx + 1}`,
        role: fl.role || "Member",
        entry_point: fl.entry_point || "/dashboard",
        goal: fl.goal || "",
        feature_ids: Array.isArray(fl.feature_ids) ? fl.feature_ids.filter(Boolean) : [],
        screen_routes: Array.isArray(fl.screen_routes) ? fl.screen_routes.map(String) : [],
        steps: Array.isArray(fl.steps)
          ? fl.steps.map((st, sIdx) => ({
              id: st.id || uid(),
              order: Number.isFinite(st.order) ? st.order : sIdx + 1,
              actor: st.actor || fl.role || "User",
              action: st.action || st.step || "",
              screen: st.screen || "",
              system_response: st.system_response || st.response || "",
            }))
          : [],
        success_outcome: fl.success_outcome || "",
        branches: Array.isArray(fl.branches)
          ? fl.branches.map((br) => ({
              id: br.id || uid(),
              condition: br.condition || "Edge condition",
              handling: br.handling || br.outcome || "",
            }))
          : [],
      })),
    };
  }

  if (updates.ui) {
    const prev = existingArtifacts.ui?.content || {};
    const u = updates.ui;
    const rawSitemap = Array.isArray(u.sitemap) ? u.sitemap : prev.sitemap || [];
    const rawScreens = Array.isArray(u.screens) ? u.screens : prev.screens || [];
    const prevTokens = prev.tokens || {};
    const rawTokens = u.tokens || {};

    out.ui = {
      sitemap: rawSitemap.map((item) => ({
        id: item.id || uid(),
        path: item.path || "/",
        label: item.label || item.name || "Screen",
        auth: item.auth !== false,
        role: item.role || (item.auth === false ? "Public" : "Member"),
        purpose: item.purpose || "",
      })),
      screens: rawScreens.map((sc) => ({
        id: sc.id || uid(),
        name: sc.name || sc.title || "Workspace Screen",
        route: sc.route || "/dashboard",
        role: sc.role || "Member",
        layout: ["public_hero", "auth_split", "sidebar_table", "sidebar_detail", "settings_form"].includes(sc.layout)
          ? sc.layout
          : "sidebar_table",
        purpose: sc.purpose || "",
        feature_ids: Array.isArray(sc.feature_ids) ? sc.feature_ids.filter(Boolean) : [],
        sections: Array.isArray(sc.sections)
          ? sc.sections.map((sec) =>
              typeof sec === "string"
                ? { type: "cards", label: sec }
                : { type: sec.type || "cards", label: sec.label || "Section" }
            )
          : [
              { type: "topbar", label: "Header & Primary Actions" },
              { type: "table", label: "Primary Content Region" },
            ],
        components: Array.isArray(sc.components) ? sc.components.map(String) : [],
        states: {
          loading: sc.states?.loading || "Skeleton shimmer matching layout geometry",
          empty: sc.states?.empty || "Guided empty state with primary creation CTA",
          error: sc.states?.error || "Inline alert banner with retry action",
          success: sc.states?.success || "Immediate optimistic update + subtle toast confirmation",
        },
      })),
      tokens: {
        aesthetic: rawTokens.aesthetic ?? prevTokens.aesthetic ?? "Precision Swiss editorial workspace",
        primary_color: rawTokens.primary_color ?? prevTokens.primary_color ?? "#18181b",
        accent_color: rawTokens.accent_color ?? prevTokens.accent_color ?? "#2563eb",
        surface_color: rawTokens.surface_color ?? prevTokens.surface_color ?? "#fafafa",
        success_color: rawTokens.success_color ?? prevTokens.success_color ?? "#16a34a",
        warning_color: rawTokens.warning_color ?? prevTokens.warning_color ?? "#d97706",
        danger_color: rawTokens.danger_color ?? prevTokens.danger_color ?? "#dc2626",
        heading_font: rawTokens.heading_font ?? prevTokens.heading_font ?? "IBM Plex Sans",
        body_font: rawTokens.body_font ?? prevTokens.body_font ?? "IBM Plex Sans",
        mono_font: rawTokens.mono_font ?? prevTokens.mono_font ?? "JetBrains Mono",
        radius: rawTokens.radius ?? prevTokens.radius ?? "6px",
        density: rawTokens.density ?? prevTokens.density ?? "Compact (4px / 8px spatial grid)",
      },
    };
  }

  if (updates.security) {
    const prev = existingArtifacts.security?.content || {};
    const sec = updates.security;
    const rawControls = Array.isArray(sec.controls) ? sec.controls : Array.isArray(sec) ? sec : prev.controls || [];
    const rawThreats = Array.isArray(sec.threats) ? sec.threats : prev.threats || [];

    out.security = {
      posture_summary: sec.posture_summary || prev.posture_summary || "Defense-in-depth application security controls.",
      controls: rawControls.map((c) => ({
        id: c.id || uid(),
        category: c.category || "Authorization & IDOR",
        title: c.title || "Security Control",
        severity: ["critical", "high", "medium", "low"].includes(c.severity) ? c.severity : "high",
        status: ["implemented", "planned", "n/a"].includes(c.status) ? c.status : "planned",
        mitigation: c.mitigation || c.description || "",
        verification: c.verification || "",
        linked_refs: Array.isArray(c.linked_refs) ? c.linked_refs.map(String) : [],
      })),
      threats: rawThreats.map((t) => ({
        id: t.id || uid(),
        risk: t.risk || t.title || "Potential threat",
        severity: ["critical", "high", "medium", "low"].includes(t.severity) ? t.severity : "high",
        vector: t.vector || "",
        mitigation: t.mitigation || "",
      })),
    };
  }

  if (updates.testing) {
    const prev = existingArtifacts.testing?.content || {};
    const tst = updates.testing;
    const rawCases = Array.isArray(tst.cases) ? tst.cases : Array.isArray(tst) ? tst : prev.cases || [];

    out.testing = {
      strategy: tst.strategy || prev.strategy || "Pragmatic Testing Trophy across unit, API integration, and E2E journeys.",
      runner_stack: {
        unit: tst.runner_stack?.unit || prev.runner_stack?.unit || "Vitest",
        integration: tst.runner_stack?.integration || prev.runner_stack?.integration || "Vitest + Supertest",
        e2e: tst.runner_stack?.e2e || prev.runner_stack?.e2e || "Playwright",
      },
      cases: rawCases.map((tc) => ({
        id: tc.id || uid(),
        level: ["unit", "integration", "e2e"].includes(tc.level) ? tc.level : "integration",
        title: tc.title || "Test scenario",
        target: tc.target || "",
        feature_id: tc.feature_id || null,
        endpoint_path: tc.endpoint_path || null,
        status: ["ready", "automated", "passing", "failing"].includes(tc.status) ? tc.status : "ready",
        steps: Array.isArray(tc.steps) ? tc.steps.map(String) : [],
        expected: tc.expected || "",
        needs_review: Boolean(tc.needs_review),
        review_reason: tc.review_reason || null,
      })),
    };
  }

  return out;
}

// ---------------------------------------------------------------------------
// 7. PLACEMENT CARDS FOR AI CHAT ROUTER
// ---------------------------------------------------------------------------
export function summarizePhase2Placements(normalizedUpdates, moduleMeta) {
  const placements = [];

  if (normalizedUpdates.flows) {
    const list = normalizedUpdates.flows.flows || [];
    const totalSteps = list.reduce((sum, f) => sum + (f.steps?.length || 0), 0);
    placements.push({
      kind: "flows",
      ...moduleMeta.flows,
      summary: `${list.length} role journeys · ${totalSteps} interactive steps & failure branches`,
      highlights: list.map((f) => f.title).slice(0, 4),
    });
  }

  if (normalizedUpdates.ui) {
    const screens = normalizedUpdates.ui.screens || [];
    const sitemap = normalizedUpdates.ui.sitemap || [];
    placements.push({
      kind: "ui",
      ...moduleMeta.ui,
      summary: `${sitemap.length} routes · ${screens.length} wireframed screens (Desktop + Mobile) & tokens`,
      highlights: screens.map((s) => `${s.name} (${s.route})`).slice(0, 4),
    });
  }

  if (normalizedUpdates.security) {
    const controls = normalizedUpdates.security.controls || [];
    const impl = controls.filter((c) => c.status === "implemented").length;
    placements.push({
      kind: "security",
      ...moduleMeta.security,
      summary: `${controls.length} controls (${impl} implemented, ${controls.length - impl} planned) + threat review`,
      highlights: controls.map((c) => c.category).slice(0, 4),
    });
  }

  if (normalizedUpdates.testing) {
    const cases = normalizedUpdates.testing.cases || [];
    placements.push({
      kind: "testing",
      ...moduleMeta.testing,
      summary: `${cases.length} linked test specs (Unit, API Integration & Playwright E2E)`,
      highlights: cases.map((c) => `[${c.level.toUpperCase()}] ${c.title}`).slice(0, 3),
    });
  }

  return placements;
}

