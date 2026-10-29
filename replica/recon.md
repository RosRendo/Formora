# Recon map: Blueprint OS (Web)

Scope: Full-stack AI Product Specification & Architecture OS — project creation wizard, 7 core artifacts (Brief, Requirements/PRD, Features, Architecture Canvas, Database ERD Designer, API Catalog, Roadmap), Architecture Decision Records (ADRs), Version History & Diff View, AI Assistant Workflows, Code/Markdown Exporters, and Dark/Light Mode.
For: Software architects, engineering leads, founders, and developers turning ideas into approved, production-grade technical blueprints before writing code.
Date: 2026-10-28

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Live Application Preview | https://blueprint-os-5--8qv96qaz.preview.emergentagent.com | Complete live app running with React frontend + FastAPI backend |
| 2 | Live Demo Account | demo@blueprintos.dev | Seeded project "Shelfmate (sample)" with all 7 artifacts and ADRs |
| 3 | Source Map & React Bundles | /static/js/bundle.js & /static/js/bundle.js.map | 48 frontend source components, contexts, pages, and CSS tokens |
| 4 | REST API Surface | /api/* | Auth endpoints, Project CRUD, Artifact versioning, AI workflows, ERD export |

## Core loop

Turn an unformed product idea into an approved, versioned, and interconnected engineering blueprint — from problem statement to database DDL, API contracts, and dependency-aware tasks.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Login / Register | `/login` | User authentication via password or Google OAuth | AuthForm, BlueprintVisual (animated SVG architecture flow), ToggleMode | default, invalid credentials, registering, loading |
| S02 | Dashboard | `/dashboard` | User command center with greeting, KPI metrics, recent projects | StatsBar, PipelineFlow (01-08), ProjectCard, EmptyState | empty, loaded, review alerts |
| S03 | Projects Directory | `/projects` | Search and filter all user projects, include archived | SearchInput, StatusFilter, ProjectList, ActionMenu | empty, filtered, loading |
| S04 | New Project Wizard | `/projects/new` | Multi-step interactive guided project brief creation | StepProgress, QuestionCard, FormInputs, SubmitBtn | step 1-4, validating, creating |
| S05 | Project Overview | `/p/:pid` | Blueprint summary, health stats, artifact matrix, recent ADRs | HealthScore, ArtifactCards, ADRTimeline, AIActionBar | draft, approved, needs review |
| S06 | Project Brief | `/p/:pid/brief` | Define problems, target users, scale, constraints, assumptions | FormGrid, AssumptionsList, VersionBanner, ApproveBtn | draft, modified, approved, versioned |
| S07 | Requirements (PRD) | `/p/:pid/requirements` | PRD with functional/non-functional specs, user roles, risks | SectionTabs, ListEditor, RiskMatrix, OpenQuestions | draft, approved, needs review |
| S08 | Features & Stories | `/p/:pid/features` | Feature catalog with user stories, complexity, dependencies | FeatureTable, PriorityBadge, FeatureModal, StoryCard | empty, filtered, editing, reviewing |
| S09 | Tech Stack | `/p/:pid/stack` | Architecture & stack evaluator with automated recommendations | CategoryCards, StackSelector, RationaleBox | default, evaluating |
| S10 | Architecture Canvas | `/p/:pid/architecture` | Interactive system topology diagram with rule linter | ArchitectureCanvas, NodeToolbox, EdgeSelector, LintErrors | valid, lint warnings, editing |
| S11 | Database Designer | `/p/:pid/database` | Interactive ERD diagram, table editor, relationships & live DDL | ERDCanvas, TableSheet, FieldEditor, DDLPreview (SQL/Prisma) | viewing, editing, generating DDL |
| S12 | API Catalog | `/p/:pid/api` | REST API specifications, parameters, schemas, feature links | EndpointTable, MethodBadge, EndpointDetailSheet | empty, filtered, needs review |
| S13 | Roadmap & Tasks | `/p/:pid/roadmap` | Implementation roadmap with phases, dependencies, status | TaskBoard, PhaseGroup, TaskDetail, StatusToggle | blocked, ready, in_progress, done |
| S14 | Decision Log (ADRs) | `/p/:pid/decisions` | Architecture Decision Records capturing rationale & trade-offs | DecisionList, ADRModal, CategoryBadge, MarkdownPreview | empty, listed, creating |
| S15 | Project Settings | `/p/:pid/settings` | Project metadata, archiving, export, and danger zone | GeneralSettings, ArchiveButton, DeleteDialog | active, archived, deleting |
| S16 | Later Phase Placeholders | `/p/:pid/flows`, `/ui`, etc. | Roadmap phase preview screens | LaterPhaseHero, FeatureCallout | placeholder |

## Flows

```
F01 Authentication & Session
    S01 Login / Register -> S02 Dashboard
    happy path clicks: 2
    edge: expired token, invalid credentials, OAuth redirect

F02 Create New Blueprint
    S02 Dashboard -> S04 New Project Wizard (Idea -> Constraints -> Stack) -> S05 Overview
    happy path clicks: 5
    edge: empty name, skipped answers, network drop

F03 Artifact Editing & Approval
    S05 Overview -> S06/S07/S08/S10/S11/S12/S13 Artifact Screen -> Edit Draft -> Version Save -> Approve
    happy path clicks: 3
    edge: concurrent edits, dirty draft discard, cross-artifact review flag

F04 AI Assistant Workflow Execution
    Any `/p/:pid/*` -> Header Sparkles Button -> Open AIPanel -> Pick Workflow (e.g. Generate Schema) -> Run Job -> Diff Preview -> Accept / Discard
    happy path clicks: 4
    edge: generation timeout, partial diff, validation failure

F05 ERD Schema Design & DDL Generation
    S11 Database Designer -> Add Entity -> Add Fields & Foreign Keys -> View Live SQL / Prisma tab -> Copy / Download
    happy path clicks: 3
    edge: circular foreign keys, missing primary key, invalid column name

F06 Roadmap Task Progression
    S13 Roadmap -> Group by Phase -> Check off task -> Update status (ready -> in_progress -> completed)
    happy path clicks: 2
    edge: blocked by unfinished dependency

F07 Record Architecture Decision (ADR)
    S14 Decisions -> New Decision -> Fill Context, Decision, Consequences -> Save
    happy path clicks: 3
    edge: unlinked artifact, draft state
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| AppShell | desktop sidebar, mobile drawer | expanded, collapsed | all authenticated screens |
| ArtifactBar | brief, spec, features, architecture, schema, api, roadmap | draft, approved, needs_review, version_saved | S06, S07, S08, S10, S11, S12, S13 |
| DiffView | line diff, side-by-side | added (+), removed (-), unchanged (=) | AIPanel, VersionHistory |
| ExportMenu | dropdown: Markdown, SQL, Prisma | default, open, downloading | S05, S11, Header |
| TableSheet | table modal editor | create, edit, fields reorder | S11 |
| ListEditor | bullet list, numbered list, key-value | adding, editing, deleting, empty | S06, S07 |
| VersionHistory | slide-over sheet | loading, list, compare, restore | all artifact screens |
| AIPanel | slide-over drawer | workflow select, generating, diff review | all project screens |
| Badge | default, secondary, outline, destructive, warning, success | default, hover | all |
| Button | default, outline, ghost, link, destructive | default, hover, active, disabled, loading | all |
| Dialog / Modal | standard, alert, sheet | open, closed, animated | all |

## Inferred data model

```
User
  id: uuid pk
  email: string unique
  name: string
  password_hash: string?
  auth_provider: string (password | google)
  picture: string?
  created_at, updated_at
  evidence: /api/auth/me, /api/auth/login, JWT sub
  confidence: high

Project
  id: uuid pk
  user_id: uuid fk -> User(id)
  name: string
  description: string
  status: string (active | archived)
  is_sample: boolean
  archived_at: timestamp?
  created_at, updated_at
  evidence: /api/projects, /api/projects/:pid
  confidence: high

Artifact
  id: uuid pk
  project_id: uuid fk -> Project(id)
  kind: string (brief | spec | features | architecture | schema | api | roadmap)
  current_version: integer
  status: string (empty | draft | approved)
  needs_review: boolean
  review_reason: string?
  approved_version: integer?
  approved_at: timestamp?
  approved_by: uuid?
  created_at, updated_at
  evidence: /api/projects/:pid/artifacts/:kind
  confidence: high

ArtifactVersion
  id: uuid pk
  artifact_id: uuid fk -> Artifact(id)
  version_number: integer
  content: jsonb
  summary: string?
  created_at: timestamp
  evidence: /api/projects/:pid/artifacts/:kind/versions
  confidence: high

Decision (ADR)
  id: uuid pk
  project_id: uuid fk -> Project(id)
  title: string
  category: string (architecture | stack | schema | api | security | approval | ai)
  decision: text
  reasoning: text?
  artifact_kind: string?
  created_at: timestamp
  evidence: /api/projects/:pid/decisions
  confidence: high

AIJob
  id: uuid pk
  project_id: uuid fk -> Project(id)
  workflow_id: string
  target_kind: string
  instructions: text?
  status: string (pending | running | completed | failed | accepted | discarded)
  result_content: jsonb?
  created_at, updated_at
  evidence: /api/projects/:pid/ai/jobs
  confidence: high
```

Relationships:
- User 1-n Project
- Project 1-7 Artifact
- Artifact 1-n ArtifactVersion
- Project 1-n Decision
- Project 1-n AIJob

## Feature matrix

See `replica/features.csv`. Must: 22, should: 8, could: 4, skip: 1 (proprietary external Google OAuth client ID).

## Out of scope (cannot or should not be cloned)

- Third-party emergentagent proprietary proxy domain (`emergentagent.com` session tokens) — replaced with standard JWT cookies and optional Google OAuth client credentials.

## Size

Screens: 16, Flows: 8, Entities: 6. Hard parts: Interactive ERD Visual Canvas, Real-time DDL (PostgreSQL & Prisma) Generator, Interactive Architecture Diagram with topological connection linter, Line-by-line Diff Visualizer. Size: M (compact fullstack app).
