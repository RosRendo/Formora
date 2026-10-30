// AI Architect & Multi-Module Router for Formora (Blueprint OS)
// Decomposes natural-language product ideas and incremental requests into separate,
// cross-linked structured panels: Brief, Requirements, Features, Architecture, Database, API, Roadmap, and Separate .md Docs.

import crypto from "crypto";
import {
  buildFlows,
  buildUiBlueprint,
  buildSecurityPlan,
  buildTestingPlan,
  normalizePhase2Updates,
  summarizePhase2Placements,
} from "./phase2Architect.js";

const uid = () => crypto.randomUUID();

const VALID_NODE_TYPES = new Set([
  "web_frontend",
  "mobile_frontend",
  "backend",
  "api_gateway",
  "database",
  "cache",
  "auth",
  "storage",
  "email",
  "payments",
  "worker",
  "external_api",
  "hosting",
  "monitoring",
]);

const VALID_PROTOCOLS = new Set([
  "HTTPS REST",
  "SQL / database access",
  "Events",
  "Background job",
  "Webhook",
  "SDK",
  "WebSocket",
  "Deploy",
]);

const VALID_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const MODULE_META = {
  brief: { label: "Project Brief", path: "brief", docFile: "01-brief.md" },
  spec: { label: "Product Requirements", path: "requirements", docFile: "02-requirements.md" },
  features: { label: "Features & Stories", path: "features", docFile: "03-features.md" },
  architecture: { label: "Architecture Canvas", path: "architecture", docFile: "04-architecture.md" },
  schema: { label: "Database Designer", path: "database", docFile: "05-database.md" },
  api: { label: "API Explorer", path: "api", docFile: "06-api.md" },
  roadmap: { label: "Implementation Roadmap", path: "roadmap", docFile: "07-roadmap.md" },
  flows: { label: "User Flows", path: "flows", docFile: "10-user-flows.md" },
  ui: { label: "UI/UX Blueprint", path: "ui", docFile: "11-ui-blueprint.md" },
  security: { label: "Security Plan", path: "security", docFile: "12-security-plan.md" },
  testing: { label: "Testing Center", path: "testing", docFile: "13-testing-plan.md" },
  docs: { label: "Module Docs (.md)", path: "docs", docFile: "09-architect-notes.md" },
};

