# Formora — Architectural Blueprint OS

Formora turns an unstructured software idea into **12 typed, versioned, referentially linked engineering blueprints** (`Brief`, `Requirements`, `Features`, `User Flows`, `UI/UX Blueprint`, `Architecture`, `Database ERD`, `API Explorer`, `Security Plan`, `Roadmap`, `Testing Center`, and `Deployment Center`) alongside runnable PostgreSQL DDL, Prisma schemas, separated GitHub-Flavored Markdown specs (`01-brief.md` through `14-deployment-guide.md`), multi-stage Dockerfiles, and GitHub Actions CI/CD workflows.

---

## Core Architecture & Phases

### Phase 1 — Core Blueprint Engine, Production Hardening & SaaS Billing
- **Kinetic Swiss Landing Page (`/`)**: Autonomous prompt-to-module router workbench, live referential integrity mutation simulator, separated `.md` spec explorer, and monthly/annual SaaS pricing.
- **Core Blueprint Panels**:
  - **Project Brief (`/p/:pid/brief`)**: Constraints, target audience, stack choices, and assumptions.
  - **Product Requirements (`/p/:pid/requirements`)**: Roles, goals, functional & non-functional requirements, and risks.
  - **Features & Stories (`/p/:pid/features`)**: MVP vs. post-launch prioritization, complexity scoring, and acceptance criteria.
  - **Tech Stack Evaluator (`/p/:pid/stack`)**: Stack selection matrix derived from brief & topology.
  - **Architecture Canvas (`/p/:pid/architecture`)**: Interactive `@xyflow/react` service topology graph with live architecture linting.
  - **Database Designer (`/p/:pid/database`)**: Visual ERD canvas, foreign-key references, schema validator, and PostgreSQL `.sql` + `schema.prisma` compilers.
  - **API Explorer (`/p/:pid/api`)**: Typed HTTP route contracts linked directly to features and schema entities.
  - **Roadmap (`/p/:pid/roadmap`)**: Dependency-ordered vertical slice delivery tasks with upstream drift detection.
  - **Decision Log (`/p/:pid/decisions`)**: Chronological Architecture Decision Records (ADRs).
- **Relational SQLite WAL Persistence (`server/database.js`)**:
  - Zero-external-dependency relational database built on Node's native `node:sqlite` (`DatabaseSync`) with `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, and atomic transactions across 11 normalized tables (`users`, `sessions`, `projects`, `artifacts`, `artifact_versions`, `decisions`, `ai_jobs`, `chat_messages`, `module_notes`, `subscriptions`, `processed_webhooks`).
- **Security & Auth Hardening (`server/server.js`)**:
  - `HttpOnly` + `SameSite=Lax` JWT access cookies paired with single-use SHA-256 refresh token rotation (`jti` consumption & session revocation on logout).
  - Centralized multi-tenant ownership middleware (`app.use("/api/projects/:pid", authRequired, requireProjectAccess)`) preventing cross-tenant IDOR across all project endpoints.
  - Sliding-window rate limiters on auth, AI generation, and billing checkout routes.
- **Lemon Squeezy Merchant-of-Record Billing (`server/billing.js`, `/billing`)**:
  - Tier enforcement (`Starter` free tier, `Pro` $19/mo, `Team` $49/mo), hosted checkout session creation, customer portal links, and timing-safe HMAC-SHA256 idempotent webhook ingestion (`POST /api/billing/webhook`).

### Phase 2 — Behavioral, UI, Security & QA Engineering Modules
- **User Flows (`/p/:pid/flows`)**: Role-based step-by-step journeys (`trigger` → `screen` → `system` → `decision` → `outcome`) with explicit failure/edge-case recovery branches and Mermaid `flowchart TD` export (`10-user-flows.md`).
- **UI/UX Blueprint (`/p/:pid/ui`)**: Screen inventory, Desktop/Mobile live wireframe previewer, interactive **UI State Simulator** (`Default`, `Loading`, `Empty`, `Error`, `Success`), component map, and CSS `:root` design tokens (`11-ui-blueprint.md`).
- **Security Plan (`/p/:pid/security`)**: Explicit **Implemented vs. Planned** security posture matrix across `Auth & Session`, `Access Control (RBAC/IDOR)`, `Data Protection`, `Validation & Rate Limiting`, and `Webhooks & Secrets`, paired with a STRIDE-lite threat mitigation register (`12-security-plan.md`).
- **Testing Center (`/p/:pid/testing`)**: Traceable `Unit`, `API Integration`, and `End-to-End` test suites linked to features, endpoints, and entities, with live feature/API coverage meters and runnable Vitest + Playwright `.spec.ts` skeleton export (`13-testing-plan.md`).

