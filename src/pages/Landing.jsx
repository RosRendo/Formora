import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ArrowRight, ArrowUpRight, Check, Copy, Loader2, Moon, Sun, Menu, X, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { http, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
    meta: "server/aiArchitect.js -> 8 artifact targets",
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
    title: "Nine separated .md specs",
    body: "Export `01-brief.md` through `09-architect-notes.md` individually or together so coding agents read only the exact slice they are implementing.",
    meta: "docs/01..09.md GFM bundle",
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

function CodeText({ text }) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="font-mono text-[11.5px] text-foreground bg-muted px-1.5 py-0.5 rounded">
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
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Kinetic System 1: Autonomous Prompt Typewriter + Packet Router
  const [caseIdx, setCaseIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [typedChars, setTypedChars] = useState(0);
  const [coords, setCoords] = useState({ x: 248, y: 112 });
  const routerBoxRef = useRef(null);

  // Kinetic System 2: Active Pipeline Pulse
  const [pipeIdx, setPipeIdx] = useState(4); // starts highlighting Schema

  // Kinetic System 3: Interactive Workbench
  const [tab, setTab] = useState("schema");
  const [focusedTableIdx, setFocusedTableIdx] = useState(2); // defaults to primary domain table (orders/deals/appointments)
  const [expandedEpIdx, setExpandedEpIdx] = useState(1);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState(1);
  const [mdIdx, setMdIdx] = useState(4);
  const [copiedSql, setCopiedSql] = useState(false);

  // Kinetic System 4: Live Referential Integrity Mutation Simulator
  // 0 = v2 synced, 1 = column renamed (drift vs cascade), 2 = downstream flagged
  const [mutationStep, setMutationStep] = useState(0);
  const [mutationPaused, setMutationPaused] = useState(false);

  // Pricing & FAQ
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [demoBusy, setDemoBusy] = useState(false);

  const activeCase = WORKBENCH_CASES[caseIdx];
  const fullPrompt = activeCase.prompt;
  const streamProgress = fullPrompt.length > 0 ? typedChars / fullPrompt.length : 1;

  // Reset typewriter when caseIdx changes
  useEffect(() => {
    setTypedChars(0);
    setFocusedTableIdx(2);
    setExpandedEpIdx(1);
    setSelectedNodeIdx(1);
  }, [caseIdx]);

  // Stream prompt characters & auto-advance scenario when autoPlay is active
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

  // Pipeline stage pulse ticker
  useEffect(() => {
    const iv = setInterval(() => {
      setPipeIdx((p) => (p + 1) % PIPELINE.length);
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  // Mutation simulator state machine ticker
  useEffect(() => {
    if (mutationPaused) return;
    const iv = setInterval(() => {
      setMutationStep((s) => (s + 1) % 3);
    }, 3000);
    return () => clearInterval(iv);
  }, [mutationPaused]);

  const handleRouterMouseMove = (e) => {
    const rect = routerBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    routerBoxRef.current.style.setProperty("--mx", `${x}px`);
    routerBoxRef.current.style.setProperty("--my", `${y}px`);
    setCoords({ x, y });
  };

  const copyDdl = () => {
    const sqlText = activeCase.tables[focusedTableIdx]?.ddl || "";
    navigator.clipboard?.writeText(sqlText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 1800);
  };

  const openSampleWorkspace = async () => {
    if (user) {
      navigate("/dashboard");
      return;
    }
    setDemoBusy(true);
    try {
      const { data } = await http.post("/auth/login", {
        email: "demo@blueprintos.dev",
        password: "Blueprint123!",
      });
      setUser(data);
      navigate("/dashboard");
    } catch (err) {
      toast.error(errMsg(err));
      navigate("/login");
    } finally {
      setDemoBusy(false);
    }
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
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 h-14 border-b hairline bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:border-x hairline">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2" data-testid="landing-logo">
              <div className="grid h-6 w-6 place-items-center rounded-[5px] bg-foreground">
                <div className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-background" />
              </div>
              <span className="text-[14px] font-semibold tracking-tight">Formora</span>
            </Link>

            <nav className="hidden md:flex items-center gap-5 font-mono text-[12px] text-muted-foreground">
              <a href="#workbench" className="hover:text-foreground transition-colors">01 Workbench</a>
              <a href="#problem" className="hover:text-foreground transition-colors">02 Integrity</a>
              <a href="#specs" className="hover:text-foreground transition-colors">03 Capabilities</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">04 Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">05 FAQ</a>
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Toggle theme"
              data-testid="landing-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <Button size="sm" className="h-8 text-xs" onClick={() => navigate("/dashboard")} data-testid="landing-open-dashboard-btn">
                Open workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="landing-signin-btn"
                >
                  Sign in
                </Link>
                <Button
                  size="sm"
                  onClick={() => navigate("/login?mode=register")}
                  className="h-8 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
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
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-md text-foreground"
              aria-label="Toggle menu"
              data-testid="landing-mobile-menu-btn"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-b hairline bg-background px-4 py-4 space-y-3 md:hidden">
            <div className="flex flex-col space-y-2 font-mono text-xs text-muted-foreground">
              <a href="#workbench" onClick={() => setMobileOpen(false)} className="py-1.5">01 Workbench</a>
              <a href="#problem" onClick={() => setMobileOpen(false)} className="py-1.5">02 Integrity</a>
              <a href="#specs" onClick={() => setMobileOpen(false)} className="py-1.5">03 Capabilities</a>
              <a href="#pricing" onClick={() => setMobileOpen(false)} className="py-1.5">04 Pricing</a>
              <a href="#faq" onClick={() => setMobileOpen(false)} className="py-1.5">05 FAQ</a>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t hairline">
              {user ? (
                <Button onClick={() => navigate("/dashboard")} className="w-full h-10">Open workspace</Button>
              ) : (
                <>
                  <Button onClick={() => navigate("/login?mode=register")} className="w-full h-10 bg-foreground text-background">
                    Start free
                  </Button>
                  <Button variant="outline" onClick={openSampleWorkspace} disabled={demoBusy} className="w-full h-10">
                    Inspect sample project
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/login")} className="w-full h-10">
                    Sign in
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Architectural Rail Container */}
      <main className="mx-auto max-w-[1200px] lg:border-x hairline">
        {/* HERO — Asymmetric 12-column split with live autonomous schematic router */}
        <section className="grid grid-cols-1 lg:grid-cols-12 border-b hairline">
          {/* Left 7 Cols */}
          <div className="lg:col-span-7 px-6 sm:px-10 py-14 sm:py-16 flex flex-col justify-between gap-10 lg:border-r hairline">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-primary" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span>Blueprint OS // Prompt &rarr; Structured Specs &rarr; DDL</span>
              </div>

              <h1
                className="text-4xl sm:text-5xl lg:text-[52px] font-semibold tracking-[-0.03em] leading-[1.04]"
                data-testid="landing-hero-title"
              >
                Decide before you build.
                <span className="block text-muted-foreground font-normal mt-1.5">
                  Not inside one 2,000-line AI markdown file.
                </span>
              </h1>

              <p className="text-[15px] text-muted-foreground max-w-xl leading-relaxed">
                Describe your software in plain English. Formora decomposes your prompt live across a relational ERD, a REST contract explorer, a service topology graph, and nine separated{" "}
                <code className="font-mono text-xs text-foreground bg-muted px-1.5 py-0.5 rounded">.md</code> specs alongside runnable PostgreSQL &amp; Prisma schemas.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  onClick={() => navigate(user ? "/dashboard" : "/login?mode=register")}
                  className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90 text-[13px] font-medium group"
                  data-testid="hero-start-free-btn"
                >
                  <span>{user ? "Open workspace" : "Start a blueprint — free"}</span>
                  <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>

                <Button
                  variant="outline"
                  onClick={openSampleWorkspace}
                  disabled={demoBusy}
                  className="h-10 px-4 font-mono text-xs"
                  data-testid="hero-live-demo-btn"
                >
                  {demoBusy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Inspect live sample (&ldquo;Shelfmate&rdquo;)
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Interactive Animated Pipeline Chain */}
            <div className="pt-5 border-t hairline space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>Live artifact chain (click stage to inspect)</span>
                <span>stage {String(pipeIdx + 1).padStart(2, "0")}/07</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                {PIPELINE.map((stage, i) => {
                  const active = pipeIdx === i;
                  return (
                    <span key={stage.id} className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPipeIdx(i)}
                        className={`rounded border px-2 py-0.5 transition-all duration-300 ${
                          active
                            ? "border-foreground bg-foreground text-background font-medium"
                            : "hairline bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")} {stage.label}
                      </button>
                      {i < PIPELINE.length - 1 && (
                        <span className={`transition-colors duration-300 ${i < pipeIdx ? "text-foreground" : "text-border"}`}>
                          &mdash;
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>

              <div className="font-mono text-xs text-muted-foreground min-h-[20px]">
                <span className="text-foreground font-medium">{PIPELINE[pipeIdx].label}:</span> {PIPELINE[pipeIdx].detail}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Autonomous Live Packet-Splitting Blueprint Engine */}
          <div
            ref={routerBoxRef}
            onMouseMove={handleRouterMouseMove}
            onMouseEnter={() => setAutoPlay(false)}
            onMouseLeave={() => setAutoPlay(true)}
            style={{ "--mx": "240px", "--my": "120px" }}
            className="lg:col-span-5 bg-[#0b0d14] text-zinc-100 p-6 sm:p-8 flex flex-col justify-between gap-5 relative overflow-hidden"
          >
            {/* Base Grid + Mouse-Tracking Blueprint Flashlight */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-35 transition-opacity duration-300"
              style={{
                background:
                  "radial-gradient(260px circle at var(--mx) var(--my), rgba(99, 102, 241, 0.22), transparent 75%)",
              }}
            />

            <div className="relative space-y-4">
              {/* Top Telemetry Strip */}
              <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ROUTER_STREAM</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    X:{String(coords.x).padStart(4, "0")} Y:{String(coords.y).padStart(4, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAutoPlay((v) => !v)}
                    className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white"
                    title={autoPlay ? "Pause cycle" : "Resume cycle"}
                  >
                    {autoPlay ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
                    <span>{autoPlay ? "LIVE" : "PAUSED"}</span>
                  </button>
                </div>
              </div>

              {/* Scenario Switcher with Live Cycle Bar */}
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
                      }}
                      data-testid={`hero-scenario-${c.id}`}
                      className={`relative overflow-hidden px-2.5 py-1.5 text-left font-mono text-[10.5px] rounded border transition-colors ${
                        isCurrent
                          ? "border-indigo-400/70 bg-indigo-500/15 text-white"
                          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="block truncate">{c.slug}</span>
                      {isCurrent && (
                        <span
                          className="absolute bottom-0 left-0 h-[2px] bg-indigo-400 transition-all duration-100"
                          style={{ width: `${Math.round(streamProgress * 100)}%` }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Live Streaming Prompt Terminal (fixed min-height prevents layout shift) */}
              <div className="rounded-md border border-white/10 bg-[#11141d]/95 p-3.5 font-mono text-xs leading-relaxed text-zinc-200 min-h-[96px]">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                  <span>input_prompt</span>
                  <span className="tabular-nums">{typedChars}/{fullPrompt.length} chars</span>
                </div>
                <div>
                  <span>&ldquo;{fullPrompt.slice(0, typedChars)}</span>
                  {typedChars < fullPrompt.length ? (
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-indigo-400 animate-cursor-blink" />
                  ) : (
                    <span>&rdquo;</span>
                  )}
                </div>
              </div>

              {/* Animated SVG Packet Splitter — 1 Prompt -> 4 Separate Module Channels */}
              <div className="py-0.5">
                <svg viewBox="0 0 400 44" className="w-full h-11 overflow-visible" aria-hidden>
                  {[
                    ["M200 0 C 200 22, 50 18, 50 44", 0.25],
                    ["M200 0 C 200 22, 150 18, 150 44", 0.5],
                    ["M200 0 C 200 22, 250 18, 250 44", 0.75],
                    ["M200 0 C 200 22, 350 18, 350 44", 0.95],
                  ].map(([pathD, thresh], i) => {
                    const active = streamProgress >= thresh;
                    return (
                      <g key={i}>
                        <path
                          d={pathD}
                          fill="none"
                          stroke={active ? "#818cf8" : "#27272a"}
                          strokeWidth="1.25"
                          strokeDasharray="3 3"
                          className={active ? "animate-dash-flow" : ""}
                        />
                        {active && (
                          <circle r="2.75" fill="#c7d2fe">
                            <animateMotion dur={`${1.1 + i * 0.22}s`} repeatCount="indefinite" path={pathD} />
                          </circle>
                        )}
                      </g>
                    );
                  })}
                  <circle cx="200" cy="2" r="3.5" fill="#818cf8" />
                </svg>
              </div>

              {/* 4 Separate Destination Modules lighting up sequentially */}
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                {activeCase.routed.map((r) => {
                  const placed = streamProgress >= r.threshold;
                  const activeBench = tab === r.tab;
                  return (
                    <button
                      key={r.target}
                      type="button"
                      onClick={() => {
                        setTab(r.tab);
                        document.getElementById("workbench")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className={`rounded-md border p-2.5 text-left transition-all duration-300 ${
                        placed
                          ? activeBench
                            ? "border-indigo-400 bg-indigo-500/15 text-white"
                            : "border-white/15 bg-[#121622] text-zinc-200 hover:border-indigo-400/60"
                          : "border-white/5 bg-white/[0.02] text-zinc-600"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={placed ? "text-indigo-300" : "text-zinc-600"}>/{r.target}</span>
                        <span className={placed ? "text-emerald-400" : "text-zinc-600"}>
                          {placed ? "placed" : "waiting"}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-medium truncate">
                        {placed ? r.count : "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative flex items-center justify-between pt-3 border-t border-white/10 font-mono text-[11px] text-zinc-400">
              <span>Click any module card to inspect &darr;</span>
              <span>PostgreSQL 16 &middot; Prisma</span>
            </div>
          </div>
        </section>

        {/* § 01 / LIVE ARTIFACT WORKBENCH */}
        <RevealSection id="workbench" className="border-b hairline scroll-mt-14">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 sm:px-10 py-4 border-b hairline bg-muted/20">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-muted-foreground">&sect; 01</span>
              <h2 className="text-sm font-semibold tracking-tight">
                Interactive Workbench &mdash;{" "}
                <span className="font-mono font-normal text-muted-foreground">{activeCase.slug}</span>
              </h2>
            </div>

            <div className="flex flex-wrap gap-1 font-mono text-xs">
              {[
                ["schema", "05_schema.sql"],
                ["api", "06_api_routes"],
                ["arch", "04_topology"],
                ["docs", "docs/01..09.md"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  data-testid={`preview-tab-${id}`}
                  className={`px-3 py-1.5 rounded border transition-colors ${
                    tab === id
                      ? "border-foreground bg-foreground text-background font-medium"
                      : "hairline bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: Interactive Relational ERD + Live Hover-Synced DDL Compiler */}
          {tab === "schema" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x hairline">
              <div className="lg:col-span-7 p-6 sm:p-8 space-y-4 bg-background">
                <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  <span>Hover or click any entity to trace foreign keys &amp; compile DDL</span>
                  <span>{activeCase.tables.length} entities</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                        className={`cursor-pointer rounded-md border transition-all duration-200 ${
                          isFocused
                            ? "border-foreground bg-card shadow-sm -translate-y-0.5"
                            : isLinked
                            ? "border-primary/60 bg-card"
                            : "hairline bg-card/70 opacity-85 hover:opacity-100"
                        }`}
                      >
                        <div className="px-3 py-2 border-b hairline bg-muted/30 flex items-center justify-between font-mono text-xs">
                          <span className="font-semibold text-foreground">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {isFocused
                              ? "compiling ->"
                              : isReferencedByFocused
                              ? "referenced pk"
                              : referencesFocused
                              ? "fk child"
                              : "table"}
                          </span>
                        </div>
                        <div className="divide-y hairline font-mono text-[11px]">
                          {t.cols.map(([name, type, constraint]) => (
                            <div key={name} className="px-3 py-1.5 flex items-center justify-between gap-2">
                              <span className="text-foreground">{name}</span>
                              <span className="text-muted-foreground">
                                {type}{" "}
                                <em className="not-italic text-[10px] text-primary">{constraint}</em>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Synced SQL Output */}
              <div className="lg:col-span-5 bg-[#0b0d14] text-zinc-200 p-6 sm:p-8 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
                    <span>DDL // {activeTable.name}.sql</span>
                    <button
                      type="button"
                      onClick={copyDdl}
                      className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-zinc-200 hover:bg-white/10 transition-colors"
                    >
                      {copiedSql ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedSql ? "Copied" : "Copy SQL"}</span>
                    </button>
                  </div>

                  <pre
                    key={`${activeCase.id}-${activeTable.name}`}
                    className="font-mono text-xs leading-relaxed text-zinc-200 overflow-x-auto pt-1 fade-up"
                  >
                    <code>
                      {activeTable.ddl.split("\n").map((line, i) => (
                        <div key={i} className="flex">
                          <span className="w-7 select-none text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
                          <span>{line}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>

                <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between font-mono text-[11px] text-zinc-500">
                  <span>Foreign keys: {activeTable.refs.length ? activeTable.refs.join(", ") : "root entity"}</span>
                  <span className="text-emerald-400">0 lint errors</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Expandable Live HTTP Contract Explorer */}
          {tab === "api" && (
            <div className="divide-y hairline">
              <div className="px-6 py-2.5 bg-muted/15 font-mono text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Click any route row to inspect JSON request &amp; response payload contracts</span>
                <span>{activeCase.endpoints.length} routes</span>
              </div>
              {activeCase.endpoints.map((ep, idx) => {
                const isExpanded = expandedEpIdx === idx;
                return (
                  <div key={`${ep.method}-${ep.path}`} className="bg-background">
                    <button
                      type="button"
                      onClick={() => setExpandedEpIdx(isExpanded ? -1 : idx)}
                      className="w-full px-6 py-3.5 text-left grid grid-cols-12 items-center gap-3 hover:bg-muted/25 transition-colors text-xs"
                    >
                      <span className="col-span-2 sm:col-span-1 font-mono font-semibold text-foreground">
                        {ep.method}
                      </span>
                      <span className="col-span-10 sm:col-span-4 font-mono text-foreground truncate">
                        {ep.path}
                      </span>
                      <span className="col-span-6 sm:col-span-2 font-mono text-muted-foreground">
                        guard: {ep.role}
                      </span>
                      <span className="col-span-4 sm:col-span-1 font-mono text-muted-foreground">
                        {ep.rate}
                      </span>
                      <span className="col-span-12 sm:col-span-4 text-muted-foreground flex items-center justify-between">
                        <span className="truncate">{ep.desc}</span>
                        <span className="font-mono text-xs ml-2">{isExpanded ? "−" : "+"}</span>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-6 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/15 fade-up">
                        <div className="rounded-md border hairline bg-[#0b0d14] p-3.5 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                          <div className="text-[10px] uppercase text-zinc-500 mb-1">request_contract</div>
                          <code>{ep.req}</code>
                        </div>
                        <div className="rounded-md border hairline bg-[#0b0d14] p-3.5 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                          <div className="text-[10px] uppercase text-zinc-500 mb-1">200_response_schema</div>
                          <code>{ep.res}</code>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: Living Packet-Streaming Topology Schematic */}
          {tab === "arch" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x hairline">
              <div className="lg:col-span-8 bg-[#0b0d14] p-6 sm:p-10 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
                  <span>LIVE_SERVICE_MESH // click any node to inspect responsibility</span>
                  <span className="text-emerald-400">packets streaming</span>
                </div>

                <svg viewBox="0 0 530 210" className="w-full max-w-[580px] mx-auto" aria-label="System topology schematic">
                  {activeCase.svgEdges.map((edge, idx) => (
                    <g key={idx}>
                      <path
                        d={edge.d}
                        stroke="#6366f1"
                        strokeOpacity="0.55"
                        strokeWidth="1.25"
                        fill="none"
                        strokeDasharray="4 4"
                        className="animate-dash-flow"
                      />
                      <circle r="3" fill="#c7d2fe">
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
                          rx="4"
                          fill={selected ? "#1a1f33" : "#121520"}
                          stroke={selected ? "#a5b4fc" : "#6366f1"}
                          strokeWidth={selected ? "1.6" : "1"}
                          strokeOpacity={selected ? "1" : "0.5"}
                        />
                        <circle
                          cx={n.x + n.w - 12}
                          cy={n.y + 15}
                          r="2.5"
                          fill={selected ? "#34d399" : "#818cf8"}
                        />
                        <text x={n.x + 12} y={n.y + 21} fill="#f4f4f5" fontSize="11.5" fontFamily="JetBrains Mono">
                          {n.label}
                        </text>
                        <text x={n.x + 12} y={n.y + 38} fill="#9ca3af" fontSize="10" fontFamily="JetBrains Mono">
                          {n.sub} · {n.latency}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="lg:col-span-4 p-6 sm:p-8 flex flex-col justify-between gap-6 bg-card">
                <div className="space-y-3" key={selectedNodeIdx}>
                  <div className="font-mono text-[11px] uppercase text-muted-foreground">
                    Selected node // {activeCase.svgNodes[selectedNodeIdx]?.latency} p95
                  </div>
                  <h3 className="text-base font-semibold font-mono">
                    {activeCase.svgNodes[selectedNodeIdx]?.label}
                  </h3>
                  <div className="font-mono text-xs text-primary">
                    {activeCase.svgNodes[selectedNodeIdx]?.sub}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    {activeCase.svgNodes[selectedNodeIdx]?.role}
                  </p>
                </div>

                <div className="font-mono text-[11px] text-muted-foreground pt-4 border-t hairline">
                  Exports to PNG diagram &amp; 04-architecture.md
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 9 Separated .md Specs Inspector */}
          {tab === "docs" && (
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x hairline">
              <div className="md:col-span-5 divide-y hairline bg-card">
                {MD_SPEC_TREE.map(([filename], idx) => (
                  <button
                    key={filename}
                    type="button"
                    onClick={() => setMdIdx(idx)}
                    className={`w-full px-6 py-2.5 text-left font-mono text-xs flex items-center justify-between transition-colors ${
                      mdIdx === idx
                        ? "bg-foreground text-background font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <span>docs/{filename}</span>
                    <span className="text-[10px] opacity-75">v1</span>
                  </button>
                ))}
              </div>
              <div className="md:col-span-7 p-6 sm:p-8 bg-background flex flex-col justify-between gap-5">
                <div className="space-y-3 fade-up" key={mdIdx}>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    docs/{MD_SPEC_TREE[mdIdx][0]} &mdash; live module specification
                  </div>
                  <h3 className="text-lg font-semibold font-mono">
                    # {activeCase.slug} / {MD_SPEC_TREE[mdIdx][0].replace(".md", "")}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {MD_SPEC_TREE[mdIdx][1]}
                  </p>
                  <pre className="rounded-md border hairline bg-[#0b0d14] text-zinc-200 p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                    <code>{MD_SPEC_TREE[mdIdx][2]}</code>
                  </pre>
                </div>
                <div className="font-mono text-xs text-muted-foreground pt-3 border-t hairline">
                  Coding agents read only the exact slice file they need—zero 2,000-line context pollution.
                </div>
              </div>
            </div>
          )}
        </RevealSection>

        {/* § 02 / LIVE SCHEMA MUTATION & IMPACT PROPAGATION SIMULATOR */}
        <RevealSection
          id="problem"
          className="border-b hairline scroll-mt-14"
        >
          <div
            onMouseEnter={() => setMutationPaused(true)}
            onMouseLeave={() => setMutationPaused(false)}
          >
            <div className="px-6 sm:px-10 py-10 border-b hairline flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="font-mono text-[11px] text-muted-foreground mb-2">
                  &sect; 02 / LIVE CHANGE-IMPACT SIMULATION
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-xl">
                  Watch what happens when you rename one database column.
                </h2>
              </div>

              {/* Interactive State Stepper */}
              <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                {[
                  [0, "1. v2 Approved"],
                  [1, "2. Rename Column"],
                  [2, "3. Impact Propagated"],
                ].map(([stepNum, label]) => (
                  <button
                    key={stepNum}
                    type="button"
                    onClick={() => {
                      setMutationStep(stepNum);
                      setMutationPaused(true);
                    }}
                    className={`px-3 py-1.5 rounded border transition-all ${
                      mutationStep === stepNum
                        ? "border-foreground bg-foreground text-background font-medium"
                        : "hairline bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x hairline">
              {/* Left: Static Monolith Markdown Drift */}
              <div className="p-6 sm:p-10 space-y-4">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-muted-foreground">plan_final_v4.md (1,840 lines)</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                      mutationStep === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/15 text-destructive font-semibold"
                    }`}
                  >
                    {mutationStep === 0 ? "untracked text" : "SILENT SCHEMA DRIFT"}
                  </span>
                </div>

                <div className="rounded-md border hairline bg-muted/35 p-4 font-mono text-xs space-y-3 leading-relaxed">
                  <div>
                    <div className="text-[10px] text-muted-foreground">## Line 412 — Database</div>
                    <div>
                      orders: id, user_id,{" "}
                      <span
                        className={`px-1 rounded transition-colors duration-300 ${
                          mutationStep >= 1 ? "bg-foreground text-background font-semibold" : ""
                        }`}
                      >
                        {mutationStep >= 1 ? "total_cents" : "total_price"}
                      </span>
                      , status
                    </div>
                  </div>

                  <div className="border-t hairline pt-3">
                    <div className="text-[10px] text-muted-foreground">## Line 1,190 — API Payload</div>
                    <div>
                      POST /api/orders &rarr;{" "}
                      <span
                        className={`px-1 rounded transition-colors duration-300 ${
                          mutationStep >= 1 ? "bg-destructive/15 text-destructive line-through" : ""
                        }`}
                      >
                        {'{ "total_price": 19.99 }'}
                      </span>
                    </div>
                    {mutationStep >= 1 && (
                      <div className="text-[11px] text-destructive mt-1.5">
                        ^ Line 1,190 never updated. Coding agent ships broken insert query.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Formora Live Dependency Cascade */}
              <div className="p-6 sm:p-10 space-y-4 bg-[#0b0d14] text-zinc-100">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-zinc-300">Formora linked artifact graph</span>
                  <span className="text-indigo-300">
                    {mutationStep === 0
                      ? "v2 · all green"
                      : mutationStep === 1
                      ? "v2 -> v3 mutating..."
                      : "v3 · 2 dependents flagged"}
                  </span>
                </div>

                <div className="rounded-md border border-white/10 bg-[#11141d] p-4 font-mono text-xs space-y-2.5">
                  <div className="flex items-center justify-between rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span>
                      05_schema.orders.<b>{mutationStep >= 1 ? "total_cents" : "total_price"}</b>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {mutationStep === 0 ? "v2 approved" : "v3 updated"}
                    </span>
                  </div>

                  {/* Animated Cascade Connector */}
                  <div className="pl-4 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className={mutationStep >= 1 ? "text-amber-400" : ""}>&darr;</span>
                    <span>entity_id reference trace</span>
                  </div>

                  <div
                    className={`flex items-center justify-between rounded border px-3 py-2 transition-all duration-300 ${
                      mutationStep === 2
                        ? "border-amber-400/60 bg-amber-500/10 text-amber-100"
                        : "border-white/10 bg-white/[0.02] text-zinc-300"
                    }`}
                  >
                    <span>06_api :: POST /api/orders</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded ${
                        mutationStep === 2
                          ? "bg-amber-400/20 text-amber-300 font-semibold"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {mutationStep === 2 ? "needs_review" : "approved"}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-between rounded border px-3 py-2 transition-all duration-300 ${
                      mutationStep === 2
                        ? "border-amber-400/60 bg-amber-500/10 text-amber-100"
                        : "border-white/10 bg-white/[0.02] text-zinc-300"
                    }`}
                  >
                    <span>07_roadmap :: Milestone 4 (Orders CRUD)</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded ${
                        mutationStep === 2
                          ? "bg-amber-400/20 text-amber-300 font-semibold"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {mutationStep === 2 ? "needs_review" : "ready"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* § 03 / CAPABILITY MATRIX */}
        <RevealSection id="specs" className="border-b hairline scroll-mt-14">
          <div className="px-6 sm:px-10 py-12 border-b hairline">
            <div className="font-mono text-[11px] text-muted-foreground mb-2">&sect; 03 / SYSTEM CAPABILITIES</div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Built like an engineering tool, not a slide deck.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y hairline">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={cap.idx}
                className={`group p-6 sm:p-8 flex flex-col justify-between gap-6 transition-colors duration-200 hover:bg-muted/25 ${
                  i % 3 !== 2 ? "md:border-r hairline" : ""
                } ${i === 0 ? "border-t-0" : ""}`}
              >
                <div className="space-y-3">
                  <div className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {cap.idx}
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{cap.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    <CodeText text={cap.body} />
                  </p>
                </div>
                <div className="pt-3 border-t hairline font-mono text-[11px] text-muted-foreground">
                  {cap.meta}
                </div>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* § 04 / PRICING */}
        <RevealSection id="pricing" className="border-b hairline scroll-mt-14">
          <div className="px-6 sm:px-10 py-12 border-b hairline flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[11px] text-muted-foreground mb-2">&sect; 04 / PRICING</div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Free for one active project. Flat rate after.
              </h2>
            </div>

            <div className="inline-flex rounded-md border hairline bg-muted/40 p-0.5 font-mono text-xs self-start">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                data-testid="landing-billing-monthly"
                className={`px-3 py-1.5 rounded-[5px] transition-colors ${
                  !annual ? "bg-card text-foreground font-medium shadow-2xs" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                data-testid="landing-billing-yearly"
                className={`px-3 py-1.5 rounded-[5px] transition-colors ${
                  annual ? "bg-card text-foreground font-medium shadow-2xs" : "text-muted-foreground"
                }`}
              >
                Annual (-17%)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x hairline">
            <div className="p-6 sm:p-9 flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold">Starter</h3>
                  <span className="font-mono text-xs text-muted-foreground">Solo MVP</span>
                </div>
                <div className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-4xl font-semibold tracking-tight">$0</span>
                  <span className="font-mono text-xs text-muted-foreground">/ forever</span>
                </div>
                <ul className="space-y-2.5 pt-4 border-t hairline text-[13px] text-muted-foreground">
                  <li>&mdash; 1 active blueprint project</li>
                  <li>&mdash; All 9 visual &amp; markdown panels</li>
                  <li>&mdash; AI Architect module-routing chat</li>
                  <li>&mdash; Individual <code className="font-mono text-xs">.md</code> file downloads</li>
                </ul>
              </div>
              <Button
                variant="outline"
                onClick={() => selectPlan("free")}
                className="w-full h-10 text-xs font-medium"
                data-testid="pricing-starter-btn"
              >
                Start free
              </Button>
            </div>

            <div className="p-6 sm:p-9 flex flex-col justify-between gap-8 bg-card">
              <div className="space-y-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold">Pro</h3>
                  <span className="font-mono text-xs text-primary">Unlimited projects</span>
                </div>
                <div className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-4xl font-semibold tracking-tight">${annual ? "190" : "19"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{annual ? "/ year" : "/ month"}</span>
                </div>
                <ul className="space-y-2.5 pt-4 border-t hairline text-[13px] text-foreground/90">
                  <li>&mdash; Unlimited active blueprint projects</li>
                  <li>&mdash; PostgreSQL <code className="font-mono text-xs">.sql</code> &amp; Prisma codegen</li>
                  <li>&mdash; Complete 9-file <code className="font-mono text-xs">.md</code> bundle export</li>
                  <li>&mdash; Version history, diffs &amp; archiving</li>
                </ul>
              </div>
              <Button
                onClick={() => selectPlan("pro")}
                className="w-full h-10 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium group"
                data-testid="pricing-pro-btn"
              >
                <span>Continue with Pro</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            </div>

            <div className="p-6 sm:p-9 flex flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold">Team</h3>
                  <span className="font-mono text-xs text-muted-foreground">Up to 10 seats</span>
                </div>
                <div className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-4xl font-semibold tracking-tight">${annual ? "490" : "49"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{annual ? "/ year" : "/ month"}</span>
                </div>
                <ul className="space-y-2.5 pt-4 border-t hairline text-[13px] text-muted-foreground">
                  <li>&mdash; Everything in Pro</li>
                  <li>&mdash; Up to 10 workspace member seats</li>
                  <li>&mdash; Shared blueprint templates &amp; ADRs</li>
                  <li>&mdash; Centralized VAT invoices</li>
                </ul>
              </div>
              <Button
                variant="outline"
                onClick={() => selectPlan("team")}
                className="w-full h-10 text-xs font-medium"
                data-testid="pricing-team-btn"
              >
                Continue with Team
              </Button>
            </div>
          </div>

          <div className="px-6 sm:px-10 py-3.5 border-t hairline bg-muted/20 font-mono text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>Checkout &amp; global VAT compliance handled by Lemon Squeezy (Merchant of Record).</span>
            <span>One-click cancellation &middot; Keep exported files permanently.</span>
          </div>
        </RevealSection>

        {/* § 05 / FAQ */}
        <RevealSection id="faq" className="grid grid-cols-1 lg:grid-cols-12 border-b hairline scroll-mt-14">
          <div className="lg:col-span-4 p-6 sm:p-10 lg:border-r hairline">
            <div className="font-mono text-[11px] text-muted-foreground mb-2">&sect; 05 / FAQ</div>
            <h2 className="text-2xl font-semibold tracking-tight">Technical &amp; billing questions</h2>
          </div>

          <div className="lg:col-span-8 divide-y hairline">
            {FAQS.map((item, idx) => {
              const open = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? -1 : idx)}
                    className="w-full px-6 sm:px-10 py-5 text-left flex items-start justify-between gap-4 hover:bg-muted/20 transition-colors"
                    aria-expanded={open}
                  >
                    <span className="text-sm font-medium"><CodeText text={item.q} /></span>
                    <span className="font-mono text-sm text-muted-foreground shrink-0 leading-none mt-0.5">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="px-6 sm:px-10 pb-6 text-[13px] text-muted-foreground leading-relaxed max-w-2xl fade-up">
                      <CodeText text={item.a} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </RevealSection>

        {/* Closing Bar */}
        <section className="px-6 sm:px-10 py-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-card">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Spec the schema and contracts before writing line one.
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Free account includes 1 active project and all 9 workspace panels.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={openSampleWorkspace}
              disabled={demoBusy}
              className="h-10 font-mono text-xs"
              data-testid="cta-demo-btn"
            >
              Inspect sample
            </Button>
            <Button
              onClick={() => navigate(user ? "/dashboard" : "/login?mode=register")}
              className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium group"
              data-testid="cta-create-account-btn"
            >
              <span>{user ? "Open workspace" : "Create account"}</span>
              <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t hairline">
        <div className="mx-auto max-w-[1200px] px-6 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] text-muted-foreground">
          <span>FORMORA // SOFTWARE BLUEPRINT OS</span>
          <div className="flex items-center gap-5">
            <a href="#workbench" className="hover:text-foreground">Workbench</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
            <Link to="/login?mode=register" className="text-foreground hover:underline">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
