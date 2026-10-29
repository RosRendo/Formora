# Architecture: Formora (Rebuild of Blueprint OS)

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | React 18 + Vite + Tailwind CSS | Instant HMR, exact component fidelity, zero build overhead, rich micro-interactions |
| styling | Tailwind CSS + CSS Variables | Design tokens matching Blueprint OS (slate/indigo dark & light themes) |
| backend | Node.js + Express API server | Native Node v26 runtime, unified TypeScript/JavaScript, fast JSON endpoints |
| database | SQLite (development) / PostgreSQL (production) via Knex/Drizzle | Instant zero-setup local dev, relational foreign keys, JSON support |
| auth | JWT in HttpOnly secure cookies + bcrypt | Full parity with session auth, refresh token rotation, and password hashing |
| state | React Context (`AuthContext`, `ProjectContext`) | Exact structure from original app, zero external state library bloat |
| code generator | Pure JS AST/String generator | Deterministic PostgreSQL DDL and Prisma Schema generation from ERD models |
| hosting | Vercel (web) + Render/Fly (API) | Managed, cheap, high performance |

## Schema

Tables: 6. Access rules: Data-layer authorization checks (`where user_id = req.user.id`).

See `replica/schema.sql`.

```sql
-- Core entities:
-- users (id, email, password_hash, name, auth_provider, created_at, updated_at)
-- projects (id, user_id, name, description, status, is_sample, archived_at, created_at, updated_at)
-- artifacts (id, project_id, kind, current_version, status, needs_review, review_reason, approved_version, approved_at, content, approved_content)
-- artifact_versions (id, artifact_id, version_number, content, summary, created_at)
-- decisions (id, project_id, title, category, decision, reasoning, artifact_kind, created_at)
-- tasks (id, project_id, title, description, phase, status, priority, dependencies, estimated_hours, assigned_to, artifact_kind, sort_order)
-- ai_jobs (id, project_id, workflow_id, target_kind, instructions, status, result_content, created_at, updated_at)
```

## API

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `POST /api/auth/register` | Register new user | public | `{ email, password, name }` | `{ id, email, name }` + cookies | F01 |
| `POST /api/auth/login` | Sign in user | public | `{ email, password }` | `{ id, email, name }` + cookies | F01 |
| `GET /api/auth/me` | Current session user | authenticated | none | `{ id, email, name }` | F01 |
| `POST /api/auth/logout` | End session | authenticated | none | `{ ok: true }` (clears cookies) | F01 |
| `POST /api/auth/refresh` | Refresh access token | token holder | refresh_token cookie | `{ ok: true }` + new cookie | F01 |
| `GET /api/projects` | List projects | authenticated | `?include_archived=bool` | array of project summaries | F02 |
| `POST /api/projects` | Create blueprint project | authenticated | `{ name, description, answers }` | created project object | F02 |
| `GET /api/projects/:pid` | Get project blueprint | owner | none | project with stats & flagged | F02 |
| `PATCH /api/projects/:pid` | Update project metadata | owner | `{ name?, description?, status? }` | updated project | F02 |
| `DELETE /api/projects/:pid` | Delete project | owner | none | `{ ok: true }` | F02 |
| `GET /api/projects/:pid/artifacts/:kind` | Get artifact content | owner | none | `{ artifact, content, approved_content }` | F03 |
| `PUT /api/projects/:pid/artifacts/:kind` | Save artifact draft/version | owner | `{ content, summary, version }` | `{ artifact, content, impact }` | F03 |
| `POST /api/projects/:pid/artifacts/:kind/approve` | Approve artifact | owner | `{ note }` | `{ ok: true }` | F03 |
| `POST /api/projects/:pid/artifacts/:kind/resolve-review` | Clear review flag | owner | none | `{ ok: true }` | F03 |
| `GET /api/projects/:pid/artifacts/:kind/versions` | List version history | owner | none | array of versions with summary | F03 |
| `POST /api/projects/:pid/artifacts/:kind/versions/:v/restore` | Restore old version | owner | none | `{ content, artifact }` | F03 |
| `POST /api/projects/:pid/items/resolve-review` | Clear review on single item | owner | `{ type: "endpoint"\|"feature", id }` | `{ ok: true }` | F03 |
| `GET /api/projects/:pid/decisions` | List decision records (ADRs) | owner | none | array of decisions | F07 |
| `POST /api/projects/:pid/decisions` | Record new ADR | owner | `{ title, category, decision, reasoning }` | created decision | F07 |
| `PATCH /api/projects/:pid/tasks/:id` | Update task status | owner | `{ status, ... }` | updated task | F06 |
| `POST /api/projects/:pid/schema/preview` | Generate live SQL & Prisma DDL | owner | `{ content: schema }` | `{ sql, prisma, issues }` | F05 |
| `GET /api/projects/:pid/schema/code` | Get latest schema DDL | owner | none | `{ sql, prisma, issues }` | F05 |
| `GET /api/projects/:pid/export/markdown` | Full blueprint markdown export | owner | none | markdown text stream | F08 |
| `GET /api/ai/workflows` | List AI workflow templates | authenticated | none | array of workflows | F04 |
| `GET /api/projects/:pid/ai/jobs` | List project AI jobs | owner | none | array of AI jobs | F04 |
| `GET /api/projects/:pid/ai/jobs/:id` | Get AI job detail | owner | none | job with result & status | F04 |
| `POST /api/projects/:pid/ai/:workflow` | Run AI workflow | owner | `{ instructions }` | `{ id, status }` | F04 |
| `POST /api/projects/:pid/ai/jobs/:id/accept` | Accept AI proposal | owner | `{ content }` | `{ ok: true, artifact }` | F04 |
| `POST /api/projects/:pid/ai/jobs/:id/discard` | Discard AI proposal | owner | none | `{ ok: true }` | F04 |

## The parts that bite

- **Cross-Artifact Impact Flagging**: Modifying database entities or requirements must flag dependent APIs, tasks, and features with `needs_review: true`.
- **Live SQL / Prisma DDL Generation**: Dynamic generation of valid PostgreSQL constraints (foreign keys, check constraints, default uuidv4) and Prisma schema relations with index generation.
- **Topological Linting in Architecture Canvas**: Evaluating connection integrity (e.g. backend without database, missing web/mobile client, premature caching) in real time.
- **Clean Diffing**: Computing fast line-by-line diffs with reference name resolution (substituting UUIDs with human-readable entity/feature names).

## Build order

1. **Vertical slice**: Auth flow (login with `demo@blueprintos.dev / Blueprint123!`), Dashboard, Project Overview, and Brief editor.
2. **Must-haves**: PRD Requirements, Features & Stories, Architecture Canvas with interactive nodes and linter, Database ERD Designer with live SQL/Prisma preview, API Catalog, and Roadmap task board.
3. **Should-haves**: ADR Decision Log, Version History with rollbacks, Markdown export, AI Assistant panel with mock/live generation diff preview.
4. **Polish**: Dark/light theme, animated SVG architecture diagram, responsive sidebar drawer.
