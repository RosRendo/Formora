# 📋 Formora — Enterprise Specification Engine & Blueprint Studio

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black.svg?logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E.svg?logo=nestjs)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57.svg?logo=sqlite)
![Prisma](https://img.shields.io/badge/Prisma-6.0-2D3748.svg?logo=prisma)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC.svg?logo=tailwind-css)
![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-f69220.svg?logo=pnpm)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**Interactive software blueprint studio and enterprise specification compiler converting product requirements into production architecture schemas.**

[System Architecture](#-system-architecture) • [Database ERD](#-database-erd-13-table-relational-schema) • [Synthesis Flow](#-specification-synthesis-workflow) • [Quick Start](#-quick-start)

</div>

---

## ⚡ Overview

**Formora** streamlines complex product planning. It allows engineering leaders to author, validate, and compile complex software specifications across 12 discrete architectural modules, maintaining sub-millisecond querying speed via an embedded **SQLite WAL** persistence layer.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph UIStudio["🎨 Visual Blueprint Studio (Next.js 16 + React 19)"]
        SpecEditor["Interactive Spec & Form Builder"]
        ModuleTree["12-Module Architectural Navigation Tree"]
        PreviewRenderer["Real-Time AST Schema Visualizer"]
        ExportModule["Markdown / JSON / OpenAPI Exporter"]
        
        SpecEditor & ModuleTree & PreviewRenderer & ExportModule
    end

    subgraph BackendGateway["⚡ NestJS 11 Core Service"]
        ValidationCore["Zod & Class-Validator Pipeline"]
        SpecCompiler["Specification AST Synthesis Engine"]
        VersionController["Blueprint Versioning & Diffing Manager"]
        
        UIStudio <--> ValidationCore
        ValidationCore --> SpecCompiler
        SpecCompiler --> VersionController
    end

    subgraph StorageLayer["💾 Persistence Layer (SQLite WAL)"]
        SQLiteDB[(SQLite Database - High Concurrency WAL)]
        PrismaClient["Prisma 6 Client"]
        
        VersionController <--> PrismaClient <--> SQLiteDB
    end
```

---

## 📊 Database ERD (13-Table Relational Schema)

```mermaid
erDiagram
    PROJECTS ||--o{ SPECIFICATIONS : contains
    SPECIFICATIONS ||--o{ MODULE_SPECS : details
    MODULE_SPECS ||--o{ SPEC_FIELDS : defines
    SPEC_FIELDS ||--o{ FIELD_VALIDATIONS : enforces
    PROJECTS ||--o{ COLLABORATORS : invites
    PROJECTS ||--o{ EXPORT_LOGS : tracks

    PROJECTS {
        string id PK "cuid"
        string name
        string description
        string industry
        datetime createdAt
        datetime updatedAt
    }

    SPECIFICATIONS {
        string id PK "cuid"
        string projectId FK
        string version
        string status "DRAFT | REVIEW | PUBLISHED"
        json metadata
        datetime createdAt
    }

    MODULE_SPECS {
        string id PK "cuid"
        string specificationId FK
        string moduleType "AUTH | DATABASE | API | DEVOPS | UI"
        string title
        text content
    }

    SPEC_FIELDS {
        string id PK "cuid"
        string moduleSpecId FK
        string fieldKey
        string dataType
        boolean isRequired
    }

    FIELD_VALIDATIONS {
        string id PK "cuid"
        string specFieldId FK
        string ruleType
        string ruleValue
    }

    COLLABORATORS {
        string id PK "cuid"
        string projectId FK
        string email
        string role "OWNER | EDITOR | VIEWER"
    }

    EXPORT_LOGS {
        string id PK "cuid"
        string projectId FK
        string format "JSON | MARKDOWN | OPENAPI"
        datetime exportedAt
    }
```

---

## 🔄 Specification Synthesis Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Architect as 📐 System Architect
    participant Studio as 🎨 Formora Studio
    participant API as ⚡ NestJS API
    participant Compiler as ⚙️ AST Compiler
    participant SQLite as 💾 SQLite WAL

    Architect->>Studio: Selects "Database & Auth" Architecture Modules
    Studio->>API: POST /api/specs/draft { modules: ["AUTH", "DB"] }
    API->>SQLite: Insert Specification Record
    
    Architect->>Studio: Defines Entities, Fields, and Security Constraints
    Studio->>API: PATCH /api/specs/:id/fields (Batch Schema Update)
    API->>Compiler: Synthesize Unified Abstract Syntax Tree
    Compiler-->>API: Verified Specification AST (Zero conflicts)
    
    API->>SQLite: Commit Versioned Blueprint State
    API-->>Studio: Instant Preview (Mermaid ERD + OpenAPI Spec)
    Architect->>Studio: Click Export Production Blueprint (.json / .md)
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Database Migration
```bash
pnpm prisma db push
```

### 3. Start Development Server
```bash
pnpm run dev
```

Visit `http://localhost:3000` to launch Formora.

---

## 📄 License
MIT License © **[Ros Rendo](https://github.com/RosRendo)**
