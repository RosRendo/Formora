-- Formora / Blueprint OS Database Schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  name VARCHAR(120) NOT NULL,
  picture TEXT,
  auth_provider VARCHAR(50) NOT NULL DEFAULT 'password',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  is_sample BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind VARCHAR(50) NOT NULL CHECK (kind IN ('brief', 'spec', 'features', 'architecture', 'schema', 'api', 'roadmap')),
  current_version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('empty', 'draft', 'approved')),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_reason TEXT,
  approved_version INTEGER,
  approved_at TIMESTAMPTZ,
  content JSONB NOT NULL DEFAULT '{}',
  approved_content JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_kind UNIQUE (project_id, kind)
);

CREATE TABLE artifact_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_artifact_version UNIQUE (artifact_id, version_number)
);

CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'architecture',
  decision TEXT NOT NULL,
  reasoning TEXT,
  artifact_kind VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  phase VARCHAR(100) NOT NULL DEFAULT 'Foundation',
  status VARCHAR(50) NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'in_progress', 'completed', 'blocked')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  dependencies JSONB NOT NULL DEFAULT '[]',
  estimated_hours NUMERIC(6, 2) DEFAULT 0,
  assigned_to VARCHAR(100),
  artifact_kind VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workflow_id VARCHAR(100) NOT NULL,
  target_kind VARCHAR(50) NOT NULL,
  instructions TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'accepted', 'discarded')),
  result_content JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_artifacts_project_id ON artifacts(project_id);
CREATE INDEX idx_artifact_versions_artifact_id ON artifact_versions(artifact_id);
CREATE INDEX idx_decisions_project_id ON decisions(project_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_ai_jobs_project_id ON ai_jobs(project_id);