### Phase 3 — Deployment Center & Release Automation
- **Deployment Center (`/p/:pid/deployment`)**:
  - **Deployment Readiness Review**: Weighted Go-Live Readiness score (`0%–100%`) auditing upstream 11-module approvals, schema/architecture drift flags, critical security controls, test coverage, and interactive pre-flight launch gates.
  - **Environment Variable Catalog**: Stack-derived `UPPER_SNAKE_CASE` environment catalog (`Scope`, `Required`, `Secret`, `Example`, `Purpose`) tailored to the project's database, auth, payment provider (Lemon Squeezy / ABA PayWay KHQR / Stripe), Redis/worker nodes, and hosting target, with 1-click `.env.example` export.
  - **Step-by-Step Deployment Runbook**: Staging & Production environment target cards, ordered CLI execution steps with verification commands, and an emergency rollback protocol (`14-deployment-guide.md`).
  - **Infrastructure Bundle Exporters**: Ready-to-commit multi-stage Node 22 Alpine `Dockerfile` (with `/api/health` `HEALTHCHECK`) and GitHub Actions CI/CD workflow (`.github/workflows/deploy.yml`).

---

## Separated Markdown Specification Tree (`/p/:pid/docs`)

Every project continuously compiles **14 separated Markdown specifications** so developers and coding agents (`Cursor`, `Claude Code`, `Antigravity`) can load focused domain context instead of a single monolithic document:

| File | Source Module |
| :--- | :--- |
| `01-brief.md` | Project Brief |
| `02-requirements.md` | Product Requirements (PRD) |
| `03-features.md` | Features & User Stories |
| `04-architecture.md` | System Architecture & Topology |
| `05-database.md` | Database Schema & ERD |
| `06-api.md` | REST API Contracts |
| `07-roadmap.md` | Vertical-Slice Delivery Roadmap |
| `08-decisions.md` | Architecture Decision Log (ADRs) |
| `09-architect-notes.md` | Scoped Agent & Engineering Notes |
| `10-user-flows.md` | User Flows & Edge-Case Branches |
| `11-ui-blueprint.md` | UI/UX Wireframes, States & Tokens |
| `12-security-plan.md` | Security Posture & Threat Register |
| `13-testing-plan.md` | Unit, API & E2E Verification Suite |
| `14-deployment-guide.md` | Deployment Readiness, Env Vars & Runbook |

---

## Quick Start

### Prerequisites
- **Node.js `>= 22.5`** (uses native `node:sqlite` `DatabaseSync` — tested on Node `v22.5+` / `v26.x`).

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and set your secrets as needed:
```bash
cp .env.example .env
```
Works out of the box in development without external API keys (built-in Semantic Architect + demo Lemon Squeezy simulation mode when `LEMONSQUEEZY_API_KEY` is omitted in non-production).

### 3. Run in Development
Starts both the Express API (`http://localhost:3001`) and Vite React SPA (`http://localhost:3000`):
```bash
npm run dev
```
- **Demo Account**: `demo@blueprintos.dev` / `Blueprint123!` (pre-seeded with the full 12-module **Shelfmate** blueprint).

### 4. Production Build & Single-Port Server
Builds the optimized frontend bundle into `dist/` and serves both `/api/*` and the SPA from Express:
```bash
npm run build
NODE_ENV=production JWT_SECRET="$(openssl rand -hex 32)" npm start
```
Health probe: `GET /api/health` → `{ "ok": true, "database": { "engine": "sqlite", "journal_mode": "wal" } }`.

---

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Radix UI primitives, `@xyflow/react`, Lucide Icons, `IBM Plex Sans` + `JetBrains Mono`.
- **Backend**: Node.js, Express 5, native `node:sqlite` (SQLite WAL), `jsonwebtoken`, `bcryptjs`, HMAC-SHA256 Lemon Squeezy webhooks.
- **AI Engine**: Built-in deterministic Semantic Architect (`server/aiArchitect.js`, `server/phase2Architect.js`, `server/phase3Architect.js`) with optional BYOK Google Gemini (`gemini-2.5-flash`) or OpenAI (`gpt-4o-mini`) synthesis.
