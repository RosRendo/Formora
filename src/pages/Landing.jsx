import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Copy, Menu, X, Pause, Play, MessageSquare, Database, Network, ListChecks, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import klingHero from "@/assets/kling-hero.mp4";

const PIPELINE = [
  { id: "brief", label: "Brief", detail: "Problem statement, target users, MVP scope & explicit non-goals." },
  { id: "spec", label: "Spec", detail: "Functional requirements, role matrix, auth model & latency targets." },
  { id: "features", label: "Features", detail: "Prioritized P0/P1 epics decomposed into testable acceptance criteria." },
  { id: "arch", label: "Architecture", detail: "Service topology graph, protocols, hosting & trade-off rationale." },
  { id: "schema", label: "Schema", detail: "Normalized PostgreSQL entities, indexes, foreign keys & cascade rules." },
  { id: "api", label: "API", detail: "Typed HTTP routes, request/response JSON contracts & rate limits." },
  { id: "roadmap", label: "Roadmap", detail: "Dependency-ordered vertical slice tasks linked directly to entities." },
];

const WORKBENCH_CASES = [
  {
    id: "foodflow",
    slug: "foodflow-khqr",
    label: "Food delivery + KHQR",
    prompt:
      "Local restaurant delivery app with partner menus, live rider dispatch, and idempotent ABA KHQR payment webhooks.",
    routed: [
      { target: "schema", tab: "schema", count: "4 tables · 3 FKs", threshold: 0.25 },
      { target: "api", tab: "api", count: "5 endpoints", threshold: 0.5 },
      { target: "architecture", tab: "arch", count: "5 nodes · 5 edges", threshold: 0.75 },
      { target: "docs/", tab: "docs", count: "01..09.md", threshold: 0.95 },
    ],
    tables: [
      {
        name: "users",
        refs: [],
        cols: [
          ["id", "uuid", "pk"],
          ["email", "varchar(255)", "unique"],
          ["role", "varchar(24)", "customer|merchant|rider"],
        ],
        ddl: `CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  role varchar(24) NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now()
);`,
      },
      {
        name: "restaurants",
        refs: ["users"],
        cols: [
          ["id", "uuid", "pk"],
          ["owner_id", "uuid", "fk -> users.id"],
          ["name", "varchar(160)", "not null"],
          ["is_open", "boolean", "default true"],
        ],
        ddl: `CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  is_open boolean NOT NULL DEFAULT true
);`,
      },
      {
        name: "orders",
        refs: ["users", "restaurants"],
        cols: [
          ["id", "uuid", "pk"],
          ["customer_id", "uuid", "fk -> users.id"],
          ["restaurant_id", "uuid", "fk -> restaurants.id"],
          ["total_cents", "integer", "check >= 0"],
          ["status", "varchar(32)", "idx"],
        ],
        ddl: `CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  status varchar(32) NOT NULL DEFAULT 'awaiting_payment',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status ON orders(status);`,
      },
      {
        name: "khqr_webhooks",
        refs: ["orders"],
        cols: [
          ["event_id", "varchar(80)", "pk"],
          ["order_id", "uuid", "fk -> orders.id"],
          ["hmac_valid", "boolean", "not null"],
          ["processed_at", "timestamptz", "default now()"],
        ],
        ddl: `CREATE TABLE khqr_webhooks (
  event_id varchar(80) PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  hmac_valid boolean NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);`,
      },
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/restaurants",
        role: "public",
        rate: "120/m",
        desc: "List open kitchens & menu items",
        req: "// Query: ?lat=11.5564&lng=104.9282&open=true",
        res: '{ "restaurants": [{ "id": "uuid", "name": "Malis Kitchen", "eta_min": 22 }] }',
      },
      {
        method: "POST",
        path: "/api/orders",
        role: "customer",
        rate: "30/m",
        desc: "Lock cart, compute delivery fee, create row",
        req: '{ "restaurant_id": "uuid", "items": [{ "sku": "amok-01", "qty": 2 }] }',
        res: '{ "order_id": "uuid", "total_cents": 1850, "status": "awaiting_payment" }',
      },
      {
        method: "POST",
        path: "/api/payments/khqr",
        role: "customer",
        rate: "20/m",
        desc: "Sign merchant KHQR payload & hash",
        req: '{ "order_id": "uuid", "currency": "USD" }',
        res: '{ "khqr_payload": "000201010212...", "md5": "8f14e45fceea167a", "expires_in": 180 }',
      },
      {
        method: "POST",
        path: "/api/webhooks/payway",
        role: "hmac-sha512",
        rate: "300/m",
        desc: "Idempotent settlement & kitchen dispatch",
        req: '{ "tran_id": "pw_99481", "status": 0, "hash": "sha512..." }',
        res: '{ "received": true, "idempotent": true, "order_status": "preparing" }',
      },
      {
        method: "PATCH",
        path: "/api/orders/:id/location",
        role: "rider",
        rate: "60/m",
        desc: "Stream live rider GPS coordinates",
        req: '{ "lat": 11.5621, "lng": 104.9304, "heading": 145 }',
        res: '{ "broadcast": "ws://orders/:id", "updated_at": "2026-10-30T01:05:00Z" }',
      },
    ],
    svgNodes: [
      { id: "web", x: 24, y: 84, w: 132, label: "web_client", sub: "React + PWA", latency: "12ms", role: "Customer, merchant & rider UI with live map socket." },
      { id: "api", x: 196, y: 34, w: 138, label: "order_api", sub: "Node + Express", latency: "6ms", role: "Cart pricing, state machine & role-guarded REST contracts." },
      { id: "hook", x: 196, y: 134, w: 138, label: "khqr_verifier", sub: "HMAC Webhook", latency: "4ms", role: "Timing-safe signature verification & idempotency ledger." },
      { id: "db", x: 374, y: 34, w: 132, label: "postgres_16", sub: "orders, users", latency: "1.8ms", role: "ACID relational store with foreign-key constraints." },
      { id: "ws", x: 374, y: 134, w: 132, label: "dispatch_ws", sub: "Rider stream", latency: "9ms", role: "Pub/sub channel broadcasting live rider coordinates." },
    ],
    svgEdges: [
      { d: "M156 106 C 178 106, 174 56, 196 56", dur: "2.1s" },
      { d: "M156 106 C 178 106, 174 156, 196 156", dur: "2.8s" },
      { d: "M334 56 C 354 56, 354 56, 374 56", dur: "1.6s" },
      { d: "M334 156 C 354 156, 354 56, 374 56", dur: "2.4s" },
      { d: "M334 56 C 354 56, 354 156, 374 156", dur: "2.0s" },
    ],
  },
  {
    id: "pipeline",
    slug: "b2b-crm",
    label: "Multi-tenant CRM",
    prompt:
      "Workspace-isolated B2B sales CRM with RBAC memberships, kanban deal stages, audit logs, and seat-based billing.",
    routed: [
      { target: "schema", tab: "schema", count: "4 tables · 4 FKs", threshold: 0.25 },
      { target: "api", tab: "api", count: "5 endpoints", threshold: 0.5 },
      { target: "architecture", tab: "arch", count: "5 nodes · 4 edges", threshold: 0.75 },
      { target: "docs/", tab: "docs", count: "01..09.md", threshold: 0.95 },
    ],
    tables: [
      {
        name: "workspaces",
        refs: [],
        cols: [
          ["id", "uuid", "pk"],
          ["slug", "varchar(80)", "unique"],
          ["plan", "varchar(24)", "default 'free'"],
          ["seat_limit", "integer", "default 1"],
        ],
        ddl: `CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(80) NOT NULL UNIQUE,
  plan varchar(24) NOT NULL DEFAULT 'free',
  seat_limit integer NOT NULL DEFAULT 1
);`,
      },
      {
        name: "memberships",
        refs: ["workspaces"],
        cols: [
          ["id", "uuid", "pk"],
          ["workspace_id", "uuid", "fk -> workspaces.id"],
          ["user_id", "uuid", "fk -> users.id"],
          ["role", "varchar(20)", "owner|admin|rep"],
        ],
        ddl: `CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role varchar(20) NOT NULL CHECK (role IN ('owner', 'admin', 'rep')),
  UNIQUE (workspace_id, user_id)
);`,
      },
      {
        name: "deals",
        refs: ["workspaces"],
        cols: [
          ["id", "uuid", "pk"],
          ["workspace_id", "uuid", "fk -> workspaces.id"],
          ["stage", "varchar(40)", "idx"],
          ["arr_cents", "bigint", "not null"],
        ],
        ddl: `CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title varchar(180) NOT NULL,
  stage varchar(40) NOT NULL DEFAULT 'discovery',
  arr_cents bigint NOT NULL DEFAULT 0
);
CREATE INDEX idx_deals_ws_stage ON deals(workspace_id, stage);`,
      },
      {
        name: "audit_events",
        refs: ["workspaces", "deals"],
        cols: [
          ["id", "uuid", "pk"],
          ["workspace_id", "uuid", "fk -> workspaces.id"],
          ["deal_id", "uuid", "fk -> deals.id"],
          ["action", "varchar(80)", "not null"],
        ],
        ddl: `CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  action varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`,
      },
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/w/:wid/deals",
        role: "member",
        rate: "120/m",
        desc: "List pipeline scoped strictly to tenant workspace_id",
        req: "// Header: Cookie access_token; Tenant guard checks memberships",
        res: '{ "stages": { "discovery": [{ "id": "uuid", "arr_cents": 2400000 }] } }',
      },
      {
        method: "POST",
        path: "/api/w/:wid/deals",
        role: "rep|admin",
        rate: "40/m",
        desc: "Insert deal & record immutable audit_events row",
        req: '{ "title": "Acme Enterprise Annual", "arr_cents": 4800000 }',
        res: '{ "id": "uuid", "stage": "discovery", "audit_id": "uuid" }',
      },
      {
        method: "PATCH",
        path: "/api/w/:wid/deals/:id",
        role: "rep|admin",
        rate: "60/m",
        desc: "Transition stage & recalculate weighted ARR forecast",
        req: '{ "stage": "negotiation" }',
        res: '{ "id": "uuid", "stage": "negotiation", "forecast_delta": 1920000 }',
      },
      {
        method: "POST",
        path: "/api/w/:wid/invites",
        role: "owner|admin",
        rate: "15/m",
        desc: "Enforce seat_limit & issue signed invite token",
        req: '{ "email": "ae@company.com", "role": "rep" }',
        res: '{ "invite_id": "uuid", "seats_used": 4, "seat_limit": 10 }',
      },
      {
        method: "POST",
        path: "/api/billing/webhook",
        role: "hmac-sha256",
        rate: "200/m",
        desc: "Sync Lemon Squeezy subscription seats idempotently",
        req: '{ "meta": { "event_name": "subscription_updated" }, "data": { "id": "sub_1" } }',
        res: '{ "received": true, "plan": "team", "seat_limit": 10 }',
      },
    ],
    svgNodes: [
      { id: "web", x: 24, y: 84, w: 132, label: "spa_workspace", sub: "React 19", latency: "10ms", role: "Optimistic kanban board & keyboard command palette." },
      { id: "api", x: 196, y: 34, w: 138, label: "tenant_api", sub: "RBAC Guard", latency: "5ms", role: "Enforces workspace_id isolation on every query." },
      { id: "hook", x: 196, y: 134, w: 138, label: "billing_hook", sub: "Lemon Squeezy", latency: "3ms", role: "HMAC-SHA256 webhook handler updating seat quotas." },
      { id: "db", x: 374, y: 34, w: 132, label: "postgres_rls", sub: "workspace_id", latency: "1.5ms", role: "Composite tenant indexes & transactional audit ledger." },
      { id: "mail", x: 374, y: 134, w: 132, label: "mail_queue", sub: "Invite tokens", latency: "18ms", role: "Dispatches signed team invites & renewal receipts." },
    ],
    svgEdges: [
      { d: "M156 106 C 178 106, 174 56, 196 56", dur: "1.9s" },
      { d: "M334 56 C 354 56, 354 56, 374 56", dur: "1.5s" },
      { d: "M334 156 C 354 156, 354 56, 374 56", dur: "2.3s" },
      { d: "M334 56 C 354 56, 354 156, 374 156", dur: "2.1s" },
    ],
  },
  {
    id: "caresync",
    slug: "clinic-scheduling",
    label: "Clinic scheduling",
    prompt:
      "Outpatient booking platform with conflict-free practitioner time slots, WebRTC visit rooms, and signed clinical notes.",
    routed: [
      { target: "schema", tab: "schema", count: "4 tables · 3 FKs", threshold: 0.25 },
      { target: "api", tab: "api", count: "5 endpoints", threshold: 0.5 },
      { target: "architecture", tab: "arch", count: "5 nodes · 4 edges", threshold: 0.75 },
      { target: "docs/", tab: "docs", count: "01..09.md", threshold: 0.95 },
    ],
    tables: [
      {
        name: "practitioners",
        refs: [],
        cols: [
          ["id", "uuid", "pk"],
          ["specialty", "varchar(120)", "idx"],
          ["tz", "varchar(64)", "not null"],
        ],
        ddl: `CREATE TABLE practitioners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty varchar(120) NOT NULL,
  tz varchar(64) NOT NULL DEFAULT 'UTC'
);`,
      },
      {
        name: "patients",
        refs: [],
        cols: [
          ["id", "uuid", "pk"],
          ["dob", "date", "not null"],
          ["consented_at", "timestamptz", "nullable"],
        ],
        ddl: `CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dob date NOT NULL,
  consented_at timestamptz
);`,
      },
      {
        name: "appointments",
        refs: ["practitioners", "patients"],
        cols: [
          ["id", "uuid", "pk"],
          ["practitioner_id", "uuid", "fk -> practitioners.id"],
          ["patient_id", "uuid", "fk -> patients.id"],
          ["starts_at", "timestamptz", "unique(prac,starts)"],
        ],
        ddl: `CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id),
  patient_id uuid NOT NULL REFERENCES patients(id),
  starts_at timestamptz NOT NULL,
  CONSTRAINT uq_practitioner_slot UNIQUE (practitioner_id, starts_at)
);`,
      },
      {
        name: "visit_notes",
        refs: ["appointments"],
        cols: [
          ["id", "uuid", "pk"],
          ["appointment_id", "uuid", "fk -> appointments.id"],
          ["ciphertext", "text", "not null"],
          ["signed_at", "timestamptz", "nullable"],
        ],
        ddl: `CREATE TABLE visit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  signed_at timestamptz
);`,
      },
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/practitioners/:id/slots",
        role: "patient",
        rate: "90/m",
        desc: "Compute open 30m windows in caller timezone",
        req: "// Query: ?from=2026-11-01&to=2026-11-07&tz=Asia/Phnom_Penh",
        res: '{ "open_slots": ["2026-11-02T09:00:00+07:00", "2026-11-02T09:30:00+07:00"] }',
      },
      {
        method: "POST",
        path: "/api/appointments",
        role: "patient",
        rate: "20/m",
        desc: "Book slot atomically under unique constraint",
        req: '{ "practitioner_id": "uuid", "starts_at": "2026-11-02T09:00:00+07:00" }',
        res: '{ "appointment_id": "uuid", "status": "confirmed" }',
      },
      {
        method: "POST",
        path: "/api/appointments/:id/token",
        role: "doctor|patient",
        rate: "30/m",
        desc: "Issue short-lived WebRTC room credential",
        req: '{ "device_audio": true, "device_video": true }',
        res: '{ "turn_token": "eyJhbGci...", "ttl_seconds": 3600 }',
      },
      {
        method: "POST",
        path: "/api/appointments/:id/notes",
        role: "doctor",
        rate: "30/m",
        desc: "Seal encrypted SOAP clinical summary",
        req: '{ "ciphertext": "aes256gcm:9a81f...", "sign": true }',
        res: '{ "note_id": "uuid", "signed_at": "2026-11-02T09:31:12Z" }',
      },
      {
        method: "DELETE",
        path: "/api/appointments/:id",
        role: "patient",
        rate: "15/m",
        desc: "Release practitioner slot > 24h before visit",
        req: '{ "reason": "reschedule" }',
        res: '{ "cancelled": true, "slot_released": true }',
      },
    ],
    svgNodes: [
      { id: "web", x: 24, y: 84, w: 132, label: "portal_web", sub: "Patient / MD", latency: "11ms", role: "Timezone-aware slot picker & encrypted video room." },
      { id: "api", x: 196, y: 34, w: 138, label: "booking_api", sub: "Slot engine", latency: "5ms", role: "Conflict-free scheduling & consent verification." },
      { id: "rtc", x: 196, y: 134, w: 138, label: "turn_signaler", sub: "WebRTC rooms", latency: "7ms", role: "Ephemeral session tokens for peer-to-peer consultation." },
      { id: "db", x: 374, y: 34, w: 132, label: "clinical_pg", sub: "Encrypted notes", latency: "1.9ms", role: "Unique slot constraints & ciphertext storage." },
      { id: "cron", x: 374, y: 134, w: 132, label: "reminder_cron", sub: "24h SMS/Email", latency: "15ms", role: "Scheduled pre-visit reminders & no-show reduction." },
    ],
    svgEdges: [
      { d: "M156 106 C 178 106, 174 56, 196 56", dur: "2.0s" },
      { d: "M156 106 C 178 106, 174 156, 196 156", dur: "2.5s" },
      { d: "M334 56 C 354 56, 354 56, 374 56", dur: "1.6s" },
      { d: "M334 56 C 354 56, 354 156, 374 156", dur: "2.2s" },
    ],
  },
];

