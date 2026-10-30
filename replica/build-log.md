# Build Log: Formora (Architectural Blueprint OS)

Updated: 2026-10-30
Repository: `d:\FOR RENDO (ONLY )\Personal Project\Formora`

## Screens & Modules Implementation Log

| ID | Screen / Route | Phase | Status | Notes |
| :--- | :--- | :---: | :--- | :--- |
| S00 | SaaS Landing Page (`/`) | Phase 1 | Done | Kinetic Swiss drafting-table landing page: autonomous prompt-to-module router, live mutation cascade simulator, separated `.md` viewer, monthly/annual pricing |
| S01 | Login / Register (`/login`) | Phase 1 | Done | Email/password login & registration, Google OAuth session exchange, demo workspace instant sign-in |
| S02 | Dashboard (`/dashboard`) | Phase 1–3 | Done | Greeting, project counts, task completion counter, needs-review alerts, 12-step blueprint pipeline tracker |
| S03 | Projects (`/projects`) | Phase 1–3 | Done | Project list with 12-artifact approval progress bar, task completion %, archived toggle |
| S04 | New Project Wizard (`/projects/new`) | Phase 1–3 | Done | Guided wizard or 1-prompt AI decomposition across all 12 blueprint artifacts |
| S05 | Billing & Plans (`/billing`) | Phase 1 | Done | Starter / Pro / Team plans, active usage meters, Lemon Squeezy checkout & customer portal integration |
| S06 | Project Overview (`/p/:pid`) | Phase 1–3 | Done | 12-stage blueprint approval pipeline, next recommended step CTA, downstream review queue, recent ADRs |
| S07 | Project Brief (`/p/:pid/brief`) | Phase 1 | Done | Structured constraints, stack choices, assumptions list, versioned diff & approval |
| S08 | Product Requirements (`/p/:pid/requirements`) | Phase 1 | Done | Problem statement, value prop, user roles, core goals, functional & non-functional reqs, risks |
| S09 | Features & Stories (`/p/:pid/features`) | Phase 1 | Done | Feature catalog with MVP/later priorities, complexity tags, user stories, acceptance criteria |
| S10 | User Flows (`/p/:pid/flows`) | Phase 2 | Done | Role-based step-by-step journeys, failure/edge-case recovery branches, Mermaid `flowchart TD` export (`10-user-flows.md`) |
| S11 | UI/UX Blueprint (`/p/:pid/ui`) | Phase 2 | Done | Desktop/Mobile wireframe renderer, interactive 5-state UI simulator, component inventory, CSS `:root` tokens (`11-ui-blueprint.md`) |
| S12 | Tech Stack (`/p/:pid/stack`) | Phase 1 | Done | Automated tech stack evaluator derived from brief and architecture |
| S13 | Architecture Canvas (`/p/:pid/architecture`) | Phase 1 | Done | Interactive `@xyflow/react` topology diagram, node toolbox, protocol selector, live architecture linter |
| S14 | Database Designer (`/p/:pid/database`) | Phase 1 | Done | Interactive ERD canvas, table/field editor, PK/FK constraints, live PostgreSQL DDL & Prisma schema compilers |
| S15 | API Explorer (`/p/:pid/api`) | Phase 1 | Done | REST endpoint catalog, HTTP method badges, request/response JSON contracts, feature & entity links |
| S16 | Module Docs (`/p/:pid/docs`) | Phase 1–3 | Done | 14 separated GFM `.md` specifications (`01-brief.md` .. `14-deployment-guide.md`) with preview, raw source, custom notes & bulk download |
| S17 | Security Plan (`/p/:pid/security`) | Phase 2 | Done | Implemented vs. Planned security control checklist across 5 categories + STRIDE-lite threat register (`12-security-plan.md`) |
| S18 | Roadmap (`/p/:pid/roadmap`) | Phase 1 | Done | Dependency-ordered vertical slice task board with phase filters, status transitions & upstream drift flags |
| S19 | Testing Center (`/p/:pid/testing`) | Phase 2 | Done | Traceable Unit, API Integration & E2E test suites, live feature/API coverage meters, `.spec.ts` exporter (`13-testing-plan.md`) |
| S20 | Deployment Center (`/p/:pid/deployment`) | Phase 3 | Done | Weighted Go-Live Readiness score, 11-module sign-off audit, `.env.example` catalog, CLI release runbook, rollback plan, `Dockerfile` & GitHub Actions `deploy.yml` exporters (`14-deployment-guide.md`) |
| S21 | Decision Log (`/p/:pid/decisions`) | Phase 1 | Done | Chronological Architecture Decision Records (ADRs) with automatic approval logging |
| S22 | Project Settings (`/p/:pid/settings`) | Phase 1 | Done | Project metadata, archiving/restoring, and danger-zone deletion |

## Production Infrastructure Summary

- **Persistence**: Relational SQLite WAL engine (`server/database.js` via `node:sqlite`) across 11 normalized tables with automatic legacy JSON migration and Phase 2/3 artifact backfilling.
- **Security**: Single-use SHA-256 refresh token rotation, centralized `requireProjectAccess` multi-tenant IDOR protection, sliding-window rate limiters, security headers, and production secret guards.
- **Billing**: Lemon Squeezy Merchant-of-Record checkout, portal management, tier quota gates, and timing-safe HMAC-SHA256 idempotent webhook ledger.
- **AI Architect**: Modular prompt router (`Ctrl+J`) and 11 panel-specific AI workflows supporting zero-key deterministic decomposition plus optional Gemini / OpenAI BYOK synthesis.