// ---------------------------------------------------------------------------
// Knowledge Graph of Common Domain Entities (columns + semantic hints)
// ---------------------------------------------------------------------------
const ENTITY_BLUEPRINTS = {
  users: {
    purpose: "Authenticated user accounts and profile identity.",
    fields: [
      { name: "email", type: "varchar(255)", unique: true },
      { name: "full_name", type: "varchar(120)" },
      { name: "role", type: "varchar(30)", default: "'member'" },
      { name: "avatar_url", type: "varchar(255)", nullable: true },
    ],
  },
  workspaces: {
    purpose: "Multi-tenant workspaces or organizations.",
    refs: [{ col: "owner_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "name", type: "varchar(120)" },
      { name: "slug", type: "varchar(80)", unique: true },
      { name: "plan", type: "varchar(30)", default: "'free'" },
    ],
  },
  workspace_members: {
    purpose: "Membership and RBAC permissions inside a workspace.",
    refs: [
      { col: "workspace_id", target: "workspaces", onDelete: "CASCADE" },
      { col: "user_id", target: "users", onDelete: "CASCADE" },
    ],
    fields: [{ name: "role", type: "varchar(30)", default: "'member'" }],
  },
  products: {
    purpose: "Catalog items or products available for purchase.",
    refs: [{ col: "seller_id", target: "users", nullable: true }],
    fields: [
      { name: "title", type: "varchar(160)" },
      { name: "slug", type: "varchar(160)", unique: true },
      { name: "description", type: "text", nullable: true },
      { name: "price", type: "numeric(10,2)" },
      { name: "stock_qty", type: "integer", default: "0" },
      { name: "status", type: "varchar(30)", default: "'active'" },
    ],
  },
  categories: {
    purpose: "Hierarchical grouping for catalog items.",
    fields: [
      { name: "name", type: "varchar(100)" },
      { name: "slug", type: "varchar(100)", unique: true },
    ],
  },
  orders: {
    purpose: "Customer checkout orders and fulfillment state.",
    refs: [{ col: "customer_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "order_number", type: "varchar(40)", unique: true },
      { name: "total_amount", type: "numeric(10,2)" },
      { name: "currency", type: "varchar(10)", default: "'USD'" },
      { name: "status", type: "varchar(30)", default: "'pending'" },
      { name: "shipping_address", type: "jsonb", nullable: true },
    ],
  },
  order_items: {
    purpose: "Line items belonging to an order with snapshot pricing.",
    refs: [
      { col: "order_id", target: "orders", onDelete: "CASCADE" },
      { col: "product_id", target: "products", onDelete: "RESTRICT" },
    ],
    fields: [
      { name: "quantity", type: "integer", default: "1" },
      { name: "unit_price", type: "numeric(10,2)" },
    ],
  },
  restaurants: {
    purpose: "Partner restaurants or vendors with operating hours and location.",
    refs: [{ col: "owner_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "name", type: "varchar(140)" },
      { name: "cuisine_type", type: "varchar(80)" },
      { name: "address", type: "varchar(255)" },
      { name: "is_open", type: "boolean", default: "true" },
      { name: "rating_avg", type: "numeric(10,2)", default: "0" },
    ],
  },
  menu_items: {
    purpose: "Dishes and beverages listed on a restaurant menu.",
    refs: [{ col: "restaurant_id", target: "restaurants", onDelete: "CASCADE" }],
    fields: [
      { name: "name", type: "varchar(140)" },
      { name: "description", type: "text", nullable: true },
      { name: "price", type: "numeric(10,2)" },
      { name: "image_url", type: "varchar(255)", nullable: true },
      { name: "is_available", type: "boolean", default: "true" },
    ],
  },
  deliveries: {
    purpose: "Courier assignment and real-time delivery tracking.",
    refs: [
      { col: "order_id", target: "orders", onDelete: "CASCADE" },
      { col: "driver_id", target: "users", nullable: true },
    ],
    fields: [
      { name: "status", type: "varchar(30)", default: "'assigned'" },
      { name: "pickup_eta", type: "timestamptz", nullable: true },
      { name: "dropoff_eta", type: "timestamptz", nullable: true },
      { name: "current_location", type: "jsonb", nullable: true },
    ],
  },
  payments: {
    purpose: "Payment transactions, gateway references, and ledger status.",
    refs: [{ col: "user_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "provider", type: "varchar(40)" },
      { name: "external_ref", type: "varchar(120)", unique: true },
      { name: "amount", type: "numeric(10,2)" },
      { name: "currency", type: "varchar(10)", default: "'USD'" },
      { name: "status", type: "varchar(30)", default: "'pending'" },
      { name: "paid_at", type: "timestamptz", nullable: true },
    ],
  },
  subscriptions: {
    purpose: "Recurring billing plans and renewal lifecycle.",
    refs: [{ col: "user_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "plan_code", type: "varchar(50)" },
      { name: "provider_sub_id", type: "varchar(120)", unique: true },
      { name: "status", type: "varchar(30)", default: "'active'" },
      { name: "current_period_end", type: "timestamptz" },
    ],
  },
  invoices: {
    purpose: "Billed invoices with due dates and payment status.",
    refs: [{ col: "user_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "invoice_number", type: "varchar(40)", unique: true },
      { name: "client_name", type: "varchar(140)" },
      { name: "amount_due", type: "numeric(10,2)" },
      { name: "due_date", type: "date" },
      { name: "status", type: "varchar(30)", default: "'draft'" },
    ],
  },
  doctors: {
    purpose: "Practitioner profiles, specialties, and consultation fees.",
    refs: [{ col: "user_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "specialty", type: "varchar(100)" },
      { name: "license_number", type: "varchar(60)", unique: true },
      { name: "consultation_fee", type: "numeric(10,2)" },
      { name: "availability", type: "jsonb", nullable: true },
    ],
  },
  patients: {
    purpose: "Patient demographics, contact details, and medical intake.",
    refs: [{ col: "user_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "date_of_birth", type: "date", nullable: true },
      { name: "phone", type: "varchar(30)" },
      { name: "allergies", type: "text", nullable: true },
    ],
  },
  appointments: {
    purpose: "Scheduled bookings with time slots and status.",
    refs: [{ col: "user_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "starts_at", type: "timestamptz" },
      { name: "ends_at", type: "timestamptz" },
      { name: "status", type: "varchar(30)", default: "'scheduled'" },
      { name: "notes", type: "text", nullable: true },
    ],
  },
  prescriptions: {
    purpose: "Clinical prescriptions and dosage instructions tied to visits.",
    refs: [{ col: "appointment_id", target: "appointments", onDelete: "CASCADE" }],
    fields: [
      { name: "medication", type: "varchar(160)" },
      { name: "dosage", type: "varchar(120)" },
      { name: "instructions", type: "text" },
    ],
  },
  courses: {
    purpose: "Published learning courses with instructor and curriculum metadata.",
    refs: [{ col: "instructor_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "title", type: "varchar(160)" },
      { name: "slug", type: "varchar(160)", unique: true },
      { name: "summary", type: "text" },
      { name: "level", type: "varchar(30)", default: "'beginner'" },
      { name: "price", type: "numeric(10,2)", default: "0" },
      { name: "published", type: "boolean", default: "false" },
    ],
  },
  lessons: {
    purpose: "Ordered lessons, videos, and reading content within a course.",
    refs: [{ col: "course_id", target: "courses", onDelete: "CASCADE" }],
    fields: [
      { name: "title", type: "varchar(160)" },
      { name: "position", type: "integer", default: "1" },
      { name: "video_url", type: "varchar(255)", nullable: true },
      { name: "content_md", type: "text", nullable: true },
      { name: "duration_sec", type: "integer", default: "0" },
    ],
  },
  enrollments: {
    purpose: "Student course enrollments and completion progress.",
    refs: [
      { col: "course_id", target: "courses", onDelete: "CASCADE" },
      { col: "student_id", target: "users", onDelete: "CASCADE" },
    ],
    fields: [
      { name: "progress_pct", type: "integer", default: "0" },
      { name: "completed_at", type: "timestamptz", nullable: true },
    ],
  },
  quizzes: {
    purpose: "Assessment quizzes and passing thresholds per lesson or course.",
    refs: [{ col: "course_id", target: "courses", onDelete: "CASCADE" }],
    fields: [
      { name: "title", type: "varchar(140)" },
      { name: "questions", type: "jsonb" },
      { name: "pass_score", type: "integer", default: "70" },
    ],
  },
  posts: {
    purpose: "User-authored posts, articles, or feed updates.",
    refs: [{ col: "author_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "title", type: "varchar(180)" },
      { name: "body", type: "text" },
      { name: "media_url", type: "varchar(255)", nullable: true },
      { name: "visibility", type: "varchar(20)", default: "'public'" },
    ],
  },
  comments: {
    purpose: "Threaded comments and replies on content.",
    refs: [{ col: "author_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "body", type: "text" },
      { name: "is_edited", type: "boolean", default: "false" },
    ],
  },
  messages: {
    purpose: "Direct or channel chat messages between participants.",
    refs: [{ col: "sender_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "channel_key", type: "varchar(100)" },
      { name: "content", type: "text" },
      { name: "read_at", type: "timestamptz", nullable: true },
    ],
  },
  reviews: {
    purpose: "Verified star ratings and written feedback.",
    refs: [{ col: "reviewer_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "rating", type: "integer" },
      { name: "comment", type: "text", nullable: true },
    ],
  },
  coupons: {
    purpose: "Promotional discount codes with usage caps and expiry.",
    fields: [
      { name: "code", type: "varchar(40)", unique: true },
      { name: "discount_pct", type: "integer" },
      { name: "max_uses", type: "integer", default: "100" },
      { name: "used_count", type: "integer", default: "0" },
      { name: "expires_at", type: "timestamptz", nullable: true },
    ],
  },
  notifications: {
    purpose: "In-app and email alert delivery log per user.",
    refs: [{ col: "user_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "type", type: "varchar(50)" },
      { name: "title", type: "varchar(160)" },
      { name: "payload", type: "jsonb", nullable: true },
      { name: "read_at", type: "timestamptz", nullable: true },
    ],
  },
  projects: {
    purpose: "Tracked projects with status, owner, and target dates.",
    refs: [{ col: "owner_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "name", type: "varchar(140)" },
      { name: "description", type: "text", nullable: true },
      { name: "status", type: "varchar(30)", default: "'active'" },
      { name: "due_date", type: "date", nullable: true },
    ],
  },
  tasks: {
    purpose: "Assignable work items with priority and completion state.",
    refs: [{ col: "assignee_id", target: "users", nullable: true }],
    fields: [
      { name: "title", type: "varchar(180)" },
      { name: "priority", type: "varchar(20)", default: "'medium'" },
      { name: "status", type: "varchar(30)", default: "'todo'" },
      { name: "due_at", type: "timestamptz", nullable: true },
    ],
  },
  wallets: {
    purpose: "User balance accounts supporting multi-currency ledgers.",
    refs: [{ col: "user_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "currency", type: "varchar(10)", default: "'USD'" },
      { name: "balance", type: "numeric(12,2)", default: "0" },
      { name: "status", type: "varchar(20)", default: "'active'" },
    ],
  },
  transactions: {
    purpose: "Immutable debit and credit ledger entries.",
    refs: [{ col: "wallet_id", target: "wallets", onDelete: "RESTRICT" }],
    fields: [
      { name: "direction", type: "varchar(10)" },
      { name: "amount", type: "numeric(12,2)" },
      { name: "category", type: "varchar(60)" },
      { name: "reference", type: "varchar(120)", unique: true },
    ],
  },
  documents: {
    purpose: "Uploaded or AI-indexed documents and metadata.",
    refs: [{ col: "owner_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "title", type: "varchar(180)" },
      { name: "storage_key", type: "varchar(255)" },
      { name: "mime_type", type: "varchar(80)" },
      { name: "summary", type: "text", nullable: true },
    ],
  },
  bookings: {
    purpose: "Resource or property reservations with check-in/out windows.",
    refs: [{ col: "guest_id", target: "users", onDelete: "RESTRICT" }],
    fields: [
      { name: "start_date", type: "date" },
      { name: "end_date", type: "date" },
      { name: "total_price", type: "numeric(10,2)" },
      { name: "status", type: "varchar(30)", default: "'confirmed'" },
    ],
  },
  listings: {
    purpose: "Rentable properties, venues, or service listings.",
    refs: [{ col: "host_id", target: "users", onDelete: "CASCADE" }],
    fields: [
      { name: "title", type: "varchar(160)" },
      { name: "location", type: "varchar(180)" },
      { name: "price_per_unit", type: "numeric(10,2)" },
      { name: "capacity", type: "integer", default: "2" },
      { name: "amenities", type: "jsonb", nullable: true },
    ],
  },
  pets: {
    purpose: "Adoptable or registered pets with breed, age, and health status.",
    refs: [{ col: "owner_id", target: "users", nullable: true }],
    fields: [
      { name: "name", type: "varchar(100)" },
      { name: "species", type: "varchar(50)" },
      { name: "breed", type: "varchar(100)", nullable: true },
      { name: "age_months", type: "integer", default: "12" },
      { name: "status", type: "varchar(30)", default: "'available'" },
    ],
  },
  audit_logs: {
    purpose: "Immutable audit trail of sensitive actions across the workspace.",
    refs: [{ col: "actor_id", target: "users", nullable: true }],
    fields: [
      { name: "action", type: "varchar(120)" },
      { name: "resource_type", type: "varchar(60)" },
      { name: "resource_id", type: "uuid", nullable: true },
      { name: "metadata", type: "jsonb", nullable: true },
    ],
  },
};

const DOMAIN_ARCHETYPES = [
  {
    id: "food_delivery",
    keywords: /\b(food|restaurant|menu|delivery|courier|driver|kitchen|meal|cafe|coffee|pos)\b/i,
    titleSuffix: "Delivery",
    audience: "Diners ordering meals, partner restaurants managing menus, and delivery drivers",
    problem: "Phone and chat-based food ordering causes missed items, opaque delivery ETAs, and manual cash reconciliation.",
    valueProp: "Real-time menu ordering, kitchen dispatch, and live courier tracking with instant digital checkout.",
    businessModel: "15% marketplace commission per order + delivery fee",
    roles: [
      { name: "Customer", permissions: ["Browse menus", "Place orders", "Track live delivery", "Rate orders"] },
      { name: "Restaurant Partner", permissions: ["Manage menu items", "Accept/prepare orders", "View payouts"] },
      { name: "Driver", permissions: ["Accept delivery jobs", "Update live GPS status", "Complete drop-off"] },
    ],
    entities: ["users", "restaurants", "menu_items", "orders", "order_items", "deliveries", "payments"],
    needsPayments: true,
    needsRealtime: true,
    needsStorage: true,
  },
  {
    id: "ecommerce",
    keywords: /\b(ecommerce|e-commerce|shop|store|marketplace|catalog|cart|checkout|product|seller|inventory|vendor|retail)\b/i,
    titleSuffix: "Commerce",
    audience: "Online shoppers and merchants managing product inventory and fulfillment",
    problem: "Merchants struggle with fragmented inventory spreadsheets, manual payment verification, and abandoned checkouts.",
    valueProp: "Unified storefront, real-time stock control, and high-converting checkout with automated order tracking.",
    businessModel: "Transaction fee + tiered merchant SaaS subscription",
    roles: [
      { name: "Buyer", permissions: ["Browse catalog", "Manage cart & checkout", "View order history", "Write reviews"] },
      { name: "Merchant / Admin", permissions: ["Manage products & stock", "Fulfill orders", "Create discount coupons"] },
    ],
    entities: ["users", "categories", "products", "orders", "order_items", "payments", "reviews"],
    needsPayments: true,
    needsStorage: true,
  },
  {
    id: "healthcare",
    keywords: /\b(clinic|doctor|patient|hospital|medical|health|appointment|prescription|telehealth|dentist|vet|pharmacy)\b/i,
    titleSuffix: "Care",
    audience: "Patients booking consultations, doctors managing clinical schedules, and clinic receptionists",
    problem: "Phone-based clinic scheduling leads to double bookings, high no-show rates, and scattered paper prescriptions.",
    valueProp: "Conflict-free appointment booking, automated reminders, and structured digital visit prescriptions.",
    businessModel: "Monthly per-practitioner SaaS subscription ($49/doctor/mo)",
    roles: [
      { name: "Patient", permissions: ["Book/reschedule appointments", "View prescriptions", "Pay consultation fees"] },
      { name: "Doctor", permissions: ["Manage availability", "Record clinical notes", "Issue prescriptions"] },
      { name: "Clinic Admin", permissions: ["Manage practitioners", "View schedule analytics", "Handle billing"] },
    ],
    entities: ["users", "doctors", "patients", "appointments", "prescriptions", "payments"],
    needsPayments: true,
    needsWorker: true,
  },
  {
    id: "lms",
    keywords: /\b(course|learn|lms|student|teacher|instructor|lesson|quiz|education|school|academy|bootcamp|tutor)\b/i,
    titleSuffix: "Academy",
    audience: "Instructors publishing structured courses and students tracking learning progress",
    problem: "Creators cobble together video hosts, PDFs, and spreadsheets with no unified progress tracking or assessments.",
    valueProp: "All-in-one course player, interactive quizzes, and automated enrollment & completion tracking.",
    businessModel: "Course sales + Pro cohort subscription",
    roles: [
      { name: "Student", permissions: ["Enroll in courses", "Stream lessons", "Take quizzes", "Download certificates"] },
      { name: "Instructor", permissions: ["Author courses & lessons", "Build quizzes", "Review student analytics"] },
    ],
    entities: ["users", "courses", "lessons", "enrollments", "quizzes", "payments"],
    needsPayments: true,
    needsStorage: true,
  },
  {
    id: "fintech",
    keywords: /\b(wallet|fintech|bank|ledger|expense|budget|invoice|invoicing|billing|accounting|payroll|khqr|remittance)\b/i,
    titleSuffix: "Pay",
    audience: "Freelancers, SMBs, and consumers tracking balances, invoices, and instant digital payments",
    problem: "Manual invoice chasing and disconnected bank exports cause cash-flow blind spots and reconciliation errors.",
    valueProp: "Double-entry wallet ledger, instant payment links, and automated invoice status reconciliation.",
    businessModel: "0.8% payment processing fee + $15/mo Pro business tier",
    roles: [
      { name: "Account Owner", permissions: ["Manage wallets", "Send invoices", "Export tax ledgers"] },
      { name: "Payer / Client", permissions: ["View hosted invoice", "Pay via card or KHQR", "Download receipt"] },
    ],
    entities: ["users", "wallets", "transactions", "invoices", "payments", "subscriptions"],
    needsPayments: true,
    needsWorker: true,
  },
  {
    id: "booking_rental",
    keywords: /\b(booking|hotel|airbnb|rental|property|venue|salon|gym|fitness|event|ticket|reservation)\b/i,
    titleSuffix: "Book",
    audience: "Hosts or venue operators listing availability and guests reserving dates online",
    problem: "Manual availability calendars over DMs lead to double-booked dates and delayed deposit collection.",
    valueProp: "Live availability search, instant date locking, and verified host-guest booking workflows.",
    businessModel: "Host service fee (3%) + guest booking fee (8%)",
    roles: [
      { name: "Guest", permissions: ["Search listings", "Book available dates", "Leave verified reviews"] },
      { name: "Host", permissions: ["Publish listings & pricing", "Block calendar dates", "Manage reservations"] },
    ],
    entities: ["users", "listings", "bookings", "payments", "reviews"],
    needsPayments: true,
    needsStorage: true,
  },
  {
    id: "social_community",
    keywords: /\b(social|community|forum|chat|messaging|creator|feed|post|club|network|group)\b/i,
    titleSuffix: "Hub",
    audience: "Community creators, moderators, and members sharing discussions and real-time messages",
    problem: "Generic chat apps bury structured discussions while traditional forums lack real-time engagement.",
    valueProp: "Focused community spaces combining structured posts, threaded discussions, and instant messaging.",
    businessModel: "Freemium communities + $12/mo creator membership",
    roles: [
      { name: "Member", permissions: ["Publish posts", "Comment & react", "Send direct/channel messages"] },
      { name: "Moderator / Creator", permissions: ["Manage channels", "Pin posts", "Moderate content"] },
    ],
    entities: ["users", "workspaces", "workspace_members", "posts", "comments", "messages", "notifications"],
    needsRealtime: true,
    needsStorage: true,
  },
  {
    id: "ai_docs",
    keywords: /\b(ai|rag|agent|document|pdf|knowledge|assistant|copilot|summariz|prompt|automation)\b/i,
    titleSuffix: "AI",
    audience: "Knowledge workers and teams indexing documents and running structured AI workflows",
    problem: "Critical answers are locked inside scattered PDFs and docs while raw LLM chats lack citations and workspace permissions.",
    valueProp: "Workspace-scoped document indexing, grounded AI answers, and auditable workflow runs.",
    businessModel: "Usage-tiered SaaS ($19/mo Starter, $49/mo Team)",
    roles: [
      { name: "Workspace Admin", permissions: ["Manage team members", "Configure knowledge sources", "Manage billing"] },
      { name: "Editor", permissions: ["Upload documents", "Run AI workflows", "Share outputs"] },
    ],
    entities: ["users", "workspaces", "workspace_members", "documents", "tasks", "subscriptions"],
    needsPayments: true,
    needsStorage: true,
    needsWorker: true,
  },
  {
    id: "saas_pm",
    keywords: /\b(saas|crm|project|task|kanban|team|workspace|workflow|tracker|portal|dashboard)\b/i,
    titleSuffix: "OS",
    audience: "Product teams and small businesses collaborating on shared projects and tasks",
    problem: "Status updates are fragmented across chat threads, spreadsheets, and disconnected checklists.",
    valueProp: "Multi-tenant workspace with real-time project boards, clear ownership, and automated progress digests.",
    businessModel: "Per-seat SaaS subscription ($10/user/mo) with free starter tier",
    roles: [
      { name: "Workspace Admin", permissions: ["Manage workspace & billing", "Invite members", "Configure roles"] },
      { name: "Member", permissions: ["Create & update projects", "Assign tasks", "Comment on deliverables"] },
    ],
    entities: ["users", "workspaces", "workspace_members", "projects", "tasks", "notifications"],
    needsWorker: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers: Extracting Custom Entities, Tech Preferences & Project Name
// ---------------------------------------------------------------------------
const STOP_NOUNS = new Set([
  "app", "application", "system", "platform", "website", "web", "mobile", "idea", "project",
  "panel", "panels", "module", "modules", "database", "schema", "table", "tables", "api",
  "endpoint", "endpoints", "architecture", "brief", "spec", "requirements", "feature",
  "features", "roadmap", "markdown", "md", "file", "files", "ai", "chat", "visual", "plan",
  "user", "users", "admin", "admins", "member", "members", "people", "person", "data",
  "thing", "things", "place", "way", "time", "day", "month", "year", "mvp", "phase",
  "stripe", "khqr", "payway", "postgres", "postgresql", "supabase", "nextjs", "react",
  "node", "express", "redis", "docker", "vercel", "auth", "login", "signup", "dashboard",
]);

function pluralize(word) {
  const w = word.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!w) return "";
  if (w.endsWith("s")) return w;
  if (w.endsWith("y") && !/[aeiou]y$/.test(w)) return w.slice(0, -1) + "ies";
  if (/(ch|sh|x|z)$/.test(w)) return w + "es";
  return w + "s";
}

function singularize(word) {
  const w = word.toLowerCase();
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("ses") || w.endsWith("xes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function titleCase(s) {
  return (s || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTechStack(text) {
  const t = text || "";
  const isMobile = /\b(mobile|ios|android|flutter|react native|expo)\b/i.test(t);
  const isWeb = !isMobile || /\b(web|nextjs|next\.js|react|vue|nuxt|svelte|dashboard|admin)\b/i.test(t);
  const frontend = /\bvue|nuxt\b/i.test(t)
    ? "Vue 3 + Tailwind CSS"
    : /\bsvelte\b/i.test(t)
    ? "SvelteKit + Tailwind CSS"
    : /\bnext\.?js\b/i.test(t)
    ? "Next.js + TypeScript + Tailwind"
    : "React + TypeScript + Tailwind";
  const mobileTech = /\bflutter\b/i.test(t) ? "Flutter (iOS & Android)" : "React Native + Expo";
  const backend = /\bfastapi|python|django\b/i.test(t)
    ? "Python + FastAPI"
    : /\bgo|golang|gin|fiber\b/i.test(t)
    ? "Go + Chi REST"
    : /\bnest\.?js\b/i.test(t)
    ? "NestJS (TypeScript)"
    : /\bnext\.?js\b/i.test(t)
    ? "Next.js Route Handlers + Zod"
    : "Node.js + Express + TypeScript";
  const database = /\bsupabase\b/i.test(t)
    ? "PostgreSQL (Supabase)"
    : /\bneon\b/i.test(t)
    ? "PostgreSQL (Neon Serverless)"
    : /\bmysql|planetscale\b/i.test(t)
    ? "MySQL 8 (Managed)"
    : "PostgreSQL 16";
  const auth = /\bclerk\b/i.test(t)
    ? "Clerk Auth"
    : /\bsupabase\b/i.test(t)
    ? "Supabase Auth (JWT + OAuth)"
    : /\boauth|google\b/i.test(t)
    ? "Google OAuth + Email Magic Link"
    : "JWT + Email Magic Link";
  const payments = /\bkhqr|aba|payway\b/i.test(t) && /\bstripe\b/i.test(t)
    ? "Stripe + ABA PayWay (KHQR)"
    : /\bkhqr|aba|payway\b/i.test(t)
    ? "ABA PayWay (KHQR)"
    : /\bpaddle\b/i.test(t)
    ? "Paddle Billing"
    : /\blemon\s*squeezy\b/i.test(t)
    ? "Lemon Squeezy"
    : /\bstripe|payment|subscription|billing|checkout|paid|price|order|shop|booking\b/i.test(t)
    ? "Stripe Checkout & Webhooks"
    : "Not in MVP";
  const hosting = /\bfly\.?io\b/i.test(t)
    ? "Fly.io"
    : /\brailway\b/i.test(t)
    ? "Railway"
    : /\baws\b/i.test(t)
    ? "AWS (ECS + RDS)"
    : "Vercel + Managed Postgres";
  const platform = isMobile && isWeb ? "Web and mobile" : isMobile ? "Mobile (iOS & Android)" : "Web (responsive)";
  const languages = /\bpython|fastapi\b/i.test(t)
    ? "TypeScript + Python"
    : /\bgo|golang\b/i.test(t)
    ? "TypeScript + Go"
    : "TypeScript";

  return { isMobile, isWeb, frontend, mobileTech, backend, database, auth, payments, hosting, platform, languages };
}

function extractProjectName(message, currentName, archetype) {
  if (currentName && !/^(new project|untitled|my project|blueprint|sample)/i.test(currentName.trim()) && !/\(sample\)/i.test(currentName)) {
    return currentName;
  }
  // Look for explicit naming patterns: "called X", "named X", "Build X:", "X - a platform..."
  const namedMatch =
    message.match(/\b(?:called|named)\s+["']?([A-Z][A-Za-z0-9_-]{2,24})["']?/) ||
    message.match(/^(?:[Bb]uild|[Cc]reate|[Dd]esign)\s+([A-Z][A-Za-z0-9_-]{2,22})\s*[:-]/);
  if (namedMatch?.[1] && !STOP_NOUNS.has(namedMatch[1].toLowerCase())) {
    return namedMatch[1];
  }
  // Synthesize clean product name from top domain keyword
  const words = (message.toLowerCase().match(/\b[a-z]{4,14}\b/g) || []).filter((w) => !STOP_NOUNS.has(w) && !/^(want|build|create|make|with|that|where|from|into|have|need|like|also|able|allow|manage|track)$/.test(w));
  if (words.length) {
    const root = titleCase(singularize(words[0]));
    return `${root}${archetype?.titleSuffix || "Flow"}`;
  }
  return `Blueprint${archetype?.titleSuffix || "OS"}`;
}

function extractRequestedEntities(message, archetype) {
  const lower = message.toLowerCase();
  const matched = new Set(["users"]);

  // 1. Add archetype baseline entities if full blueprint
  if (archetype) {
    for (const e of archetype.entities) matched.add(e);
  }

  // 2. Match any known entity blueprint mentioned in user message (singular or plural)
  for (const key of Object.keys(ENTITY_BLUEPRINTS)) {
    const sing = singularize(key).replace(/_/g, "[\\s_-]+");
    const plur = key.replace(/_/g, "[\\s_-]+");
    const re = new RegExp(`\\b(${sing}|${plur})\\b`, "i");
    if (re.test(lower)) matched.add(key);
  }

  // 3. Extract explicit custom table names e.g. "table shelters", "add vaccinations table", "entities: shelters, pets, adoptions"
  const customTableMatches = [
    ...lower.matchAll(/\btable\s+[`"']?([a-z][a-z0-9_]{2,24})[`"']?/g),
    ...lower.matchAll(/[`"']?([a-z][a-z0-9_]{2,24})[`"']?\s+table\b/g),
    ...lower.matchAll(/\b(?:manage|track|list|book|submit|log|schedule|create)\s+([a-z]{3,18}s)\b/g),
  ];

  const customEntities = [];
  for (const m of customTableMatches) {
    const raw = pluralize(m[1]);
    if (!raw || STOP_NOUNS.has(raw) || STOP_NOUNS.has(singularize(raw))) continue;
    if (!ENTITY_BLUEPRINTS[raw] && !customEntities.includes(raw) && customEntities.length < 4) {
      customEntities.push(raw);
    } else if (ENTITY_BLUEPRINTS[raw]) {
      matched.add(raw);
    }
  }

  return { known: [...matched].slice(0, 8), custom: customEntities };
}

function buildDynamicEntitySpec(tableName, message) {
  const sing = singularize(tableName);
  const fields = [
    { name: "name", type: "varchar(140)" },
    { name: "description", type: "text", nullable: true },
    { name: "status", type: "varchar(30)", default: "'active'" },
  ];

  // Check if user specified columns like "with code, amount, expires_at"
  const withRegex = new RegExp(`${sing}s?\\s+(?:table\\s+)?with\\s+([a-z0-9_,\\s]+?)(?:\\.|;|and\\s+api|$)`, "i");
  const m = message.match(withRegex);
  if (m?.[1]) {
    const cols = m[1]
      .split(/,|\band\b/)
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))
      .filter((c) => c && c !== "id" && !STOP_NOUNS.has(c))
      .slice(0, 6);
    if (cols.length) {
      fields.length = 0;
      for (const col of cols) {
        const type = /price|amount|fee|cost|total|balance/.test(col)
          ? "numeric(10,2)"
          : /count|qty|quantity|age|score|number/.test(col)
          ? "integer"
          : /is_|has_|active|enabled|published/.test(col)
          ? "boolean"
          : /_at$|date|time|expires/.test(col)
          ? "timestamptz"
          : /meta|config|payload|data/.test(col)
          ? "jsonb"
          : "varchar(160)";
        fields.push({ name: col, type, unique: col === "code" || col === "slug" });
      }
    }
  }

  return {
    purpose: `Stores ${tableName.replace(/_/g, " ")} records and lifecycle status.`,
    refs: [{ col: "user_id", target: "users", onDelete: "CASCADE" }],
    fields,
  };
}

// ---------------------------------------------------------------------------
// Schema Builder with Valid PK/FK IDs and Clean Visual Grid Coordinates
// ---------------------------------------------------------------------------
function buildSchemaFromSpecs(entityNames, customNames, message, existingSchema = null, mergeMode = false) {
  const entities = mergeMode && existingSchema?.entities ? JSON.parse(JSON.stringify(existingSchema.entities)) : [];
  const relationships = mergeMode && existingSchema?.relationships ? JSON.parse(JSON.stringify(existingSchema.relationships)) : [];

  const byName = new Map(entities.map((e) => [e.name.toLowerCase(), e]));
  const allToEnsure = [...entityNames, ...customNames];

  // First pass: create entities & non-FK columns
  allToEnsure.forEach((rawName) => {
    const name = rawName.toLowerCase();
    if (byName.has(name)) return;
    const spec = ENTITY_BLUEPRINTS[name] || buildDynamicEntitySpec(name, message);
    const idx = entities.length;
    const col = idx % 3;
    const row = Math.floor(idx / 3);

    const pkField = {
      id: uid(),
      name: "id",
      type: "uuid",
      primary_key: true,
      nullable: false,
      unique: false,
      indexed: false,
      default: "gen_random_uuid()",
    };

    const fkPlaceholders = (spec.refs || []).map((ref) => ({
      id: uid(),
      name: ref.col,
      type: "uuid",
      primary_key: false,
      nullable: !!ref.nullable,
      unique: !!ref.unique,
      indexed: true,
      default: null,
      _refTarget: ref.target,
      _onDelete: ref.onDelete || (ref.nullable ? "SET NULL" : "CASCADE"),
    }));

    const dataFields = (spec.fields || []).map((f) => ({
      id: uid(),
      name: f.name,
      type: f.type || "varchar(255)",
      primary_key: false,
      nullable: !!f.nullable,
      unique: !!f.unique,
      indexed: !!f.indexed,
      default: f.default ?? null,
    }));

    const ent = {
      id: uid(),
      name,
      purpose: spec.purpose || `Domain records for ${name}.`,
      timestamps: true,
      x: col * 340,
      y: row * 280,
      fields: [pkField, ...fkPlaceholders, ...dataFields],
    };

    entities.push(ent);
    byName.set(name, ent);
  });

  // Second pass: wire FK relationships cleanly
  for (const ent of entities) {
    for (const fld of ent.fields) {
      if (!fld._refTarget) continue;
      let targetEnt = byName.get(fld._refTarget);
      if (!targetEnt && fld._refTarget !== "users") {
        targetEnt = byName.get("users");
      }
      const targetPk = targetEnt?.fields?.find((f) => f.primary_key);
      if (targetEnt && targetPk) {
        const exists = relationships.some(
          (r) => r.source_entity === ent.id && r.source_field === fld.id && r.target_entity === targetEnt.id
        );
        if (!exists) {
          relationships.push({
            id: uid(),
            source_entity: ent.id,
            source_field: fld.id,
            target_entity: targetEnt.id,
            target_field: targetPk.id,
            kind: fld.unique ? "one_to_one" : "one_to_many",
            on_delete: fld._onDelete || "CASCADE",
          });
        }
      }
      delete fld._refTarget;
      delete fld._onDelete;
    }
  }

  // Handle explicit column additions to existing table e.g. "add column phone to users"
  const addColMatch = message.match(/\badd\s+(?:column|field)\s+[`"']?([a-z][a-z0-9_]{1,30})[`"']?\s+to\s+[`"']?([a-z][a-z0-9_]{1,30})[`"']?/i);
  if (addColMatch) {
    const [, colName, tblRaw] = addColMatch;
    const tbl = byName.get(tblRaw.toLowerCase()) || byName.get(pluralize(tblRaw));
    if (tbl && !tbl.fields.some((f) => f.name === colName.toLowerCase())) {
      tbl.fields.push({
        id: uid(),
        name: colName.toLowerCase(),
        type: /date|time|_at$/.test(colName) ? "timestamptz" : /price|amount/.test(colName) ? "numeric(10,2)" : "varchar(160)",
        primary_key: false,
        nullable: true,
        unique: false,
        indexed: false,
        default: null,
      });
    }
  }

  return { entities, relationships };
}

// ---------------------------------------------------------------------------
// Architecture Builder (Passes reviewArchitecture with zero missing issues)
// ---------------------------------------------------------------------------
function buildArchitecture(projectName, tech, archetype, message) {
  const nodes = [];
  const edges = [];

  const addNode = (type, name, technology, responsibility, rationale, x, y, config = {}) => {
    const id = uid();
    nodes.push({ id, type, name, responsibility, technology, rationale, config, x, y });
    return id;
  };
  const connect = (source, target, protocol, label) => {
    if (source && target) edges.push({ id: uid(), source, target, protocol, label });
  };

  const webId = tech.isWeb
    ? addNode("web_frontend", "Web App", tech.frontend, `Responsive UI for ${projectName} workflows`, "Fast component iteration with shared TypeScript contracts", 0, 120)
    : null;
  const mobId = tech.isMobile
    ? addNode("mobile_frontend", "Mobile App", tech.mobileTech, "Native iOS & Android client experience", "Cross-platform mobile reach from a single codebase", 0, 300)
    : null;

  const apiId = addNode(
    "backend",
    "Application API",
    tech.backend,
    "REST endpoints, domain validation, and RBAC enforcement",
    "Modular monolith keeps deployment simple while isolating domain modules",
    340,
    160
  );

  const dbId = addNode(
    "database",
    "Primary Database",
    tech.database,
    "Normalized relational persistence with ACID transactions",
    "Strong foreign-key integrity and JSONB flexibility",
    700,
    40,
    { backups: "daily" }
  );

  const authId = addNode(
    "auth",
    "Auth & Sessions",
    tech.auth,
    "Identity verification, sessions, and role claims",
    "Zero-friction onboarding with secure HttpOnly/JWT tokens",
    700,
    220
  );

  const emailId = addNode(
    "email",
    "Transactional Email",
    "Resend",
    "Magic links, invites, and transactional notifications",
    "Clean REST SDK and high deliverability",
    1040,
    220
  );

  connect(webId, apiId, "HTTPS REST", "JSON / typed API client");
  connect(mobId, apiId, "HTTPS REST", "Mobile REST client");
  connect(apiId, dbId, "SQL / database access", "Parameterized queries / Prisma");
  connect(apiId, authId, "SDK", "Verify session & role");
  connect(authId, emailId, "HTTPS REST", "Send auth & invite emails");

  const hasPay = tech.payments !== "Not in MVP" || archetype?.needsPayments;
  if (hasPay) {
    const payId = addNode(
      "payments",
      "Payment Gateway",
      tech.payments === "Not in MVP" ? "Stripe" : tech.payments,
      "Checkout sessions, KHQR/card capture, and signed webhooks",
      "Offloads PCI compliance with idempotent webhook confirmation",
      700,
      400
    );
    connect(apiId, payId, "HTTPS REST", "Create checkout intent");
    connect(payId, apiId, "Webhook", "Signed payment status webhook");
  }

  if (archetype?.needsStorage || /\b(upload|image|photo|file|s3|r2|media|document|pdf|video)\b/i.test(message)) {
    const storeId = addNode(
      "storage",
      "Object Storage",
      "Cloudflare R2 / S3",
      "Signed uploads for media, attachments, and exports",
      "Zero-egress S3-compatible object storage",
      1040,
      40
    );
    connect(apiId, storeId, "SDK", "Pre-signed upload/download URLs");
  }

  if (archetype?.needsRealtime || /\b(redis|cache|realtime|real-time|live|socket|chat|tracking)\b/i.test(message)) {
    const cacheId = addNode(
      "cache",
      "Realtime / Cache",
      "Upstash Redis",
      "Pub/Sub live state updates and rate-limit counters",
      "Low-latency ephemeral state without managing Redis clusters",
      340,
      400
    );
    connect(apiId, cacheId, "Events", "Pub/Sub & hot state");
  }

  if (archetype?.needsWorker || /\b(worker|queue|background|cron|reminder|job|bullmq|ai|index)\b/i.test(message)) {
    const workerId = addNode(
      "worker",
      "Background Worker",
      "Queue Worker / Cron",
      "Async notifications, reminders, and scheduled jobs",
      "Keeps user-facing API responses under 150ms",
      1040,
      400
    );
    connect(apiId, workerId, "Background job", "Enqueue async jobs");
    connect(workerId, dbId, "SQL / database access", "Persist job outcomes");
  }

  const hostId = addNode(
    "hosting",
    "Hosting & CI/CD",
    tech.hosting,
    "Automated preview & production deployments",
    "Zero-downtime deploys on git push within MVP budget",
    0,
    460
  );
  connect(hostId, webId || apiId, "Deploy", "CI/CD pipeline");

  const monId = addNode(
    "monitoring",
    "Monitoring & Logs",
    "Sentry + Structured Logs",
    "Error tracking, latency alerts, and request tracing",
    "Immediate visibility into production exceptions",
    340,
    -40
  );
  connect(apiId, monId, "SDK", "Error & trace telemetry");

  const summary = `${projectName} uses a clean modular architecture: ${tech.isWeb ? tech.frontend : tech.mobileTech} communicates over HTTPS REST with ${tech.backend} backed by ${tech.database}. Authentication runs via ${tech.auth}${hasPay ? `, payments settle via ${tech.payments === "Not in MVP" ? "Stripe" : tech.payments} signed webhooks` : ""}, and ${tech.hosting} handles automated deployments with Sentry observability.`;

  return { summary, nodes, edges };
}

// ---------------------------------------------------------------------------
// Features, Endpoints & Roadmap Builders Cross-Linked to Schema Entities
// ---------------------------------------------------------------------------
function buildFeatures(projectName, schema, archetype, tech) {
  const domainEntities = schema.entities.filter((e) => e.name !== "users");
  const features = [];

  const authFeatId = uid();
  features.push({
    id: authFeatId,
    title: "Authentication & Role Access",
    description: `Secure sign-in (${tech.auth}) with role-scoped permissions for ${(archetype?.roles || []).map((r) => r.name).join(", ") || "workspace users"}.`,
    priority: "P0",
    scope: "mvp",
    depends_on: [],
    completion_criteria: [
      "Users can sign up, sign in, and maintain secure sessions",
      "Protected routes enforce role permissions cleanly",
    ],
    needs_review: false,
    review_reason: null,
    stories: [
      {
        id: uid(),
        as_a: (archetype?.roles?.[0]?.name || "user").toLowerCase(),
        i_want: "to sign in quickly without friction",
        so_that: `I can access my ${projectName} workspace securely`,
        acceptance_criteria: ["Unauthenticated API requests return 401", "Session persists across page reloads"],
      },
    ],
  });

  // Core domain MVP features from top entities
  domainEntities.slice(0, 4).forEach((ent, idx) => {
    const label = titleCase(ent.name);
    const sing = singularize(ent.name).replace(/_/g, " ");
    const fid = uid();
    features.push({
      id: fid,
      title: `${label} Management`,
      description: ent.purpose || `Create, view, filter, and update ${ent.name.replace(/_/g, " ")}.`,
      priority: idx < 2 ? "P0" : "P1",
      scope: "mvp",
      depends_on: [authFeatId],
      completion_criteria: [
        `Authorized users can create and list ${ent.name.replace(/_/g, " ")}`,
        `Validation rules enforce ${ent.name} schema constraints`,
      ],
      needs_review: false,
      review_reason: null,
      _entityId: ent.id,
      stories: [
        {
          id: uid(),
          as_a: (archetype?.roles?.[idx % (archetype?.roles?.length || 1)]?.name || "member").toLowerCase(),
          i_want: `to manage ${ent.name.replace(/_/g, " ")} in real time`,
          so_that: `every ${sing} stays accurate without manual spreadsheets`,
          acceptance_criteria: [
            `Creating a ${sing} validates required fields`,
            `List view supports status filtering and pagination`,
          ],
        },
      ],
    });
  });

  // Later / Phase 2 features
  features.push({
    id: uid(),
    title: "Analytics & Export Reports",
    description: "Operational metrics dashboard with CSV/Markdown/JSON export for stakeholders.",
    priority: "P2",
    scope: "later",
    depends_on: [authFeatId],
    completion_criteria: ["Admins can filter date ranges and export reports"],
    needs_review: false,
    review_reason: null,
    stories: [],
  });

  features.push({
    id: uid(),
    title: "Automated Webhooks & Integrations",
    description: "Outbound webhooks and Slack/Telegram alerts on key domain events.",
    priority: "P2",
    scope: "later",
    depends_on: [],
    completion_criteria: ["Signed webhook payloads retry with exponential backoff"],
    needs_review: false,
    review_reason: null,
    stories: [],
  });

  // Out of scope
  features.push({
    id: uid(),
    title: "On-Premise Enterprise SAML / Custom ERP",
    description: "Self-hosted enterprise SSO and legacy ERP sync excluded from initial launch.",
    priority: "P3",
    scope: "out",
    depends_on: [],
    completion_criteria: [],
    needs_review: false,
    review_reason: null,
    stories: [],
  });

  return features;
}

function buildEndpoints(schema, features, archetype) {
  const endpoints = [];
  const usersEnt = schema.entities.find((e) => e.name === "users");
  const authFeat = features[0];

  if (usersEnt) {
    endpoints.push({
      id: uid(),
      method: "POST",
      path: "/api/auth/session",
      purpose: "Authenticate user credentials or magic token and issue session.",
      auth_required: false,
      role: "Public",
      request_schema: '{ "email": "founder@example.com" }',
      response_schema: '{ "user": { "id": "uuid", "email": "founder@example.com", "role": "member" } }',
      validation: ["email: required, valid RFC-5322 email, lowercase trimmed"],
      errors: ["400 Bad Request – invalid email", "429 Too Many Requests – rate limit exceeded"],
      rate_limit: "10/min per IP",
      entity_ids: [usersEnt.id],
      feature_id: authFeat?.id || null,
      test_cases: ["Valid login issues HttpOnly session cookie", "Invalid payload returns 400"],
      needs_review: false,
      review_reason: null,
    });
  }

  const domainEntities = schema.entities.filter((e) => e.name !== "users");
  for (const ent of domainEntities.slice(0, 5)) {
    const slug = ent.name.toLowerCase().replace(/_/g, "-");
    const sing = singularize(ent.name).replace(/_/g, " ");
    const linkedFeat = features.find((f) => f._entityId === ent.id) || features.find((f) => f.title.toLowerCase().includes(sing.split(" ")[0])) || authFeat;
    const writableFields = ent.fields.filter((f) => !f.primary_key && !f.name.endsWith("_id") && f.name !== "user_id").slice(0, 4);

    const sampleReqObj = {};
    const sampleResObj = { id: "uuid" };
    for (const f of writableFields) {
      const sampleVal = f.type.includes("numeric")
        ? 29.0
        : f.type.includes("int")
        ? 1
        : f.type === "boolean"
        ? true
        : f.type === "date"
        ? "2026-11-15"
        : f.type === "timestamptz"
        ? "2026-11-15T10:00:00Z"
        : f.type === "jsonb"
        ? {}
        : `sample_${f.name}`;
      sampleReqObj[f.name] = sampleVal;
      sampleResObj[f.name] = sampleVal;
    }
    sampleResObj.created_at = "ISO datetime";

    const roleName = archetype?.roles?.[0]?.name || "Authenticated user";

    // GET list
    endpoints.push({
      id: uid(),
      method: "GET",
      path: `/api/${slug}`,
      purpose: `List and filter ${ent.name.replace(/_/g, " ")} scoped to the caller's permissions.`,
      auth_required: true,
      role: roleName,
      request_schema: "// Query params: ?status=active&limit=20&cursor=...",
      response_schema: JSON.stringify({ items: [sampleResObj], next_cursor: null }, null, 2),
      validation: ["limit: integer 1..100 (default 20)", "Results strictly scoped to authorized tenant/user"],
      errors: ["401 Unauthorized – missing session", "403 Forbidden – insufficient role"],
      rate_limit: "60/min per user",
      entity_ids: [ent.id],
      feature_id: linkedFeat?.id || null,
      test_cases: [`Returns paginated ${ent.name} for authorized caller`, "Cross-tenant records are never leaked"],
      needs_review: false,
      review_reason: null,
    });

    // POST create
    endpoints.push({
      id: uid(),
      method: "POST",
      path: `/api/${slug}`,
      purpose: `Create a new ${sing} record with validated domain fields.`,
      auth_required: true,
      role: archetype?.roles?.[1]?.name || roleName,
      request_schema: JSON.stringify(sampleReqObj, null, 2),
      response_schema: JSON.stringify(sampleResObj, null, 2),
      validation: [
        ...writableFields.filter((f) => !f.nullable).map((f) => `${f.name}: required (${f.type})`),
        "Owner/actor ID derived from authenticated session, never trusted from body",
      ],
      errors: [
        "401 Unauthorized – missing session",
        "422 Unprocessable Entity – schema validation failed",
        "409 Conflict – unique constraint violation",
      ],
      rate_limit: "20/min per user",
      entity_ids: [ent.id],
      feature_id: linkedFeat?.id || null,
      test_cases: [
        `Valid payload creates ${sing} and returns 201`,
        "Missing required field returns 422 with field errors",
      ],
      needs_review: false,
      review_reason: null,
    });

    // PATCH update for key stateful tables
    if (ent.fields.some((f) => f.name === "status" || f.name === "progress_pct" || f.name === "is_open")) {
      endpoints.push({
        id: uid(),
        method: "PATCH",
        path: `/api/${slug}/:id`,
        purpose: `Update status or mutable attributes of an existing ${sing}.`,
        auth_required: true,
        role: archetype?.roles?.[1]?.name || roleName,
        request_schema: '{ "status": "completed" }',
        response_schema: JSON.stringify({ ...sampleResObj, status: "completed" }, null, 2),
        validation: ["id: valid UUID", "Caller must own or have role permission on target resource"],
        errors: ["401 Unauthorized", "403 Forbidden", "404 Not Found – record does not exist"],
        rate_limit: "30/min per user",
        entity_ids: [ent.id],
        feature_id: linkedFeat?.id || null,
        test_cases: [`Updates ${sing} state atomically`, "Unauthorized user receives 403/404"],
        needs_review: false,
        review_reason: null,
      });
    }
  }

  // Webhook endpoint if payments exist
  if (schema.entities.some((e) => e.name === "payments" || e.name === "subscriptions")) {
    const payEnt = schema.entities.find((e) => e.name === "payments" || e.name === "subscriptions");
    endpoints.push({
      id: uid(),
      method: "POST",
      path: "/api/webhooks/payments",
      purpose: "Verify cryptographic gateway signature and reconcile payment/subscription status idempotently.",
      auth_required: false,
      role: "Signed Gateway Webhook",
      request_schema: '{ "event_id": "evt_123", "type": "payment.succeeded", "data": { "external_ref": "pay_123" } }',
      response_schema: '{ "received": true }',
      validation: [
        "Verify HMAC / Stripe-Signature against raw request body",
        "Idempotent check on external_ref to ignore duplicate deliveries",
      ],
      errors: ["400 Bad Request – invalid signature"],
      rate_limit: "120/min per IP",
      entity_ids: payEnt ? [payEnt.id] : [],
      feature_id: null,
      test_cases: ["Invalid signature returns 400", "Duplicate webhook event is safely idempotent"],
      needs_review: false,
      review_reason: null,
    });
  }

  return endpoints;
}

function buildRoadmap(projectName, tech, schema, endpoints, features) {
  const tasks = [];
  const t1 = uid();
  tasks.push({
    id: t1,
    milestone: 1,
    title: `Initialize ${projectName} repository, TypeScript config, and lint pipeline`,
    description: `Scaffold ${tech.frontend} and ${tech.backend} workspace with environment validation.`,
    deliverable: "Bootable project skeleton with CI lint check",
    depends_on: [],
    files: ["package.json", ".env.example", "src/config/env.ts"],
    acceptance_criteria: [
      { text: "Dev server boots cleanly", checked: false },
      { text: "Strict TypeScript & lint checks pass", checked: false },
    ],
    tests: ["Env schema startup check"],
    complexity: "S",
    status: "ready",
    feature_id: null,
    endpoint_ids: [],
    entity_ids: [],
    needs_review: false,
    review_reason: null,
  });

  const t2 = uid();
  tasks.push({
    id: t2,
    milestone: 2,
    title: `Apply PostgreSQL schema migrations for ${schema.entities.length} core tables`,
    description: `Create migrations and indexes for ${schema.entities.map((e) => e.name).join(", ")}.`,
    deliverable: "Verified database schema & seed script",
    depends_on: [t1],
    files: ["prisma/schema.prisma", "migrations/001_init.sql"],
    acceptance_criteria: [
      { text: "All tables, PKs, and FK constraints apply cleanly", checked: false },
      { text: "Foreign-key columns have B-tree indexes", checked: false },
    ],
    tests: ["Migration up/down smoke test"],
    complexity: "M",
    status: "ready",
    feature_id: null,
    endpoint_ids: [],
    entity_ids: schema.entities.map((e) => e.id),
    needs_review: false,
    review_reason: null,
  });

  const t3 = uid();
  tasks.push({
    id: t3,
    milestone: 3,
    title: `Implement ${tech.auth} authentication and role middleware`,
    description: "Wire session cookies/tokens and RBAC guards across protected routes.",
    deliverable: "Working sign-in flow and auth middleware",
    depends_on: [t2],
    files: ["src/middleware/auth.ts", "src/routes/auth.ts"],
    acceptance_criteria: [
      { text: "Unauthenticated calls to protected endpoints return 401", checked: false },
      { text: "Role checks prevent cross-tenant IDOR access", checked: false },
    ],
    tests: ["Auth session & RBAC integration test"],
    complexity: "M",
    status: "ready",
    feature_id: features[0]?.id || null,
    endpoint_ids: endpoints.slice(0, 1).map((e) => e.id),
    entity_ids: schema.entities.filter((e) => e.name === "users").map((e) => e.id),
    needs_review: false,
    review_reason: null,
  });

  const t4 = uid();
  tasks.push({
    id: t4,
    milestone: 4,
    title: "Build core domain REST endpoints & validation schemas",
    description: `Implement validated handlers for ${endpoints.slice(1, 6).map((e) => `${e.method} ${e.path}`).join(", ")}.`,
    deliverable: "Tested REST API handlers matching OpenAPI/catalog contracts",
    depends_on: [t3],
    files: ["src/routes/api.ts", "src/validators/domain.ts"],
    acceptance_criteria: [
      { text: "Request payloads validated with structured 422 errors", checked: false },
      { text: "All queries scoped to authenticated tenant/user", checked: false },
    ],
    tests: ["API contract integration tests"],
    complexity: "L",
    status: "ready",
    feature_id: features[1]?.id || null,
    endpoint_ids: endpoints.slice(1, 6).map((e) => e.id),
    entity_ids: schema.entities.slice(1, 4).map((e) => e.id),
    needs_review: false,
    review_reason: null,
  });

  const t5 = uid();
  tasks.push({
    id: t5,
    milestone: 6,
    title: "Build primary UI flows, empty/loading states, and form actions",
    description: `Connect ${tech.frontend} views to live API endpoints with optimistic feedback.`,
    deliverable: "End-to-end interactive MVP user journey",
    depends_on: [t4],
    files: ["src/pages/Dashboard.tsx", "src/components/DomainForms.tsx"],
    acceptance_criteria: [
      { text: "Primary user journey works end-to-end on desktop & mobile", checked: false },
      { text: "Loading, empty, and error states handled gracefully", checked: false },
    ],
    tests: ["Playwright E2E happy-path smoke test"],
    complexity: "L",
    status: "ready",
    feature_id: features[1]?.id || null,
    endpoint_ids: [],
    entity_ids: [],
    needs_review: false,
    review_reason: null,
  });

  if (tech.payments !== "Not in MVP" || schema.entities.some((e) => e.name === "payments")) {
    tasks.push({
      id: uid(),
      milestone: 8,
      title: `Integrate ${tech.payments === "Not in MVP" ? "payment" : tech.payments} checkout & signed webhook handler`,
      description: "Verify webhook signatures and update payment/order ledger idempotently.",
      deliverable: "Verified sandbox checkout & webhook reconciliation",
      depends_on: [t4],
      files: ["src/routes/webhooks.ts", "src/services/billing.ts"],
      acceptance_criteria: [
        { text: "Webhook verifies cryptographic signature on raw body", checked: false },
        { text: "Duplicate webhook deliveries are idempotent", checked: false },
      ],
      tests: ["Webhook replay & invalid signature tests"],
      complexity: "M",
      status: "ready",
      feature_id: null,
      endpoint_ids: endpoints.filter((e) => e.path.includes("webhook")).map((e) => e.id),
      entity_ids: schema.entities.filter((e) => e.name === "payments" || e.name === "subscriptions").map((e) => e.id),
      needs_review: false,
      review_reason: null,
    });
  }

  tasks.push({
    id: uid(),
    milestone: 9,
    title: "Run integration test suite & security IDOR audit",
    description: "Verify tenant isolation, input sanitization, and rate limits across endpoints.",
    deliverable: "Green CI suite & security sign-off",
    depends_on: [t5],
    files: ["tests/api.spec.ts", "tests/e2e.spec.ts"],
    acceptance_criteria: [
      { text: "Cross-user access attempts return 403/404", checked: false },
      { text: "Zero unhandled promise rejections", checked: false },
    ],
    tests: ["Vitest + Playwright CI suite"],
    complexity: "M",
    status: "ready",
    feature_id: null,
    endpoint_ids: [],
    entity_ids: [],
    needs_review: false,
    review_reason: null,
  });

  tasks.push({
    id: uid(),
    milestone: 11,
    title: `Deploy production build to ${tech.hosting} with daily DB backups & Sentry`,
    description: "Configure production secrets, health checks, SSL domain, and error alerting.",
    deliverable: "Live production URL with health & error monitoring",
    depends_on: [t5],
    files: ["Dockerfile", ".github/workflows/deploy.yml"],
    acceptance_criteria: [
      { text: "/api/health returns 200 OK in production", checked: false },
      { text: "Automated daily Postgres backups enabled", checked: false },
    ],
    tests: ["Post-deploy smoke check"],
    complexity: "S",
    status: "ready",
    feature_id: null,
    endpoint_ids: [],
    entity_ids: [],
    needs_review: false,
    review_reason: null,
  });

  return tasks;
}

// ---------------------------------------------------------------------------
// Intent Detection: Full Idea Decomposition vs Targeted Module Update
// ---------------------------------------------------------------------------
function detectTargetModules(message, explicitTargets, isFreshProject) {
  if (Array.isArray(explicitTargets) && explicitTargets.length > 0 && !explicitTargets.includes("auto")) {
    return { mode: explicitTargets.length >= 5 ? "full" : "targeted", targets: new Set(explicitTargets) };
  }

  const m = message.toLowerCase();
  const isFullIdea =
    isFreshProject ||
    /\b(i want to build|build a|build an|create a|create an|design a|my idea|app idea|startup|platform for|system for|app where|app that|clone of|like uber|like airbnb|like shopify|like notion|from scratch|full blueprint|all panels|every panel)\b/i.test(m) ||
    m.split(/\s+/).length >= 22;

  if (isFullIdea && !/\b(only|just)\s+(database|schema|table|api|endpoint|architecture|roadmap|doc)\b/i.test(m)) {
    return {
      mode: "full",
      targets: new Set(["brief", "spec", "features", "flows", "ui", "architecture", "schema", "api", "security", "roadmap", "testing", "docs"]),
    };
  }

  // Targeted follow-up detection
  const targets = new Set();
  if (/\b(table|tables|column|columns|field|schema|database|erd|sql|prisma|foreign key|relation|entity|entities)\b/i.test(m)) {
    targets.add("schema");
  }
  if (/\b(api|endpoint|endpoints|route|routes|rest|webhook|get\s+\/|post\s+\/|put\s+\/|patch\s+\/|delete\s+\/)\b/i.test(m)) {
    targets.add("api");
  }
  if (/\b(architecture|stack|redis|cache|worker|queue|storage|s3|r2|cdn|gateway|microservice|websocket|hosting|sentry|component|diagram)\b/i.test(m)) {
    targets.add("architecture");
  }
  if (/\b(feature|features|story|stories|mvp|scope|kanban)\b/i.test(m)) {
    targets.add("features");
  }
  if (/\b(requirement|requirements|prd|spec|role|roles|permission|goal|metric|risk)\b/i.test(m)) {
    targets.add("spec");
  }
  if (/\b(brief|budget|deadline|pricing|business model|audience)\b/i.test(m)) {
    targets.add("brief");
  }
  if (/\b(roadmap|task|tasks|milestone|sprint|todo|deliverable)\b/i.test(m)) {
    targets.add("roadmap");
  }
  if (/\b(flow|flows|journey|journeys|onboarding|step-by-step|branch|branches)\b/i.test(m)) {
    targets.add("flows");
  }
  if (/\b(ui|ux|wireframe|wireframes|screen|screens|sitemap|token|tokens|palette|typography|layout|mobile preview)\b/i.test(m)) {
    targets.add("ui");
  }
  if (/\b(security|idor|owasp|threat|threats|rate limit|secret|secrets|csrf|xss|audit|backup|encryption|control|controls)\b/i.test(m)) {
    targets.add("security");
  }
  if (/\b(test|tests|testing|vitest|playwright|e2e|unit test|integration test|coverage|qa|spec\.ts)\b/i.test(m)) {
    targets.add("testing");
  }
  if (/\b(md|markdown|doc|docs|note|notes|readme|guide)\b/i.test(m)) {
    targets.add("docs");
  }

  // When a user says "Add coupons / reviews / subscriptions / chat" without naming a specific panel,
  // smartly route across the relevant domain panels (Features + Database + API + Roadmap + Docs)!
  if (targets.size === 0 || (targets.size === 1 && targets.has("features"))) {
    targets.add("features");
    targets.add("schema");
    targets.add("api");
    targets.add("roadmap");
    targets.add("docs");
    if (/\b(payment|stripe|khqr|redis|cache|worker|upload|chat|socket|email)\b/i.test(m)) {
      targets.add("architecture");
    }
  } else {
    // If schema changed and user didn't say "only schema", keep API & docs in sync if endpoints were implied
    if (targets.has("schema") && !/\bonly\b/i.test(m) && /\b(add|create|support|with)\b/i.test(m) && !/\bcolumn|field\b/i.test(m)) {
      targets.add("api");
    }
    targets.add("docs");
  }

  return { mode: "targeted", targets };
}

// ---------------------------------------------------------------------------
// Strict Normalizer (Used for both Live LLM JSON and Built-in Engine)
// ---------------------------------------------------------------------------
export function normalizeModuleUpdates(updates, existingArtifacts = {}) {
  const out = {};

  if (updates.brief) {
    const prev = existingArtifacts.brief?.content || {};
    out.brief = {
      ...prev,
      ...updates.brief,
      mvp_features: Array.isArray(updates.brief.mvp_features) ? updates.brief.mvp_features.map(String) : prev.mvp_features || [],
      assumptions: Array.isArray(updates.brief.assumptions)
        ? updates.brief.assumptions.map((a) => (typeof a === "string" ? { field: "general", assumption: a } : { field: a.field || "general", assumption: a.assumption || "" }))
        : prev.assumptions || [],
    };
  }

  if (updates.spec) {
    const prev = existingArtifacts.spec?.content || {};
    const s = updates.spec;
    out.spec = {
      problem_statement: s.problem_statement ?? prev.problem_statement ?? "",
      target_audience: s.target_audience ?? prev.target_audience ?? "",
      value_proposition: s.value_proposition ?? prev.value_proposition ?? "",
      goals: Array.isArray(s.goals)
        ? s.goals.map((g) => (typeof g === "string" ? { goal: g, metric: "Target KPI tracked monthly" } : { goal: g.goal || "", metric: g.metric || "" }))
        : prev.goals || [],
      roles: Array.isArray(s.roles)
        ? s.roles.map((r) => ({
            name: r.name || "Member",
            permissions: Array.isArray(r.permissions) ? r.permissions.map(String) : r.description ? [r.description] : ["Standard access"],
          }))
        : prev.roles || [],
      functional_requirements: Array.isArray(s.functional_requirements) ? s.functional_requirements.map(String) : prev.functional_requirements || [],
      nonfunctional_requirements: Array.isArray(s.nonfunctional_requirements) ? s.nonfunctional_requirements.map(String) : prev.nonfunctional_requirements || [],
      mvp_scope: Array.isArray(s.mvp_scope) ? s.mvp_scope.map(String) : prev.mvp_scope || [],
      phase2_scope: Array.isArray(s.phase2_scope) ? s.phase2_scope.map(String) : prev.phase2_scope || [],
      out_of_scope: Array.isArray(s.out_of_scope) ? s.out_of_scope.map(String) : prev.out_of_scope || [],
      risks: Array.isArray(s.risks) ? s.risks.map((r) => (typeof r === "string" ? r : `${r.risk}: ${r.mitigation || ""}`)) : prev.risks || [],
      open_questions: Array.isArray(s.open_questions) ? s.open_questions.map(String) : prev.open_questions || [],
    };
  }

  if (updates.features) {
    const list = Array.isArray(updates.features) ? updates.features : updates.features.features || [];
    out.features = {
      features: list.map((f) => ({
        id: f.id || uid(),
        title: f.title || f.name || "Untitled feature",
        description: f.description || f.user_story || "",
        priority: ["P0", "P1", "P2", "P3"].includes(f.priority) ? f.priority : "P1",
        scope: ["mvp", "later", "out"].includes(f.scope) ? f.scope : "mvp",
        depends_on: Array.isArray(f.depends_on) ? f.depends_on : [],
        completion_criteria: Array.isArray(f.completion_criteria) ? f.completion_criteria.map(String) : [],
        needs_review: false,
        review_reason: null,
        stories: Array.isArray(f.stories)
          ? f.stories.map((st) => ({
              id: st.id || uid(),
              as_a: st.as_a || "user",
              i_want: st.i_want || "",
              so_that: st.so_that || "",
              acceptance_criteria: Array.isArray(st.acceptance_criteria) ? st.acceptance_criteria.map(String) : [],
            }))
          : [],
      })),
    };
  }

  if (updates.architecture) {
    const rawNodes = updates.architecture.nodes || [];
    const nodeIdMap = new Map();
    const nodes = rawNodes.map((n, idx) => {
      const id = n.id || uid();
      nodeIdMap.set(n.id || n.name, id);
      nodeIdMap.set(n.name, id);
      const type = VALID_NODE_TYPES.has(n.type) ? n.type : "backend";
      return {
        id,
        type,
        name: n.name || "Component",
        responsibility: n.responsibility || "",
        technology: n.technology || "",
        rationale: n.rationale || "",
        config: n.config && typeof n.config === "object" ? n.config : {},
        x: Number.isFinite(n.x) ? n.x : Number.isFinite(n.position?.x) ? n.position.x : (idx % 3) * 340,
        y: Number.isFinite(n.y) ? n.y : Number.isFinite(n.position?.y) ? n.position.y : Math.floor(idx / 3) * 200,
      };
    });
    const validIds = new Set(nodes.map((n) => n.id));
    const edges = (updates.architecture.edges || [])
      .map((e) => {
        const source = validIds.has(e.source) ? e.source : nodeIdMap.get(e.source);
        const target = validIds.has(e.target) ? e.target : nodeIdMap.get(e.target);
        if (!source || !target) return null;
        return {
          id: e.id || uid(),
          source,
          target,
          protocol: VALID_PROTOCOLS.has(e.protocol) ? e.protocol : "HTTPS REST",
          label: e.label || "",
        };
      })
      .filter(Boolean);

    out.architecture = {
      summary: updates.architecture.summary || "Modular service architecture.",
      nodes,
      edges,
    };
  }

  if (updates.schema) {
    const rawEntities = updates.schema.entities || [];
    const entNameMap = new Map();
    const entIdMap = new Map();

    const entities = rawEntities.map((e, idx) => {
      const eid = e.id || uid();
      const name = (e.name || `table_${idx + 1}`).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      const fields = (e.fields || []).map((f) => ({
        id: f.id || uid(),
        name: (f.name || "column").toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        type: f.type || "varchar(255)",
        primary_key: !!f.primary_key,
        nullable: f.primary_key ? false : !!f.nullable,
        unique: !!f.unique,
        indexed: !!f.indexed,
        default: f.default ?? (f.primary_key && (f.type || "uuid").toLowerCase() === "uuid" ? "gen_random_uuid()" : null),
      }));
      if (!fields.some((f) => f.primary_key)) {
        fields.unshift({
          id: uid(),
          name: "id",
          type: "uuid",
          primary_key: true,
          nullable: false,
          unique: false,
          indexed: false,
          default: "gen_random_uuid()",
        });
      }
      const ent = {
        id: eid,
        name,
        purpose: e.purpose || "",
        timestamps: e.timestamps !== false,
        x: Number.isFinite(e.x) ? e.x : (idx % 3) * 340,
        y: Number.isFinite(e.y) ? e.y : Math.floor(idx / 3) * 280,
        fields,
      };
      entNameMap.set(name, ent);
      entIdMap.set(eid, ent);
      if (e.id) entIdMap.set(e.id, ent);
      return ent;
    });

    const relationships = (updates.schema.relationships || [])
      .map((r) => {
        const src = entIdMap.get(r.source_entity) || entNameMap.get((r.source_entity || r.from_table || "").toLowerCase());
        const tgt = entIdMap.get(r.target_entity) || entNameMap.get((r.target_entity || r.to_table || "").toLowerCase());
        if (!src || !tgt) return null;
        const srcField =
          src.fields.find((f) => f.id === r.source_field) ||
          src.fields.find((f) => f.name === (r.source_field || r.from_field || "").toLowerCase()) ||
          src.fields.find((f) => f.name === `${singularize(tgt.name)}_id`);
        const tgtField =
          tgt.fields.find((f) => f.id === r.target_field) ||
          tgt.fields.find((f) => f.primary_key) ||
          tgt.fields[0];
        if (!srcField || !tgtField) return null;
        return {
          id: r.id || uid(),
          source_entity: src.id,
          source_field: srcField.id,
          target_entity: tgt.id,
          target_field: tgtField.id,
          kind: ["one_to_one", "one_to_many", "many_to_many"].includes(r.kind) ? r.kind : "one_to_many",
          on_delete: ["CASCADE", "RESTRICT", "SET NULL", "NO ACTION"].includes((r.on_delete || "").toUpperCase())
            ? r.on_delete.toUpperCase()
            : "CASCADE",
        };
      })
      .filter(Boolean);

    out.schema = { entities, relationships };
  }

  const activeSchema = out.schema || existingArtifacts.schema?.content || { entities: [] };
  const entLookup = new Map((activeSchema.entities || []).flatMap((e) => [[e.id, e.id], [e.name, e.id]]));
  const activeFeatures = out.features || existingArtifacts.features?.content || { features: [] };
  const validFeatIds = new Set((activeFeatures.features || []).map((f) => f.id));

  if (updates.api) {
    const list = Array.isArray(updates.api) ? updates.api : updates.api.endpoints || [];
    out.api = {
      endpoints: list.map((ep) => ({
        id: ep.id || uid(),
        method: VALID_METHODS.has((ep.method || "").toUpperCase()) ? ep.method.toUpperCase() : "GET",
        path: ep.path?.startsWith("/") ? ep.path : `/api/${ep.path || "resource"}`,
        purpose: ep.purpose || ep.summary || "",
        auth_required: ep.auth_required !== false,
        role: ep.role || (ep.auth_required === false ? "Public" : "Authenticated user"),
        request_schema: typeof ep.request_schema === "string" ? ep.request_schema : ep.request_schema ? JSON.stringify(ep.request_schema, null, 2) : "",
        response_schema: typeof ep.response_schema === "string" ? ep.response_schema : ep.response_schema ? JSON.stringify(ep.response_schema, null, 2) : "",
        validation: Array.isArray(ep.validation) ? ep.validation.map(String) : [],
        errors: Array.isArray(ep.errors) ? ep.errors.map(String) : [],
        rate_limit: ep.rate_limit || "60/min per user",
        entity_ids: Array.isArray(ep.entity_ids) ? ep.entity_ids.map((x) => entLookup.get(x)).filter(Boolean) : [],
        feature_id: validFeatIds.has(ep.feature_id) ? ep.feature_id : null,
        test_cases: Array.isArray(ep.test_cases) ? ep.test_cases.map(String) : [],
        needs_review: false,
        review_reason: null,
      })),
    };
  }

  if (updates.roadmap) {
    const list = Array.isArray(updates.roadmap) ? updates.roadmap : updates.roadmap.tasks || [];
    out.roadmap = {
      tasks: list.map((t, idx) => ({
        id: t.id || uid(),
        milestone: Number.isInteger(t.milestone) && t.milestone >= 1 && t.milestone <= 12 ? t.milestone : Math.min(12, (idx % 8) + 1),
        title: t.title || "Implementation task",
        description: t.description || "",
        deliverable: t.deliverable || "",
        depends_on: Array.isArray(t.depends_on) ? t.depends_on : [],
        files: Array.isArray(t.files) ? t.files.map(String) : [],
        acceptance_criteria: Array.isArray(t.acceptance_criteria)
          ? t.acceptance_criteria.map((c) => (typeof c === "string" ? { text: c, checked: false } : { text: c.text || "", checked: !!c.checked }))
          : [],
        tests: Array.isArray(t.tests) ? t.tests.map(String) : [],
        complexity: ["S", "M", "L"].includes(t.complexity) ? t.complexity : "M",
        status: ["ready", "in_progress", "review", "completed"].includes(t.status) ? t.status : "ready",
        feature_id: validFeatIds.has(t.feature_id) ? t.feature_id : null,
        endpoint_ids: Array.isArray(t.endpoint_ids) ? t.endpoint_ids : [],
        entity_ids: Array.isArray(t.entity_ids) ? t.entity_ids.map((x) => entLookup.get(x)).filter(Boolean) : [],
        needs_review: false,
        review_reason: null,
      })),
    };
  }

  Object.assign(out, normalizePhase2Updates(updates, existingArtifacts));
  if (updates.docs) {
    out.docs = typeof updates.docs === "string" ? { notes: updates.docs } : updates.docs;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Placement Summary Cards Generator (for Chat UI)
// ---------------------------------------------------------------------------
export function summarizePlacements(normalizedUpdates) {
  const placements = [];

  if (normalizedUpdates.brief) {
    const b = normalizedUpdates.brief;
    placements.push({
      kind: "brief",
      ...MODULE_META.brief,
      summary: `${b.platform || "Web"} · ${b.database || "PostgreSQL"} · ${(b.mvp_features || []).length} MVP pillars`,
      highlights: [b.name, b.business_model, b.payments !== "Not in MVP" ? b.payments : b.auth].filter(Boolean).slice(0, 4),
    });
  }

  if (normalizedUpdates.spec) {
    const s = normalizedUpdates.spec;
    placements.push({
      kind: "spec",
      ...MODULE_META.spec,
      summary: `${(s.goals || []).length} measurable goals · ${(s.roles || []).length} roles · ${(s.functional_requirements || []).length} requirements`,
      highlights: (s.roles || []).map((r) => r.name).slice(0, 4),
    });
  }

  if (normalizedUpdates.features) {
    const list = normalizedUpdates.features.features || [];
    const mvpCount = list.filter((f) => f.scope === "mvp").length;
    placements.push({
      kind: "features",
      ...MODULE_META.features,
      summary: `${mvpCount} MVP features · ${list.length - mvpCount} Phase 2 / scope boundaries`,
      highlights: list.filter((f) => f.scope === "mvp").map((f) => f.title).slice(0, 4),
    });
  }

  if (normalizedUpdates.architecture) {
    const a = normalizedUpdates.architecture;
    placements.push({
      kind: "architecture",
      ...MODULE_META.architecture,
      summary: `${(a.nodes || []).length} visual components · ${(a.edges || []).length} protocol connections`,
      highlights: (a.nodes || []).map((n) => `${n.name} (${n.technology})`).slice(0, 4),
    });
  }

  if (normalizedUpdates.schema) {
    const sc = normalizedUpdates.schema;
    placements.push({
      kind: "schema",
      ...MODULE_META.schema,
      summary: `${(sc.entities || []).length} ERD tables · ${(sc.relationships || []).length} foreign-key relations + SQL/Prisma`,
      highlights: (sc.entities || []).map((e) => e.name).slice(0, 6),
    });
  }

  if (normalizedUpdates.api) {
    const eps = normalizedUpdates.api.endpoints || [];
    placements.push({
      kind: "api",
      ...MODULE_META.api,
      summary: `${eps.length} REST endpoints with schemas, validation & error contracts`,
      highlights: eps.map((e) => `${e.method} ${e.path}`).slice(0, 5),
    });
  }

  if (normalizedUpdates.roadmap) {
    const tasks = normalizedUpdates.roadmap.tasks || [];
    placements.push({
      kind: "roadmap",
      ...MODULE_META.roadmap,
      summary: `${tasks.length} milestone-ordered engineering tasks`,
      highlights: tasks.map((t) => `M${t.milestone}: ${t.title}`).slice(0, 3),
    });
  }

  placements.push(...summarizePhase2Placements(normalizedUpdates, MODULE_META));
  if (placements.length > 0 || normalizedUpdates.docs) {
    placements.push({
      kind: "docs",
      ...MODULE_META.docs,
      summary: "Separated into individual per-module .md specs (no giant single-file dump)",
      highlights: ["01-brief.md", "04-architecture.md", "05-database.md", "06-api.md", "07-roadmap.md"],
    });
  }

  return placements;
}

// ---------------------------------------------------------------------------
// Optional Live LLM Call (Gemini or OpenAI-compatible REST API)
// ---------------------------------------------------------------------------
async function tryLiveLLM({ message, project, existingArtifacts, targets, mode, llmConfig }) {
  const geminiKey = llmConfig?.provider === "gemini" ? llmConfig.apiKey : (!llmConfig?.apiKey ? process.env.GEMINI_API_KEY : null);
  const openaiKey = llmConfig?.provider === "openai" ? llmConfig.apiKey : (!llmConfig?.apiKey ? process.env.OPENAI_API_KEY : null);

  if (!geminiKey && !openaiKey) return null;

  const targetList = [...targets];
  const existingSummary = {
    project_name: project?.name,
    existing_tables: (existingArtifacts.schema?.content?.entities || []).map((e) => e.name),
    existing_endpoints: (existingArtifacts.api?.content?.endpoints || []).map((e) => `${e.method} ${e.path}`),
  };

  const systemPrompt = `You are the Blueprint OS AI Software Architect.
Instead of dumping one giant markdown document, decompose the user's product idea or change request into SEPARATE structured JSON modules so each module renders in its own visual panel.
Mode: ${mode}. Requested target panels: ${targetList.join(", ")}.
Current project state: ${JSON.stringify(existingSummary)}.

Return ONLY valid JSON matching this structure (include ONLY keys in [${targetList.join(", ")}] plus "reply" and optional "project_name"):
{
  "project_name": "Short clean product name",
  "reply": "2-3 concise sentences explaining how you separated their idea across the visual panels (do NOT dump big markdown tables here).",
  "brief": { "name": "", "description": "", "target_users": "", "problems": "", "business_model": "", "platform": "Web (responsive)", "languages": "TypeScript", "hosting": "Vercel", "database": "PostgreSQL", "auth": "Email magic link", "payments": "Stripe", "budget": "Under $100/mo", "scale": "Up to 10,000 users", "deadline": "6 weeks", "available_time": "20 hrs/week", "mvp_features": ["..."], "assumptions": [{"field":"scale","assumption":"..."}] },
  "spec": { "problem_statement": "", "target_audience": "", "value_proposition": "", "goals": [{"goal":"","metric":""}], "roles": [{"name":"","permissions":["..."]}], "functional_requirements": ["..."], "nonfunctional_requirements": ["..."], "mvp_scope": ["..."], "phase2_scope": ["..."], "out_of_scope": ["..."], "risks": ["..."], "open_questions": ["..."] },
  "features": { "features": [{ "title": "", "description": "", "priority": "P0", "scope": "mvp", "completion_criteria": ["..."], "stories": [{"as_a":"","i_want":"","so_that":"","acceptance_criteria":["..."]}] }] },
  "architecture": { "summary": "", "nodes": [{ "id": "n1", "type": "web_frontend|mobile_frontend|backend|database|cache|auth|storage|email|payments|worker|external_api|hosting|monitoring", "name": "", "technology": "", "responsibility": "", "rationale": "" }], "edges": [{ "source": "n1", "target": "n2", "protocol": "HTTPS REST|SQL / database access|Events|Background job|Webhook|SDK|WebSocket|Deploy", "label": "" }] },
  "schema": { "entities": [{ "name": "snake_case_plural", "purpose": "", "fields": [{ "name": "id", "type": "uuid", "primary_key": true }, { "name": "col", "type": "varchar(140)|text|integer|numeric(10,2)|boolean|timestamptz|jsonb", "nullable": false, "unique": false, "indexed": false }] }], "relationships": [{ "source_entity": "orders", "source_field": "user_id", "target_entity": "users", "kind": "one_to_many", "on_delete": "CASCADE" }] },
  "api": { "endpoints": [{ "method": "GET|POST|PUT|PATCH|DELETE", "path": "/api/...", "purpose": "", "auth_required": true, "role": "", "request_schema": "{...}", "response_schema": "{...}", "validation": ["..."], "errors": ["401 Unauthorized"], "rate_limit": "60/min", "entity_ids": ["table_name"], "test_cases": ["..."] }] },
  "roadmap": { "tasks": [{ "milestone": 1, "title": "", "description": "", "deliverable": "", "files": ["..."], "acceptance_criteria": ["..."], "tests": ["..."], "complexity": "S|M|L", "status": "ready", "entity_ids": ["table_name"] }] },
  "docs": { "notes": "Concise domain-specific architectural guidance and edge-case notes in clean Markdown." }
}`;

  try {
    let rawJsonText = "";
    if (geminiKey) {
      const model = llmConfig?.model || "gemini-2.5-flash";
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: message }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.35 },
          }),
        }
      );
      if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}`);
      const data = await resp.json();
      rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (openaiKey) {
      const baseUrl = (llmConfig?.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      const model = llmConfig?.model || "gpt-4o-mini";
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature: 0.35,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        }),
      });
      if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
      const data = await resp.json();
      rawJsonText = data?.choices?.[0]?.message?.content || "";
    }

    const cleaned = rawJsonText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return { parsed, engine: geminiKey ? "gemini" : "openai" };
  } catch (err) {
    console.warn("Live LLM unavailable or failed, falling back to built-in Semantic Architect:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Built-in Semantic Domain Architect (Zero-Config, Offline-Ready)
// ---------------------------------------------------------------------------
function runSemanticArchitect({ message, project, existingArtifacts, targets, mode }) {
  const archetype =
    DOMAIN_ARCHETYPES.find((a) => a.keywords.test(message)) ||
    DOMAIN_ARCHETYPES.find((a) => a.keywords.test(`${project?.name || ""} ${project?.description || ""}`)) ||
    DOMAIN_ARCHETYPES[DOMAIN_ARCHETYPES.length - 1];

  const tech = extractTechStack(message);
  const projectName = extractProjectName(message, project?.name, archetype);
  const { known, custom } = extractRequestedEntities(message, mode === "full" ? archetype : null);

  const updates = {};

  // Build or merge schema first so API, Features & Roadmap cross-link exact entity IDs
  const mergeSchema = mode === "targeted";
  const builtSchema = buildSchemaFromSpecs(
    mode === "full" ? known : known.filter((k) => k !== "users" || !existingArtifacts.schema?.content?.entities?.some((e) => e.name === "users")),
    custom,
    message,
    existingArtifacts.schema?.content,
    mergeSchema
  );

  // Handle explicit table removal e.g. "remove audit_logs table"
  const removeMatch = message.match(/\b(?:remove|delete|drop)\s+(?:table\s+)?[`"']?([a-z][a-z0-9_]{2,30})[`"']?/i);
  if (removeMatch && mode === "targeted") {
    const toDrop = removeMatch[1].toLowerCase();
    const dropEnt = builtSchema.entities.find((e) => e.name === toDrop);
    if (dropEnt) {
      builtSchema.entities = builtSchema.entities.filter((e) => e.id !== dropEnt.id);
      builtSchema.relationships = builtSchema.relationships.filter((r) => r.source_entity !== dropEnt.id && r.target_entity !== dropEnt.id);
    }
  }

  if (targets.has("schema")) {
    updates.schema = builtSchema;
  }

  const activeSchema = updates.schema || existingArtifacts.schema?.content || builtSchema;
  const generatedFeatures = buildFeatures(projectName, activeSchema, archetype, tech);

  if (targets.has("features")) {
    if (mode === "full") {
      updates.features = { features: generatedFeatures.map(({ _entityId, ...rest }) => rest) };
    } else {
      const prevFeats = JSON.parse(JSON.stringify(existingArtifacts.features?.content?.features || []));
      const existingTitles = new Set(prevFeats.map((f) => (f.title || "").toLowerCase()));
      for (const nf of generatedFeatures) {
        const { _entityId, ...cleanFeat } = nf;
        if (!existingTitles.has(cleanFeat.title.toLowerCase()) && cleanFeat.scope === "mvp" && cleanFeat.title !== "Authentication & Role Access") {
          prevFeats.push(cleanFeat);
        }
      }
      updates.features = { features: prevFeats };
    }
  }

  const activeFeatures = updates.features?.features || existingArtifacts.features?.content?.features || generatedFeatures;

  if (targets.has("api")) {
    const freshEndpoints = buildEndpoints(activeSchema, generatedFeatures, archetype);
    if (mode === "full") {
      updates.api = { endpoints: freshEndpoints };
    } else {
      const prevEps = JSON.parse(JSON.stringify(existingArtifacts.api?.content?.endpoints || []));
      const seenKeys = new Set(prevEps.map((e) => `${e.method} ${e.path}`));
      for (const ep of freshEndpoints) {
        if (!seenKeys.has(`${ep.method} ${ep.path}`)) {
          prevEps.push(ep);
        }
      }
      updates.api = { endpoints: prevEps };
    }
  }

  const activeEndpoints = updates.api?.endpoints || existingArtifacts.api?.content?.endpoints || [];

  if (targets.has("architecture")) {
    if (mode === "full") {
      updates.architecture = buildArchitecture(projectName, tech, archetype, message);
    } else {
      // Merge newly requested infra nodes into existing architecture
      const baseArch = existingArtifacts.architecture?.content?.nodes?.length
        ? JSON.parse(JSON.stringify(existingArtifacts.architecture.content))
        : buildArchitecture(projectName, tech, archetype, message);
      const freshArch = buildArchitecture(projectName, tech, archetype, message);
      const existingTypes = new Set(baseArch.nodes.map((n) => n.type));
      const backendNode = baseArch.nodes.find((n) => n.type === "backend") || baseArch.nodes[0];
      for (const fn of freshArch.nodes) {
        if (!existingTypes.has(fn.type)) {
          baseArch.nodes.push(fn);
          if (backendNode) {
            baseArch.edges.push({
              id: uid(),
              source: backendNode.id,
              target: fn.id,
              protocol: fn.type === "worker" ? "Background job" : fn.type === "cache" ? "Events" : "HTTPS REST",
              label: `Connect ${fn.name}`,
            });
          }
        }
      }
      updates.architecture = baseArch;
    }
  }

  if (targets.has("brief")) {
    const mvpList = activeFeatures.filter((f) => f.scope === "mvp").map((f) => f.title).slice(0, 5);
    updates.brief = {
      name: projectName,
      description: message.trim().length > 20 ? message.trim() : `${projectName}: ${archetype.valueProp}`,
      target_users: archetype.audience,
      problems: archetype.problem,
      business_model: archetype.businessModel,
      platform: tech.platform,
      languages: tech.languages,
      hosting: tech.hosting,
      database: tech.database,
      auth: tech.auth,
      payments: tech.payments,
      budget: "Under $75/month for MVP launch",
      scale: "Up to 10,000 active users in year one",
      deadline: "6 weeks to MVP launch",
      available_time: "20 hours/week",
      mvp_features: mvpList,
      assumptions: [
        { field: "hosting", assumption: `Deploying as a modular monolith on ${tech.hosting} keeps ops overhead near zero.` },
        { field: "scale", assumption: "Single primary PostgreSQL instance with indexed FKs handles initial 10k-user load without sharding." },
      ],
    };
  }

  if (targets.has("spec")) {
    const mvpScope = activeFeatures.filter((f) => f.scope === "mvp").map((f) => f.title);
    const phase2Scope = activeFeatures.filter((f) => f.scope === "later").map((f) => f.title);
    const outScope = activeFeatures.filter((f) => f.scope === "out").map((f) => f.title);
    updates.spec = {
      problem_statement: archetype.problem,
      target_audience: archetype.audience,
      value_proposition: archetype.valueProp,
      goals: [
        { goal: "Fast time-to-first-value after sign-in", metric: ">= 65% of new users complete core workflow in < 5 minutes" },
        { goal: "High weekly workflow retention", metric: ">= 45% Week-4 active retention across active accounts" },
      ],
      roles: archetype.roles,
      functional_requirements: [
        `Users authenticate via ${tech.auth} with role-based permissions`,
        ...activeSchema.entities
          .filter((e) => e.name !== "users")
          .slice(0, 4)
          .map((e) => `Manage ${e.name.replace(/_/g, " ")}: ${e.purpose}`),
        ...(tech.payments !== "Not in MVP" ? [`Process payments via ${tech.payments} with signed webhook verification`] : []),
      ],
      nonfunctional_requirements: [
        "P95 API read latency under 180ms with indexed foreign keys",
        "Strict tenant/owner authorization checks on every mutable endpoint (zero IDOR)",
        "WCAG AA contrast across light and dark themes",
        "Automated daily PostgreSQL backups with point-in-time recovery",
      ],
      mvp_scope: mvpScope,
      phase2_scope: phase2Scope,
      out_of_scope: outScope,
      risks: [
        "Scope creep delaying MVP ship date — enforce strict P0/P1 boundary",
        "Third-party webhook retries causing duplicate state — enforce idempotency keys",
      ],
      open_questions: [
        `Should guest/read-only previews be enabled before ${tech.auth} sign-in?`,
        "What retention window is required for soft-deleted records and audit logs?",
      ],
    };
  }

  if (targets.has("roadmap")) {
    const freshTasks = buildRoadmap(projectName, tech, activeSchema, activeEndpoints, activeFeatures);
    if (mode === "full") {
      updates.roadmap = { tasks: freshTasks };
    } else {
      const prevTasks = JSON.parse(JSON.stringify(existingArtifacts.roadmap?.content?.tasks || []));
      const newTables = activeSchema.entities.slice(-2).map((e) => e.name).join(", ");
      prevTasks.push({
        id: uid(),
        milestone: 4,
        title: `Implement schema & endpoints for: ${message.slice(0, 58)}${message.length > 58 ? "…" : ""}`,
        description: `Wire migrations, validation, and UI integration (${newTables || "updated modules"}).`,
        deliverable: "Migrated tables, tested endpoints, and updated UI flow",
        depends_on: [],
        files: ["prisma/schema.prisma", "src/routes/api.ts"],
        acceptance_criteria: [
          { text: "Schema changes migrated cleanly", checked: false },
          { text: "Endpoints covered by integration tests", checked: false },
        ],
        tests: ["Integration test for new flow"],
        complexity: "M",
        status: "ready",
        feature_id: null,
        endpoint_ids: [],
        entity_ids: activeSchema.entities.slice(-2).map((e) => e.id),
        needs_review: false,
        review_reason: null,
      });
      updates.roadmap = { tasks: prevTasks };
    }
  }

  const activeBrief = updates.brief || existingArtifacts.brief?.content || { name: projectName, auth: tech.auth, payments: tech.payments, database: tech.database };
  const activeSpec = updates.spec || existingArtifacts.spec?.content || { roles: archetype.roles };
  if (targets.has("flows")) {
    updates.flows = buildFlows({ projectName, features: activeFeatures, schema: activeSchema, endpoints: activeEndpoints, spec: activeSpec, brief: activeBrief });
  }
  if (targets.has("ui")) {
    updates.ui = buildUiBlueprint({ projectName, features: activeFeatures, schema: activeSchema, spec: activeSpec, brief: activeBrief });
  }
  if (targets.has("security")) {
    updates.security = buildSecurityPlan({ projectName, schema: activeSchema, endpoints: activeEndpoints, brief: activeBrief });
  }
  if (targets.has("testing")) {
    updates.testing = buildTestingPlan({ projectName, features: activeFeatures, endpoints: activeEndpoints, schema: activeSchema });
  }
  if (targets.has("docs")) {
    updates.docs = {
      notes: `### Architectural Separation Notes (${projectName})
- **Domain Model**: ${activeSchema.entities.length} normalized PostgreSQL tables (\`${activeSchema.entities.map((e) => e.name).join("`, `")}\`) with explicit foreign-key cascade rules.
- **API Boundary**: ${activeEndpoints.length} REST endpoints enforcing session-derived actor IDs and structured \`422\` validation errors.
- **Selected Stack**: \`${tech.frontend}\` · \`${tech.backend}\` · \`${tech.database}\` · \`${tech.auth}\`${tech.payments !== "Not in MVP" ? ` · \`${tech.payments}\`` : ""}.
- **Latest Prompt Routed**: _"${message.trim().slice(0, 180)}"_`,
    };
  }

  const reply =
    mode === "full"
      ? `I decomposed **${projectName}** and placed each part directly into its own visual & structured panel — including **${activeSchema.entities.length} ERD tables** in Database, **${activeEndpoints.length} REST contracts** in API, **${(updates.architecture?.nodes || []).length} components** on the Architecture canvas, **${activeFeatures.length} scoped features**, **PRD requirements**, **${(updates.roadmap?.tasks || []).length} roadmap tasks**, and **separate per-module \`.md\` docs**. Click any card below to inspect or edit each module visually.`
      : `I routed your update into the matching panels (${[...targets].map((k) => MODULE_META[k]?.label || k).join(", ")}) and cross-linked the tables, endpoints, and separate \`.md\` module files without dumping a monolithic markdown wall.`;

  return {
    project_name: mode === "full" ? projectName : undefined,
    reply,
    updates,
    engine: "semantic-architect",
  };
}

// ---------------------------------------------------------------------------
// Main Entry Point Called by POST /api/projects/:pid/chat (and POST /api/projects)
// ---------------------------------------------------------------------------
export async function runArchitectChat({
  message,
  project,
  existingArtifacts = {},
  explicitTargets = null,
  isFreshProject = false,
  llmConfig = null,
}) {
  const { mode, targets } = detectTargetModules(message, explicitTargets, isFreshProject);

  // 1. Try live LLM if configured
  const llmResult = await tryLiveLLM({
    message,
    project,
    existingArtifacts,
    targets,
    mode,
    llmConfig,
  });

  if (llmResult?.parsed) {
    const { reply, project_name, ...rawModules } = llmResult.parsed;
    const filtered = {};
    for (const k of targets) {
      if (rawModules[k]) filtered[k] = rawModules[k];
    }
    const normalized = normalizeModuleUpdates(filtered, existingArtifacts);
    const placements = summarizePlacements(normalized);
    return {
      mode,
      engine: llmResult.engine,
      project_name: project_name || undefined,
      reply:
        reply ||
        `Separated your idea across ${placements.length} dedicated panels. Select any module card below to open its visual workspace.`,
      updates: normalized,
      placements,
    };
  }

  // 2. Built-in zero-config Semantic Architect
  const sem = runSemanticArchitect({
    message,
    project,
    existingArtifacts,
    targets,
    mode,
  });

  const normalized = normalizeModuleUpdates(sem.updates, existingArtifacts);
  const placements = summarizePlacements(normalized);

  return {
    mode,
    engine: sem.engine,
    project_name: sem.project_name,
    reply: sem.reply,
    updates: normalized,
    placements,
  };
}