const MD_SPEC_TREE = [
  ["01-brief.md", "Problem statement, target personas, MVP scope boundaries & explicit non-goals.", "## MVP Boundary\n- Single-region launch\n- Idempotent payment settlement\n- Explicit non-goal: native iOS build in v1"],
  ["02-requirements.md", "Functional specs, role permissions, auth model & latency SLAs.", "## Non-Functional SLAs\n- P95 read latency < 80ms\n- HttpOnly JWT cookie rotation\n- Zero client-trusted payment redirects"],
  ["03-features.md", "P0/P1 features broken into user stories & testable acceptance criteria.", "## P0 Feature: Checkout Settlement\n- GIVEN an unpaid cart\n- WHEN webhook HMAC verifies\n- THEN transition status -> confirmed atomically"],
  ["04-architecture.md", "Service nodes, protocols, deployment targets & trade-off rationale.", "## Topology Rationale\n- Modular monolith API before microservices\n- Single primary PostgreSQL 16 instance\n- Dedicated webhook signature middleware"],
  ["05-database-schema.md", "Normalized entities, field types, composite indexes & cascade rules.", "## Foreign Key Discipline\n- All tenant child rows enforce ON DELETE CASCADE\n- Monetary values stored as integer cents\n- Timestamps in UTC timestamptz"],
  ["06-api-contracts.md", "HTTP methods, paths, request/response JSON schemas & error codes.", "## Error Envelope\n- 401 Not Authenticated\n- 403 Tier Quota Reached\n- 422 Schema Validation Failed"],
  ["07-roadmap.md", "Dependency-ordered vertical slice milestones linked directly to entities.", "## Vertical Slice Order\n- M1: Schema migration & seed\n- M2: Auth & tenant session guard\n- M3: Core resource CRUD + E2E smoke test"],
  ["08-decisions.md", "Chronological ADR log of approvals, trade-offs & schema mutations.", "## ADR-004: Integer Cents over Float\n- Status: Approved v2\n- Eliminates IEEE-754 rounding drift in ledger totals"],
  ["09-architect-notes.md", "Scoped implementation rules formatted for Cursor / Claude Code / agents.", "## Agent Context Rules\n- Read 05-database-schema.md before writing queries\n- Preserve idempotency check in processed_webhooks"],
];

const CAPABILITIES = [
  {
    idx: "01",
    title: "Module-routing chat",
    body: "Describe an idea or ask for a change (`Ctrl+J`). Tables land in the database panel, routes in API Explorer, and tasks in Roadmap—never one giant chat blob.",
    meta: "server/aiArchitect.js -> 12 artifact targets",
  },
  {
    idx: "02",
    title: "Relational ERD & linter",
    body: "Inspect entities on an interactive canvas, wire foreign keys, and run structural validation for missing primary keys, orphan references, or type mismatches.",
    meta: "Visual canvas + schema validator",
  },
  {
    idx: "03",
    title: "Downstream impact flags",
    body: "When an approved schema or requirement mutates, Formora traces entity references and flags affected API endpoints and roadmap tasks as needing review.",
    meta: "Versioned v1 -> v2 diff tracking",
  },
  {
    idx: "04",
    title: "SQL & Prisma compilers",
    body: "Compile your current visual schema directly into runnable PostgreSQL `CREATE TABLE` DDL or a `schema.prisma` file without manual translation.",
    meta: "Exports .sql + schema.prisma",
  },
  {
    idx: "05",
    title: "Fourteen separated .md specs",
    body: "Export `01-brief.md` through `14-deployment-guide.md` individually or together so coding agents read only the exact slice they are implementing.",
    meta: "docs/01..14.md GFM bundle",
  },
  {
    idx: "06",
    title: "Optional BYOK LLM",
    body: "Works out of the box with zero API keys using our deterministic domain parser, or connect your own Gemini or OpenAI key per browser session.",
    meta: "Zero-config + Gemini / OpenAI",
  },
];

const FAQS = [
  {
    q: "Why not just ask ChatGPT or Claude for a `plan.md`?",
    a: "A single 2,000-line markdown file has no referential integrity. The moment you rename a column or cut an MVP feature, the SQL section, API payloads, and task list contradict each other. Formora stores each layer as a typed, versioned artifact and regenerates clean `.sql`, `.prisma`, and separated `.md` files from one source of truth.",
  },
  {
    q: "What do I actually check into my Git repository?",
    a: "Export `schema.sql` or `schema.prisma` for your database migrations, plus `01-brief.md` through `09-architect-notes.md` into your repo's `/docs` directory. Coding agents perform significantly better when you point them at `05-database-schema.md` + `06-api-contracts.md` rather than an entire chat transcript.",
  },
  {
    q: "Do I need to bring my own AI API key?",
    a: "No. Formora includes a built-in semantic architect that decomposes prompts into domain entities, endpoints, topology nodes, and milestones immediately. If you want custom LLM completions, you can optionally paste a Gemini or OpenAI key in the chat panel settings.",
  },
  {
    q: "What happens if I hit the 1-project limit on Starter?",
    a: "You can archive an existing project to free your active slot at $0, or upgrade to Pro ($19/mo or $190/yr) for unlimited active projects and DDL/Prisma exports.",
  },
  {
    q: "How are payments, VAT invoices, and cancellations handled?",
    a: "Lemon Squeezy acts as Merchant of Record, handling global tax/VAT calculation and receipts automatically. You can cancel in one click from `/billing`; all exported SQL, Prisma, and Markdown files are plain text and yours permanently.",
  },
];

const DEMO_TABS = [
  ["schema", "Database"],
  ["api", "API contracts"],
  ["arch", "Architecture"],
  ["docs", "Markdown specs"],
];

function CodeText({ text }) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="font-mono text-[11.5px] text-zinc-900 bg-zinc-100 px-1.5 py-0.5 rounded">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    )
  );
}

function RevealSection({ id, className = "", children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id={id} ref={ref} className={`reveal-block ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </section>
  );
}

export default function Landing() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Live demo: typed prompt -> artifacts placing (the hero interactive card)
  const [caseIdx, setCaseIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [typedChars, setTypedChars] = useState(0);

  // Pipeline chain (clickable in hero)
  const [pipeIdx, setPipeIdx] = useState(4);
  const [pipeAuto, setPipeAuto] = useState(true);

  // Interactive workbench
  const [tab, setTab] = useState("schema");
  const [focusedTableIdx, setFocusedTableIdx] = useState(2);
  const [expandedEpIdx, setExpandedEpIdx] = useState(1);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState(1);
  const [mdIdx, setMdIdx] = useState(4);
  const [copiedSql, setCopiedSql] = useState(false);

  // Rename-column impact stepper
  const [mutationStep, setMutationStep] = useState(0);
  const [mutationPaused, setMutationPaused] = useState(false);

  // Pricing & FAQ
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const activeCase = WORKBENCH_CASES[caseIdx];
  const fullPrompt = activeCase.prompt;
  const streamProgress = fullPrompt.length > 0 ? typedChars / fullPrompt.length : 1;

  useEffect(() => {
    setTypedChars(0);
    setFocusedTableIdx(2);
    setExpandedEpIdx(1);
    setSelectedNodeIdx(1);
  }, [caseIdx]);

  useEffect(() => {
    if (typedChars < fullPrompt.length) {
      const t = setTimeout(() => {
        setTypedChars((c) => Math.min(fullPrompt.length, c + 2));
      }, 22);
      return () => clearTimeout(t);
    }
    if (!autoPlay) return;
    const hold = setTimeout(() => {
      setCaseIdx((idx) => (idx + 1) % WORKBENCH_CASES.length);
    }, 4800);
    return () => clearTimeout(hold);
  }, [typedChars, fullPrompt.length, autoPlay]);

  useEffect(() => {
    if (!pipeAuto) return;
    const iv = setInterval(() => {
      setPipeIdx((p) => (p + 1) % PIPELINE.length);
    }, 2200);
    return () => clearInterval(iv);
  }, [pipeAuto]);

  useEffect(() => {
    if (mutationPaused) return;
    const iv = setInterval(() => {
      setMutationStep((s) => (s + 1) % 3);
    }, 3000);
    return () => clearInterval(iv);
  }, [mutationPaused]);

  const jumpToWorkbench = (tabId) => {
    setTab(tabId);
    document.getElementById("workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyDdl = () => {
    const sqlText = activeCase.tables[focusedTableIdx]?.ddl || "";
    navigator.clipboard?.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 1800);
  };

  const selectPlan = (planKey) => {
    if (user) {
      navigate(planKey === "free" ? "/dashboard" : "/billing");
      return;
    }
    if (planKey === "free") {
      navigate("/login?mode=register");
    } else {
      navigate(`/login?mode=register&plan=${planKey}&interval=${annual ? "yearly" : "monthly"}`);
    }
  };

  const activeTable = activeCase.tables[focusedTableIdx] || activeCase.tables[0];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-zinc-900 antialiased">
      {/* Header — graphite chrome bar matching the login panel */}
      <header className="sticky top-0 z-40 border-b border-[#27272a] bg-[#09090b]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2" data-testid="landing-logo">
              <div className="grid h-6 w-6 place-items-center rounded-[5px] bg-white">
                <div className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-zinc-900" />
              </div>
              <span className="text-[14px] font-semibold tracking-tight text-white">Formora</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 font-mono text-[12px] text-[#a1a1aa]">
              <a href="#workbench" className="hover:text-white transition-colors">Live demo</a>
              <a href="#problem" className="hover:text-white transition-colors">Why Formora</a>
              <a href="#specs" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Button size="sm" className="h-8 text-xs bg-white text-zinc-900 hover:bg-zinc-200" onClick={() => navigate("/dashboard")} data-testid="landing-open-dashboard-btn">
                Open workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 font-mono text-[12px] text-[#a1a1aa] hover:text-white transition-colors"
                  data-testid="landing-signin-btn"
                >
                  Sign in
                </Link>
                <Button
                  size="sm"
                  onClick={() => navigate("/login?mode=register")}
                  className="h-8 bg-white text-zinc-900 hover:bg-zinc-200 text-xs font-medium"
                  data-testid="landing-get-started-btn"
                >
                  Start free
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-md text-white"
              aria-label="Toggle menu"
              data-testid="landing-mobile-menu-btn"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-b border-zinc-200 bg-white px-4 py-4 space-y-3 md:hidden">
            <div className="flex flex-col space-y-2 text-sm text-zinc-500">
              <a href="#workbench" onClick={() => setMobileOpen(false)} className="py-1.5">Live demo</a>
              <a href="#problem" onClick={() => setMobileOpen(false)} className="py-1.5">Why Formora</a>
              <a href="#specs" onClick={() => setMobileOpen(false)} className="py-1.5">Features</a>
              <a href="#pricing" onClick={() => setMobileOpen(false)} className="py-1.5">Pricing</a>
              <a href="#faq" onClick={() => setMobileOpen(false)} className="py-1.5">FAQ</a>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200">
              {user ? (
                <Button onClick={() => navigate("/dashboard")} className="w-full h-10">Open workspace</Button>
              ) : (
                <>
                  <Button onClick={() => navigate("/login?mode=register")} className="w-full h-10 bg-foreground text-background">
                    Start free
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/login")} className="w-full h-10">
                    Sign in
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero: cinematic video band — graphite, like the login visual panel */}
        <section className="relative overflow-hidden bg-[#09090b] border-b border-[#27272a]">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={klingHero}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
          <div className="absolute inset-0 bg-[#09090b]/70" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#09090b]/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#09090b] to-transparent" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Copy */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#27272a] bg-[#111113] px-3 py-1 text-[12px] text-[#a1a1aa]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-white" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                One prompt, every linked artifact
              </div>

              <h1
                className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-white"
                data-testid="landing-hero-title"
              >
                Decide before you build.
                <span className="block text-[#a1a1aa] font-normal mt-2">
                  Not inside one 2,000-line AI markdown file.
                </span>
              </h1>

              <p className="text-[15px] text-[#a1a1aa] max-w-lg leading-relaxed">
                Describe your software in plain English. Formora decomposes your prompt live into a relational ERD,
                REST contracts, a service topology graph, and nine separated{" "}
                <code className="font-mono text-xs text-white bg-[#18181b] border border-[#27272a] px-1.5 py-0.5 rounded">.md</code> specs —
                plus runnable PostgreSQL & Prisma schemas.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  onClick={() => navigate(user ? "/dashboard" : "/login?mode=register")}
                  className="h-10 px-5 bg-white text-zinc-900 hover:bg-zinc-200 text-[13px] font-medium group apple-spring"
                  data-testid="hero-start-free-btn"
                >
                  <span>{user ? "Open workspace" : "Start a blueprint — free"}</span>
                  <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>

                <a
                  href="#workbench"
                  className="inline-flex h-10 items-center justify-center rounded-md px-4 text-[13px] text-[#a1a1aa] hover:text-white transition-colors"
                  data-testid="hero-explore-workbench-btn"
                >
                  See the live demo
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </div>

              {/* Artifact pipeline (interactive) */}
              <div className="pt-6 mt-2 rounded-xl border border-[#27272a] bg-[#111113] p-5 space-y-3 max-w-lg">
                <div className="flex items-center justify-between font-mono text-[11px] text-[#71717a]">
                  <span>Artifact pipeline</span>
                  <span className="tabular-nums">
                    stage {String(pipeIdx + 1).padStart(2, "0")} of {PIPELINE.length}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {PIPELINE.map((stage, i) => {
                    const active = pipeIdx === i;
                    return (
                      <span key={stage.id} className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPipeIdx(i);
                            setPipeAuto(false);
                          }}
                          className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
                            active
                              ? "bg-white text-zinc-900 font-medium"
                              : "bg-[#18181b] text-[#a1a1aa] hover:text-white"
                          }`}
                        >
                          {stage.label}
                        </button>
                        {i < PIPELINE.length - 1 && (
                          <span className={`text-[10px] ${i < pipeIdx ? "text-white" : "text-[#3f3f46]"}`}>›</span>
                        )}
                      </span>
                    );
                  })}
                </div>

                <p className="text-[13px] text-[#a1a1aa] min-h-[20px]">
                  <span className="text-white font-medium">{PIPELINE[pipeIdx].label}. </span>
                  {PIPELINE[pipeIdx].detail}
                </p>
              </div>
            </div>

            {/* Live demo card (browser frame) */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-[#27272a] bg-[#111113] overflow-hidden">
                {/* Window bar */}
                <div className="flex items-center gap-2 border-b border-[#27272a] px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#3f3f46]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#3f3f46]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#3f3f46]" />
                  </div>
                  <span className="mx-auto font-mono text-[11px] text-[#71717a]">
                    formora · new blueprint
                  </span>
                  <button
                    type="button"
                    onClick={() => setAutoPlay((v) => !v)}
                    className="grid h-6 w-6 place-items-center rounded-md text-[#a1a1aa] hover:bg-[#18181b] hover:text-white transition-colors"
                    aria-label={autoPlay ? "Pause demo" : "Resume demo"}
                  >
                    {autoPlay ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  {/* Scenario chips */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {WORKBENCH_CASES.map((c, idx) => {
                      const isCurrent = caseIdx === idx;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCaseIdx(idx);
                            setTypedChars(c.prompt.length);
                            setAutoPlay(false);
                          }}
                          data-testid={`hero-scenario-${c.id}`}
                          className={`relative overflow-hidden rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                            isCurrent
                              ? "border-transparent bg-white text-zinc-900"
                              : "border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-white"
                          }`}
                        >
                          <span className="block truncate">{c.label}</span>
                          {isCurrent && (
                            <span
                              className="absolute bottom-0 left-0 h-[2px] bg-zinc-900 transition-[width] duration-100"
                              style={{ width: `${Math.round(streamProgress * 100)}%` }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Typing prompt */}
                  <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-3.5 min-h-[92px]">
                    <div className="flex items-center justify-between font-mono text-[11px] text-[#71717a] mb-1.5">
                      <span className="font-medium">Your prompt</span>
                      <span className="tabular-nums">
                        {typedChars}/{fullPrompt.length}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-[#e4e4e7]">
                      <span>&ldquo;{fullPrompt.slice(0, typedChars)}</span>
                      {typedChars < fullPrompt.length ? (
                        <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-white animate-cursor-blink" />
                      ) : (
                        <span>&rdquo;</span>
                      )}
                    </p>
                  </div>

                  {/* Placing artifacts */}
                  <div>
                    <div className="font-mono text-[11px] text-[#71717a] mb-2">
                      Artifacts being generated
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {activeCase.routed.map((r) => {
                        const placed = streamProgress >= r.threshold;
                        return (
                          <button
                            key={r.target}
                            type="button"
                            onClick={() => jumpToWorkbench(r.tab)}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                              placed
                                ? "border-[#52525b] bg-[#18181b] text-white"
                                : "border-[#27272a] bg-transparent text-[#52525b]"
                            }`}
                          >
                            <span className="font-medium truncate">
                              {r.target === "docs/" ? "Markdown specs" : r.target === "architecture" ? "Architecture" : r.target === "schema" ? "Database" : "API contracts"}
                            </span>
                            {placed ? (
                              <span className="flex items-center gap-1 shrink-0">
                                <Check className="h-3.5 w-3.5" />
                                <span className="font-mono text-[10.5px] hidden sm:inline">{r.count}</span>
                                <span className="font-mono text-[10.5px] sm:hidden">done</span>
                              </span>
                            ) : (
                              <span className="font-mono text-[10.5px] shrink-0">generating</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#27272a] px-4 py-2.5 font-mono text-[11px] text-[#71717a]">
                  <span>Click an artifact to inspect it below</span>
                  <span>PostgreSQL 16 · Prisma</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product render — framed workspace on a light page */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
          <div className="rounded-2xl border border-[#27272a] bg-[#0e0e10] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] overflow-hidden">
            {/* window bar */}
            <div className="flex items-center gap-2 border-b border-[#27272a] px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#3f3f46]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#3f3f46]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#3f3f46]" />
              </div>
              <span className="mx-auto font-mono text-[11px] text-[#71717a]">
                Formora — FoodFlow blueprint
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#18181b] px-2.5 py-0.5 text-[10px] font-medium text-[#34d399]">
                <Check className="h-3 w-3" /> all artifacts approved
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[190px_1fr_260px]">
              {/* sidebar */}
              <div className="hidden md:flex flex-col border-r border-[#27272a] bg-[#0d0d0f] p-3 space-y-1">
                <div className="flex items-center gap-2 px-2 py-2">
                  <div className="grid h-5 w-5 place-items-center rounded bg-white text-[9px] font-semibold text-zinc-900">FF</div>
                  <div className="text-xs font-medium truncate text-white">FoodFlow</div>
                </div>
                {[
                  [MessageSquare, "Architect chat", true],
                  [Database, "Database", false],
                  [Network, "Architecture", false],
                  [ListChecks, "Roadmap", false],
                  [FileText, "Specs", false],
                ].map(([Icon, label, active]) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs ${
                      active ? "bg-[#18181b] text-white font-medium" : "text-[#a1a1aa]"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-[#71717a]"}`} />
                    {label}
                  </div>
                ))}

                <div className="mt-auto rounded-lg bg-[#18181b] p-2.5 space-y-1.5">
                  <div className="text-[10px] font-medium text-white">Spec bundle</div>
                  <div className="font-mono text-[10px] text-[#71717a]">09 files ready</div>
                  <div className="h-1.5 rounded-full bg-[#3f3f46]">
                    <div className="h-full w-full rounded-full bg-white" />
                  </div>
                </div>
              </div>

              {/* ERD canvas */}
              <div className="relative min-h-[300px]">
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(#27272a 1px, transparent 1px), linear-gradient(90deg, #27272a 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                  }}
                />
                <svg viewBox="0 0 560 300" className="absolute inset-0 h-full w-full" aria-hidden>
                  <path d="M150 90 C 200 90, 210 150, 260 150" fill="none" stroke="#a1a1aa" strokeOpacity="0.6" strokeWidth="1.25" strokeDasharray="4 4" className="animate-dash-flow" />
                  <path d="M260 190 C 210 190, 200 120, 150 120" fill="none" stroke="#3f3f46" strokeWidth="1.25" strokeDasharray="4 4" />
                  <path d="M370 150 C 420 150, 430 210, 470 210" fill="none" stroke="#a1a1aa" strokeOpacity="0.6" strokeWidth="1.25" strokeDasharray="4 4" className="animate-dash-flow" />
                  <circle r="2.5" fill="#e4e4e7">
                    <animateMotion dur="2.4s" repeatCount="indefinite" path="M150 90 C 200 90, 210 150, 260 150" />
                  </circle>

                  {[
                    { x: 30, y: 70, name: "users", rows: ["id uuid pk", "email varchar", "role varchar"] },
                    { x: 260, y: 120, name: "orders", rows: ["id uuid pk", "customer_id fk", "total_cents int"] },
                    { x: 400, y: 60, name: "restaurants", rows: ["id uuid pk", "owner_id fk", "is_open bool"] },
                  ].map((tb) => (
                    <g key={tb.name}>
                      <rect x={tb.x} y={tb.y} width="130" height={46 + tb.rows.length * 14} rx="8" fill="#111113" stroke={tb.name === "orders" ? "#a1a1aa" : "#3f3f46"} />
                      <text x={tb.x + 10} y={tb.y + 20} fontSize="11" fontWeight="600" fontFamily="JetBrains Mono" fill="#e4e4e7">
                        {tb.name}
                      </text>
                      {tb.rows.map((row, ri) => (
                        <text key={row} x={tb.x + 10} y={tb.y + 38 + ri * 14} fontSize="9.5" fontFamily="JetBrains Mono" fill="#71717a">
                          {row}
                        </text>
                      ))}
                    </g>
                  ))}

                  {/* chat bubble */}
                  <g>
                    <rect x="150" y="238" width="300" height="44" rx="10" fill="#111113" stroke="#3f3f46" />
                    <circle cx="172" cy="260" r="4" fill="#34d399" />
                    <text x="184" y="256" fontSize="10" fontFamily="JetBrains Mono" fill="#a1a1aa">
                      "add tip field to orders"
                    </text>
                    <text x="184" y="270" fontSize="9.5" fontFamily="JetBrains Mono" fill="#34d399">
                      → orders updated · 1 endpoint · 1 task flagged
                    </text>
                  </g>
                </svg>
              </div>

              {/* right: generated SQL */}
              <div className="hidden md:flex flex-col justify-between border-l border-[#27272a] bg-[#0d0d0f] p-3.5">
                <div className="space-y-2">
                  <div className="font-mono text-[10px] text-[#71717a]">05_schema.sql</div>
                  <pre className="rounded-lg bg-[#18181b] p-3 font-mono text-[10px] leading-relaxed overflow-hidden text-[#e4e4e7]">
                    <code>{`ALTER TABLE orders
  ADD COLUMN tip_cents
    integer NOT NULL
    DEFAULT 0 CHECK (tip_cents >= 0);

CREATE INDEX
  idx_orders_status
  ON orders(status);`}</code>
                  </pre>
                </div>
                <div className="space-y-1.5">
                  {[["05-database-schema.md", "updated"], ["06-api-contracts.md", "updated"], ["07-roadmap.md", "1 flag"]].map(([f, s]) => (
                    <div key={f} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-[#71717a]">{f}</span>
                      <span className={s === "1 flag" ? "text-[#f59e0b]" : "text-[#34d399]"}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-zinc-500">
            The actual workspace — chat on the left, entities linked to routes and tasks, code you can copy
          </p>
        </section>

        {/* § 01 / Live workbench — light zone */}
        <RevealSection id="workbench" className="scroll-mt-14 border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="mb-8 sm:flex sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-zinc-500 mb-2">Live demo</p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Try the artifacts the same way you&apos;ll read them in a repo
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 mt-4 sm:mt-0 font-mono text-xs text-zinc-500">
                example: {activeCase.slug}
              </span>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit">
              {DEMO_TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  data-testid={`preview-tab-${id}`}
                  className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    tab === id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Panel */}
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              {/* TAB: schema */}
              {tab === "schema" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
                  <div className="lg:col-span-7 p-6 sm:p-8 space-y-4">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>Hover any table to trace foreign keys and compile its DDL</span>
                      <span>{activeCase.tables.length} tables</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeCase.tables.map((t, idx) => {
                        const isFocused = focusedTableIdx === idx;
                        const isReferencedByFocused = activeTable.refs?.includes(t.name);
                        const referencesFocused = t.refs?.includes(activeTable.name);
                        const isLinked = isReferencedByFocused || referencesFocused;

                        return (
                          <div
                            key={t.name}
                            onMouseEnter={() => setFocusedTableIdx(idx)}
                            onClick={() => setFocusedTableIdx(idx)}
                            className={`cursor-pointer rounded-xl border bg-white transition-all duration-200 ${
                              isFocused
                                ? "border-zinc-900 shadow-sm"
                                : isLinked
                                ? "border-zinc-300"
                                : "border-zinc-200 opacity-80 hover:opacity-100"
                            }`}
                          >
                            <div className="flex items-center justify-between px-3.5 py-2 border-b border-zinc-200 bg-zinc-50 rounded-t-xl font-mono text-xs">
                              <span className="font-semibold text-zinc-900">{t.name}</span>
                              <span className="text-[10px] text-zinc-500">
                                {isFocused
                                  ? "selected"
                                  : isReferencedByFocused
                                  ? "referenced"
                                  : referencesFocused
                                  ? "child"
                                  : "table"}
                              </span>
                            </div>
                            <div className="divide-y divide-zinc-100 font-mono text-[11px]">
                              {t.cols.map(([name, type, constraint]) => (
                                <div key={name} className="flex items-center justify-between gap-2 px-3.5 py-1.5">
                                  <span className="text-zinc-900">{name}</span>
                                  <span className="text-zinc-500">
                                    {type}{" "}
                                    <span className="text-[10px] text-zinc-600">{constraint}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between gap-4 bg-zinc-50/60">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span className="font-mono">{activeTable.name}.sql</span>
                        <span className="inline-flex items-center gap-2 font-medium text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 0 lint errors
                        </span>
                      </div>

                      <pre
                        key={`${activeCase.id}-${activeTable.name}`}
                        className="rounded-xl bg-zinc-900 text-zinc-100 p-4 font-mono text-xs leading-relaxed overflow-x-auto fade-up"
                      >
                        <code>
                          {activeTable.ddl.split("\n").map((line, i) => (
                            <div key={i} className="flex">
                              <span className="w-7 select-none opacity-40">{String(i + 1).padStart(2, "0")}</span>
                              <span>{line}</span>
                            </div>
                          ))}
                        </code>
                      </pre>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-200 text-xs text-zinc-500">
                      <span className="truncate">
                        Foreign keys: {activeTable.refs.length ? activeTable.refs.join(", ") : "root entity"}
                      </span>
                      <button
                        type="button"
                        onClick={copyDdl}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-900 hover:bg-zinc-100 transition-colors"
                      >
                        {copiedSql ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedSql ? "Copied" : "Copy SQL"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: api */}
              {tab === "api" && (
                <div className="divide-y divide-zinc-200">
                  <div className="flex items-center justify-between px-6 py-3 bg-zinc-50 text-xs text-zinc-500">
                    <span>Click a route to inspect its JSON request &amp; response contract</span>
                    <span>{activeCase.endpoints.length} routes</span>
                  </div>
                  {activeCase.endpoints.map((ep, idx) => {
                    const isExpanded = expandedEpIdx === idx;
                    return (
                      <div key={`${ep.method}-${ep.path}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedEpIdx(isExpanded ? -1 : idx)}
                          className="w-full px-6 py-3.5 text-left grid grid-cols-12 items-center gap-3 hover:bg-zinc-50 transition-colors text-xs"
                        >
                          <span className="col-span-2 sm:col-span-1 font-mono font-semibold text-zinc-900">
                            {ep.method}
                          </span>
                          <span className="col-span-10 sm:col-span-4 font-mono text-zinc-900 truncate">
                            {ep.path}
                          </span>
                          <span className="col-span-6 sm:col-span-2 font-mono text-zinc-500">
                            {ep.role}
                          </span>
                          <span className="col-span-4 sm:col-span-1 font-mono text-zinc-500">
                            {ep.rate}
                          </span>
                          <span className="col-span-12 sm:col-span-4 text-zinc-500 flex items-center justify-between gap-2">
                            <span className="truncate">{ep.desc}</span>
                            <span className={`font-mono transition-transform duration-200 ${isExpanded ? "rotate-45" : ""}`}>+</span>
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-6 pb-4 pt-1 bg-zinc-50 fade-up">
                            <div className="rounded-xl bg-zinc-900 p-3.5 font-mono text-[11px] text-zinc-100 overflow-x-auto">
                              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Request</div>
                              <code>{ep.req}</code>
                            </div>
                            <div className="rounded-xl bg-zinc-900 p-3.5 font-mono text-[11px] text-zinc-100 overflow-x-auto">
                              <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Response</div>
                              <code>{ep.res}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB: arch */}
              {tab === "arch" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
                  <div
                    className="lg:col-span-8 p-6 sm:p-8 relative"
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "linear-gradient(#e4e4e7 1px, transparent 1px), linear-gradient(90deg, #e4e4e7 1px, transparent 1px)",
                        backgroundSize: "32px 32px",
                      }}
                    />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4 text-xs text-zinc-500">
                        <span>Click a service to see what it does</span>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> live packets
                        </span>
                      </div>

                      <svg viewBox="0 0 530 210" className="w-full max-w-[580px] mx-auto" aria-label="System topology schematic">
                        {activeCase.svgEdges.map((edge, idx) => (
                          <g key={idx}>
                            <path
                              d={edge.d}
                              stroke="#52525b"
                              strokeOpacity="0.6"
                              strokeWidth="1.25"
                              fill="none"
                              strokeDasharray="4 4"
                              className="animate-dash-flow"
                            />
                            <circle r="3" fill="#18181b">
                              <animateMotion dur={edge.dur} repeatCount="indefinite" path={edge.d} />
                            </circle>
                          </g>
                        ))}

                        {activeCase.svgNodes.map((n, idx) => {
                          const selected = selectedNodeIdx === idx;
                          return (
                            <g
                              key={n.label}
                              onClick={() => setSelectedNodeIdx(idx)}
                              className="cursor-pointer"
                            >
                              <rect
                                x={n.x}
                                y={n.y}
                                width={n.w}
                                height="50"
                                rx="8"
                                fill="#ffffff"
                                stroke={selected ? "#18181b" : "#e4e4e7"}
                                strokeWidth={selected ? "1.5" : "1"}
                              />
                              <circle
                                cx={n.x + n.w - 14}
                                cy={n.y + 15}
                                r="2.5"
                                fill={selected ? "#10b981" : "#a1a1aa"}
                              />
                              <text x={n.x + 12} y={n.y + 21} fontSize="11.5" fontFamily="JetBrains Mono" fill="#18181b">
                                {n.label}
                              </text>
                              <text x={n.x + 12} y={n.y + 38} fontSize="10" fontFamily="JetBrains Mono" fill="#71717a">
                                {n.sub} · {n.latency}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  <div key={selectedNodeIdx} className="relative lg:col-span-4 p-6 sm:p-8 flex flex-col justify-between gap-6 bg-white">
                    <div className="space-y-3 fade-up">
                      <div className="font-mono text-[11px] text-zinc-500">
                        p95 {activeCase.svgNodes[selectedNodeIdx]?.latency}
                      </div>
                      <h3 className="text-base font-semibold font-mono text-zinc-900">
                        {activeCase.svgNodes[selectedNodeIdx]?.label}
                      </h3>
                      <div className="text-xs font-medium text-zinc-600">
                        {activeCase.svgNodes[selectedNodeIdx]?.sub}
                      </div>
                      <p className="text-[13px] text-zinc-500 leading-relaxed pt-1">
                        {activeCase.svgNodes[selectedNodeIdx]?.role}
                      </p>
                    </div>

                    <div className="text-xs text-zinc-500 pt-4 border-t border-zinc-200">
                      Exports to PNG diagram &amp; <code className="font-mono text-[11px] bg-zinc-100 px-1 rounded">04-architecture.md</code>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: docs */}
              {tab === "docs" && (
                <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-zinc-200">
                  <div className="md:col-span-5 divide-y divide-zinc-100 bg-white">
                    {MD_SPEC_TREE.map(([filename], idx) => (
                      <button
                        key={filename}
                        type="button"
                        onClick={() => setMdIdx(idx)}
                        className={`w-full px-6 py-2.5 text-left font-mono text-xs flex items-center justify-between transition-colors ${
                          mdIdx === idx
                            ? "bg-zinc-900 text-white font-medium"
                            : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                        }`}
                      >
                        <span>docs/{filename}</span>
                        <span className="text-[10px] opacity-75">v1</span>
                      </button>
                    ))}
                  </div>
                  <div key={mdIdx} className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-5 bg-white">
                    <div className="space-y-3 fade-up">
                      <div className="font-mono text-[11px] text-zinc-500">
                        docs/{MD_SPEC_TREE[mdIdx][0]} — module specification
                      </div>
                      <h3 className="text-lg font-semibold font-mono text-zinc-900">
                        {activeCase.slug} / {MD_SPEC_TREE[mdIdx][0].replace(".md", "")}
                      </h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        {MD_SPEC_TREE[mdIdx][1]}
                      </p>
                      <pre className="rounded-xl bg-zinc-900 text-zinc-100 p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                        <code>{MD_SPEC_TREE[mdIdx][2]}</code>
                      </pre>
                    </div>
                    <div className="text-sm text-zinc-500 pt-3 border-t border-zinc-200">
                      Coding agents read only the exact slice they need — no 2,000-line context dump.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </RevealSection>

        {/* § 02 / Rename-column impact demo — light zone */}
        <RevealSection id="problem" className="scroll-mt-14 border-b border-zinc-200 bg-[#f8fafc]">
          <div
            onMouseEnter={() => setMutationPaused(true)}
            onMouseLeave={() => setMutationPaused(false)}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
              <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="max-w-xl">
                  <p className="text-sm font-medium text-zinc-500 mb-2">Why Formora</p>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                    Watch what happens when you rename one database column
                  </h2>
                  <p className="mt-3 text-[15px] text-zinc-500 leading-relaxed">
                    The left side is the way most AI plans live today: one markdown file nobody re-checks. The right
                    side is Formora tracing the change through every linked artifact.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit">
                  {[
                    [0, "Approved"],
                    [1, "Rename column"],
                    [2, "Impact traced"],
                  ].map(([stepNum, label]) => (
                    <button
                      key={stepNum}
                      type="button"
                      onClick={() => {
                        setMutationStep(stepNum);
                        setMutationPaused(true);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                        mutationStep === stepNum
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: monolith markdown drift */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-zinc-500">plan_final_v4.md (1,840 lines)</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        mutationStep === 0
                          ? "bg-zinc-100 text-zinc-500"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {mutationStep === 0 ? "untracked text" : "Silent schema drift"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs space-y-3 leading-relaxed">
                    <div>
                      <div className="text-[10px] text-zinc-500">## Line 412 — Database</div>
                      <div className="text-zinc-900">
                        orders: id, user_id,{" "}
                        <span
                          className={`px-1 rounded transition-colors duration-300 ${
                            mutationStep >= 1 ? "bg-zinc-900 text-white font-semibold" : ""
                          }`}
                        >
                          {mutationStep >= 1 ? "total_cents" : "total_price"}
                        </span>
                        , status
                      </div>
                    </div>

                    <div className="border-t border-zinc-200 pt-3">
                      <div className="text-[10px] text-zinc-500">## Line 1,190 — API payload</div>
                      <div className="text-zinc-900">
                        POST /api/orders →{" "}
                        <span
                          className={`px-1 rounded transition-colors duration-300 ${
                            mutationStep >= 1 ? "bg-red-50 text-red-600 line-through" : ""
                          }`}
                        >
                          {'{ "total_price": 19.99 }'}
                        </span>
                      </div>
                      {mutationStep >= 1 && (
                        <div className="text-[11px] text-red-600 mt-1.5">
                          Line 1,190 never updated. Your coding agent ships a broken insert query.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Formora cascade */}
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-zinc-900">Formora linked artifact graph</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        mutationStep === 0
                          ? "bg-zinc-100 text-zinc-500"
                          : mutationStep === 1
                          ? "bg-zinc-900 text-white"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {mutationStep === 0
                        ? "v2 · approved"
                        : mutationStep === 1
                        ? "v2 → v3 updating"
                        : "2 dependents flagged"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs space-y-2.5">
                    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
                      <span className="text-zinc-900">
                        05_schema.orders.<b>{mutationStep >= 1 ? "total_cents" : "total_price"}</b>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-white">
                        {mutationStep === 0 ? "v2 approved" : "v3 updated"}
                      </span>
                    </div>

                    <div className="pl-4 flex items-center gap-2 font-mono text-[11px] text-zinc-500">
                      <span className={mutationStep >= 1 ? "text-amber-600" : ""}>↓</span>
                      <span>entity reference trace</span>
                    </div>

                    {[
                      ["06_api :: POST /api/orders", mutationStep === 2 ? "needs review" : "approved"],
                      ["07_roadmap :: Milestone 4 (Orders CRUD)", mutationStep === 2 ? "needs review" : "ready"],
                    ].map(([label, flag], ri) => (
                      <div
                        key={ri}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors duration-300 ${
                          mutationStep === 2
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-zinc-200 bg-white text-zinc-500"
                        }`}
                      >
                        <span>{label}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            mutationStep === 2
                              ? "bg-amber-100 text-amber-700"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {flag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* § 03 / Capabilities — light zone */}
        <RevealSection id="specs" className="scroll-mt-14 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="mb-8 max-w-xl">
              <p className="text-sm font-medium text-zinc-500 mb-2">Features</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Built like an engineering tool, not a slide deck
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CAPABILITIES.map((cap) => (
                <div
                  key={cap.idx}
                  className="rounded-2xl border border-zinc-200 bg-[#f8fafc] p-6 flex flex-col justify-between gap-6 hover:border-zinc-300 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="font-mono text-xs text-zinc-400">{cap.idx}</div>
                    <h3 className="text-base font-semibold tracking-tight text-zinc-900">{cap.title}</h3>
                    <p className="text-[13px] text-zinc-500 leading-relaxed">
                      <CodeText text={cap.body} />
                    </p>
                  </div>
                  <div className="pt-3 border-t border-zinc-200 font-mono text-[11px] text-zinc-500">
                    {cap.meta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* § 04 / Pricing — light zone */}
        <RevealSection id="pricing" className="scroll-mt-14 border-b border-zinc-200 bg-[#f8fafc]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="max-w-xl">
                <p className="text-sm font-medium text-zinc-500 mb-2">Pricing</p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  Free for one active project. Flat rate after.
                </h2>
              </div>

              <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm w-fit">
                <button
                  type="button"
                  onClick={() => setAnnual(false)}
                  data-testid="landing-billing-monthly"
                  className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
                    !annual ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setAnnual(true)}
                  data-testid="landing-billing-yearly"
                  className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
                    annual ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Annual · save 17%
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
              {[
                {
                  key: "starter",
                  name: "Starter",
                  hint: "Solo MVP",
                  price: "$0",
                  per: "forever",
                  testid: "pricing-starter-btn",
                  cta: "Start free",
                  primary: false,
                  features: [
                    "1 active blueprint project",
                    "All 9 visual & markdown panels",
                    "AI Architect module-routing chat",
                    "Individual .md file downloads",
                  ],
                },
                {
                  key: "pro",
                  name: "Pro",
                  hint: "Unlimited projects",
                  price: annual ? "$190" : "$19",
                  per: annual ? "/ year" : "/ month",
                  testid: "pricing-pro-btn",
                  cta: "Continue with Pro",
                  primary: true,
                  features: [
                    "Unlimited active blueprint projects",
                    "PostgreSQL .sql & Prisma codegen",
                    "Complete 9-file .md bundle export",
                    "Version history, diffs & archiving",
                  ],
                },
                {
                  key: "team",
                  name: "Team",
                  hint: "Up to 10 seats",
                  price: annual ? "$490" : "$49",
                  per: annual ? "/ year" : "/ month",
                  testid: "pricing-team-btn",
                  cta: "Continue with Team",
                  primary: false,
                  features: [
                    "Everything in Pro",
                    "Up to 10 workspace member seats",
                    "Shared blueprint templates & ADRs",
                    "Centralized VAT invoices",
                  ],
                },
              ].map((plan) => (
                <div
                  key={plan.key}
                  className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-8 bg-white ${
                    plan.primary ? "border-2 border-zinc-900" : "border border-zinc-200"
                  }`}
                >
                  <div className="space-y-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-base font-semibold text-zinc-900">{plan.name}</h3>
                      <span
                        className={`text-xs font-medium ${
                          plan.primary ? "text-zinc-900" : "text-zinc-500"
                        }`}
                      >
                        {plan.hint}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 tabular-nums">
                      <span className="text-4xl font-semibold tracking-tight text-zinc-900">{plan.price}</span>
                      <span className="text-xs text-zinc-500">{plan.per}</span>
                    </div>
                    <ul className="space-y-2.5 pt-4 border-t border-zinc-200 text-[13px] text-zinc-500">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    variant={plan.primary ? "default" : "outline"}
                    onClick={() => selectPlan(plan.key)}
                    className={`w-full h-10 text-xs font-medium apple-spring ${
                      plan.primary ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-white hover:bg-zinc-100"
                    }`}
                    data-testid={plan.testid}
                  >
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-white px-5 py-3.5 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2">
              <span>Checkout &amp; global VAT handled by Lemon Squeezy (Merchant of Record)</span>
              <span>One-click cancellation · keep exported files permanently</span>
            </div>
          </div>
        </RevealSection>

        {/* § 05 / FAQ — light zone */}
        <RevealSection id="faq" className="scroll-mt-14 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4">
              <p className="text-sm font-medium text-zinc-500 mb-2">FAQ</p>
              <h2 className="text-2xl font-semibold tracking-tight">Technical &amp; billing questions</h2>
            </div>

            <div className="lg:col-span-8 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              {FAQS.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? -1 : idx)}
                      className="w-full px-6 py-4 text-left flex items-start justify-between gap-4 hover:bg-zinc-50 transition-colors"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-medium text-zinc-900"><CodeText text={item.q} /></span>
                      <span className={`font-mono text-base text-zinc-500 transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
                        +
                      </span>
                    </button>
                    {open && (
                      <div className="px-6 pb-5 text-[13px] text-zinc-500 leading-relaxed max-w-2xl fade-up">
                        <CodeText text={item.a} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </RevealSection>

        {/* Closing CTA — graphite band, like the login visual */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
            <div className="rounded-3xl bg-[#09090b] border border-[#27272a] px-6 sm:px-10 py-10 sm:py-14 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
              <div className="max-w-lg">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                  Spec the schema and contracts before writing line one
                </h2>
                <p className="text-sm text-[#a1a1aa] mt-2">
                  Free account includes 1 active project and all 12 workspace modules.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {!user && (
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="h-10 px-4 rounded-md font-mono text-xs text-[#a1a1aa] hover:text-white transition-colors border border-[#27272a]"
                    data-testid="cta-signin-btn"
                  >
                    Sign in
                  </button>
                )}
                <Button
                  onClick={() => navigate(user ? "/dashboard" : "/login?mode=register")}
                  className="h-10 px-5 bg-white text-zinc-900 hover:bg-zinc-200 text-xs font-medium group apple-spring"
                  data-testid="cta-create-account-btn"
                >
                  <span>{user ? "Open workspace" : "Create free account"}</span>
                  <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="grid h-5 w-5 place-items-center rounded bg-zinc-900">
              <div className="h-1.5 w-1.5 rounded-[2px] border-[1.5px] border-white" />
            </div>
            <span className="font-medium text-zinc-900">Formora</span>
            <span className="text-xs">· software blueprint planner</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#workbench" className="hover:text-zinc-900 transition-colors">Live demo</a>
            <a href="#pricing" className="hover:text-zinc-900 transition-colors">Pricing</a>
            <Link to="/login" className="hover:text-zinc-900 transition-colors">Sign in</Link>
            <Link to="/login?mode=register" className="text-zinc-900 font-medium hover:underline">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
