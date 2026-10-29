import { DatabaseSync } from "node:sqlite";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const SQLITE_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, "formora.sqlite");
const LEGACY_JSON_PATH = path.join(__dirname, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sqlite = new DatabaseSync(SQLITE_PATH);

// Production SQLite pragmas: WAL concurrency, foreign key integrity, busy lock wait
sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

// Relational DDL matching replica/schema.sql + SaaS multi-tenant billing + refresh tokens
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    name TEXT NOT NULL,
    picture TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'password',
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    is_sample INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    needs_review INTEGER NOT NULL DEFAULT 0,
    review_reason TEXT,
    approved_version INTEGER,
    approved_at TEXT,
    content_json TEXT NOT NULL DEFAULT '{}',
    approved_content_json TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, kind)
  );

  CREATE TABLE IF NOT EXISTS artifact_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    summary TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'architecture',
    decision TEXT NOT NULL,
    reasoning TEXT,
    artifact_kind TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workflow_id TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    instructions TEXT,
    status TEXT NOT NULL,
    job_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    msg_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS module_docs (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    doc_kind TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, doc_kind)
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    subscription_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL,
    invoice_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts(project_id);
  CREATE INDEX IF NOT EXISTS idx_versions_project_kind ON artifact_versions(project_id, kind);
  CREATE INDEX IF NOT EXISTS idx_decisions_project_id ON decisions(project_id);
  CREATE INDEX IF NOT EXISTS idx_ai_jobs_project_id ON ai_jobs(project_id);
  CREATE INDEX IF NOT EXISTS idx_chat_project_seq ON chat_messages(project_id, seq);
  CREATE INDEX IF NOT EXISTS idx_refresh_user_id ON refresh_tokens(user_id);
`);

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken)).digest("hex");
}

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Persist in-memory state graph atomically to SQLite inside BEGIN IMMEDIATE .. COMMIT.
 */
export function persistStateToSqlite(DB) {
  const now = new Date().toISOString();
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    // 1. Users
    const userIds = (DB.users || []).map((u) => u.id);
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => "?").join(",");
      sqlite.prepare(`DELETE FROM users WHERE id NOT IN (${placeholders})`).run(...userIds);
    } else {
      sqlite.exec("DELETE FROM users");
    }

    const upsertUser = sqlite.prepare(`
      INSERT INTO users (id, email, password_hash, name, picture, auth_provider, plan, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        name = excluded.name,
        picture = excluded.picture,
        auth_provider = excluded.auth_provider,
        plan = excluded.plan,
        updated_at = excluded.updated_at
    `);

    for (const u of DB.users || []) {
      upsertUser.run(
        u.id,
        u.email,
        u.password_hash || null,
        u.name || "Builder",
        u.picture || null,
        u.auth_provider || "password",
        u.plan || "free",
        u.created_at || now,
        u.updated_at || now
      );
    }

    const validUserIdSet = new Set(userIds);

    // 2. Projects
    const projIds = (DB.projects || []).map((p) => p.id);
    if (projIds.length > 0) {
      const placeholders = projIds.map(() => "?").join(",");
      sqlite.prepare(`DELETE FROM projects WHERE id NOT IN (${placeholders})`).run(...projIds);
    } else {
      sqlite.exec("DELETE FROM projects");
    }

    const upsertProject = sqlite.prepare(`
      INSERT INTO projects (id, user_id, name, description, status, is_sample, archived_at, meta_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        is_sample = excluded.is_sample,
        archived_at = excluded.archived_at,
        meta_json = excluded.meta_json,
        updated_at = excluded.updated_at
    `);

    for (const p of DB.projects || []) {
      const ownerId = p.user_id && validUserIdSet.has(p.user_id) ? p.user_id : null;
      const meta = {
        brief_status: p.brief_status || "draft",
        ai_usage: p.ai_usage || { jobs: 0, chars: 0 },
      };
      upsertProject.run(
        p.id,
        ownerId,
        p.name || "Untitled Project",
        p.description || "",
        p.status || "active",
        p.is_sample ? 1 : 0,
        p.archived_at || null,
        JSON.stringify(meta),
        p.created_at || now,
        p.updated_at || now
      );
    }

    const validProjSet = new Set(projIds);

    // 3. Artifacts
    sqlite.exec("DELETE FROM artifacts");
    const insertArtifact = sqlite.prepare(`
      INSERT INTO artifacts (
        id, project_id, kind, current_version, status, needs_review, review_reason,
        approved_version, approved_at, content_json, approved_content_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [pid, arts] of Object.entries(DB.artifacts || {})) {
      if (!validProjSet.has(pid) || !arts) continue;
      for (const [kind, entry] of Object.entries(arts)) {
        if (!entry) continue;
        const meta = entry.artifact || {};
        insertArtifact.run(
          meta.id || `art-${pid}-${kind}`,
          pid,
          kind,
          meta.current_version || 1,
          meta.status || "draft",
          meta.needs_review ? 1 : 0,
          meta.review_reason || null,
          meta.approved_version ?? null,
          meta.approved_at || null,
          JSON.stringify(entry.content || {}),
          entry.approved_content ? JSON.stringify(entry.approved_content) : null,
          meta.updated_at || now
        );
      }
    }

    // 4. Artifact Versions
    sqlite.exec("DELETE FROM artifact_versions");
    const insertVersion = sqlite.prepare(`
      INSERT INTO artifact_versions (project_id, kind, version_number, content_json, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const [pid, byKind] of Object.entries(DB.artifact_versions || {})) {
      if (!validProjSet.has(pid) || !byKind) continue;
      for (const [kind, list] of Object.entries(byKind)) {
        for (const v of list || []) {
          insertVersion.run(
            pid,
            kind,
            v.version_number || 1,
            JSON.stringify(v.content || {}),
            v.summary || "",
            v.created_at || now
          );
        }
      }
    }

    // 5. Decisions
    sqlite.exec("DELETE FROM decisions");
    const insertDecision = sqlite.prepare(`
      INSERT INTO decisions (id, project_id, title, category, decision, reasoning, artifact_kind, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [pid, list] of Object.entries(DB.decisions || {})) {
      if (!validProjSet.has(pid)) continue;
      for (const d of list || []) {
        insertDecision.run(
          d.id || `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pid,
          d.title || "Decision",
          d.category || "architecture",
          d.decision || "",
          d.reasoning || "",
          d.artifact_kind || null,
          d.created_at || now
        );
      }
    }

    // 6. AI Jobs
    sqlite.exec("DELETE FROM ai_jobs");
    const insertJob = sqlite.prepare(`
      INSERT INTO ai_jobs (id, project_id, workflow_id, target_kind, instructions, status, job_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [pid, list] of Object.entries(DB.ai_jobs || {})) {
      if (!validProjSet.has(pid)) continue;
      for (const j of list || []) {
        insertJob.run(
          j.id || `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pid,
          j.workflow_id || j.workflow || "spec",
          j.target_kind || "spec",
          j.instructions || "",
          j.status || "proposed",
          JSON.stringify(j),
          j.created_at || now
        );
      }
    }

    // 7. Chat Messages
    sqlite.exec("DELETE FROM chat_messages");
    const insertChat = sqlite.prepare(`
      INSERT INTO chat_messages (id, project_id, seq, role, content, msg_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const [pid, list] of Object.entries(DB.chats || {})) {
      if (!validProjSet.has(pid)) continue;
      (list || []).forEach((m, idx) => {
        insertChat.run(
          m.id || `msg-${pid}-${idx}`,
          pid,
          idx,
          m.role || "user",
          m.content || "",
          JSON.stringify(m),
          m.created_at || now
        );
      });
    }

    // 8. Module Docs
    sqlite.exec("DELETE FROM module_docs");
    const insertDoc = sqlite.prepare(`
      INSERT INTO module_docs (project_id, doc_kind, notes, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const [pid, docMap] of Object.entries(DB.module_docs || {})) {
      if (!validProjSet.has(pid) || !docMap) continue;
      for (const [docKind, val] of Object.entries(docMap)) {
        insertDoc.run(pid, docKind, val?.notes || "", val?.updated_at || now);
      }
    }

    // 9. Subscriptions
    sqlite.exec("DELETE FROM subscriptions");
    const insertSub = sqlite.prepare(`
      INSERT INTO subscriptions (user_id, subscription_json, updated_at)
      VALUES (?, ?, ?)
    `);
    for (const [uid, sub] of Object.entries(DB.subscriptions || {})) {
      if (!validUserIdSet.has(uid) || !sub) continue;
      insertSub.run(uid, JSON.stringify(sub), sub.updated_at || now);
    }

    // 10. Transactions
    sqlite.exec("DELETE FROM transactions");
    const insertTx = sqlite.prepare(`
      INSERT INTO transactions (id, user_id, event_name, amount, currency, status, invoice_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tx of DB.transactions || []) {
      if (!validUserIdSet.has(tx.user_id)) continue;
      insertTx.run(
        tx.id,
        tx.user_id,
        tx.event_name || "payment",
        tx.amount || 0,
        tx.currency || "USD",
        tx.status || "succeeded",
        tx.invoice_url || null,
        tx.created_at || now
      );
    }

    // 11. Processed Webhooks
    const insertWebhook = sqlite.prepare(`
      INSERT OR IGNORE INTO processed_webhooks (event_id, processed_at)
      VALUES (?, ?)
    `);
    for (const evtId of DB.processed_webhooks || []) {
      insertWebhook.run(String(evtId), now);
    }

    sqlite.exec("COMMIT");
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
}

/**
 * Hydrate structured state from SQLite tables.
 */
export function loadStateFromSqlite() {
  const users = sqlite.prepare("SELECT * FROM users ORDER BY created_at ASC").all().map((row) => ({
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    name: row.name,
    picture: row.picture,
    auth_provider: row.auth_provider,
    plan: row.plan || "free",
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const subscriptions = {};
  for (const row of sqlite.prepare("SELECT * FROM subscriptions").all()) {
    subscriptions[row.user_id] = safeJsonParse(row.subscription_json, null);
  }
  for (const u of users) {
    u.subscription = subscriptions[u.id] || null;
  }

  const projects = sqlite.prepare("SELECT * FROM projects ORDER BY created_at DESC").all().map((row) => {
    const meta = safeJsonParse(row.meta_json, {});
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description,
      status: row.status,
      is_sample: Boolean(row.is_sample),
      archived_at: row.archived_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      brief_status: meta.brief_status || "draft",
      ai_usage: meta.ai_usage || { jobs: 0, chars: 0 },
      flagged: { endpoints: [], tasks: [] },
    };
  });

  const artifacts = {};
  for (const row of sqlite.prepare("SELECT * FROM artifacts").all()) {
    if (!artifacts[row.project_id]) artifacts[row.project_id] = {};
    artifacts[row.project_id][row.kind] = {
      artifact: {
        id: row.id,
        project_id: row.project_id,
        kind: row.kind,
        current_version: row.current_version,
        status: row.status,
        needs_review: Boolean(row.needs_review),
        review_reason: row.review_reason,
        approved_version: row.approved_version,
        approved_at: row.approved_at,
        updated_at: row.updated_at,
      },
      content: safeJsonParse(row.content_json, {}),
      approved_content: row.approved_content_json ? safeJsonParse(row.approved_content_json, null) : null,
    };
  }

  const artifact_versions = {};
  for (const row of sqlite.prepare("SELECT * FROM artifact_versions ORDER BY version_number DESC").all()) {
    if (!artifact_versions[row.project_id]) artifact_versions[row.project_id] = {};
    if (!artifact_versions[row.project_id][row.kind]) artifact_versions[row.project_id][row.kind] = [];
    artifact_versions[row.project_id][row.kind].push({
      version_number: row.version_number,
      content: safeJsonParse(row.content_json, {}),
      summary: row.summary,
      created_at: row.created_at,
    });
  }

  const decisions = {};
  for (const row of sqlite.prepare("SELECT * FROM decisions ORDER BY created_at DESC").all()) {
    if (!decisions[row.project_id]) decisions[row.project_id] = [];
    decisions[row.project_id].push({
      id: row.id,
      title: row.title,
      category: row.category,
      decision: row.decision,
      reasoning: row.reasoning,
      artifact_kind: row.artifact_kind,
      created_at: row.created_at,
    });
  }

  const ai_jobs = {};
  for (const row of sqlite.prepare("SELECT * FROM ai_jobs ORDER BY created_at DESC").all()) {
    if (!ai_jobs[row.project_id]) ai_jobs[row.project_id] = [];
    ai_jobs[row.project_id].push(safeJsonParse(row.job_json, { id: row.id, status: row.status }));
  }

  const chats = {};
  for (const row of sqlite.prepare("SELECT * FROM chat_messages ORDER BY seq ASC").all()) {
    if (!chats[row.project_id]) chats[row.project_id] = [];
    chats[row.project_id].push(
      safeJsonParse(row.msg_json, {
        id: row.id,
        role: row.role,
        content: row.content,
        created_at: row.created_at,
      })
    );
  }

  const module_docs = {};
  for (const row of sqlite.prepare("SELECT * FROM module_docs").all()) {
    if (!module_docs[row.project_id]) module_docs[row.project_id] = {};
    module_docs[row.project_id][row.doc_kind] = {
      notes: row.notes,
      updated_at: row.updated_at,
    };
  }

  const transactions = sqlite.prepare("SELECT * FROM transactions ORDER BY created_at DESC").all();
  const processed_webhooks = sqlite
    .prepare("SELECT event_id FROM processed_webhooks")
    .all()
    .map((r) => r.event_id);

  return {
    users,
    projects,
    artifacts,
    artifact_versions,
    decisions,
    ai_jobs,
    chats,
    module_docs,
    subscriptions,
    transactions,
    processed_webhooks,
  };
}

/**
 * Initialize SQLite database: hydrate if populated, otherwise migrate legacy db.json or seed initial dataset.
 */
export function initializeSqliteDatabase(createInitialSeedState) {
  const countRow = sqlite.prepare("SELECT COUNT(*) AS cnt FROM users").get();
  if (countRow && countRow.cnt > 0) {
    return loadStateFromSqlite();
  }

  let initialState = null;
  if (fs.existsSync(LEGACY_JSON_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, "utf-8"));
      if (Array.isArray(parsed.users) && parsed.users.length > 0) {
        parsed.chats = parsed.chats || {};
        parsed.module_docs = parsed.module_docs || {};
        parsed.artifact_versions = parsed.artifact_versions || {};
        parsed.decisions = parsed.decisions || {};
        parsed.ai_jobs = parsed.ai_jobs || {};
        parsed.processed_webhooks = parsed.processed_webhooks || [];
        parsed.subscriptions = parsed.subscriptions || {};
        parsed.transactions = parsed.transactions || [];
        for (const u of parsed.users) {
          if (!u.plan) u.plan = "free";
        }
        initialState = parsed;
        console.log("[DB] Migrated legacy db.json into relational SQLite WAL store.");
      }
    } catch (err) {
      console.warn("[DB] Failed reading legacy db.json, falling back to clean seed:", err.message);
    }
  }

  if (!initialState) {
    initialState = createInitialSeedState();
  }

  persistStateToSqlite(initialState);
  return loadStateFromSqlite();
}

/**
 * Refresh token rotation & server-side revocation
 */
export function storeRefreshToken(rawToken, userId, expiresAtIso) {
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();
  sqlite
    .prepare("DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked = 1")
    .run(now);
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO refresh_tokens (token_hash, user_id, expires_at, revoked, created_at)
       VALUES (?, ?, ?, 0, ?)`
    )
    .run(tokenHash, userId, expiresAtIso, now);
}

export function consumeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();
  const row = sqlite
    .prepare("SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0")
    .get(tokenHash);
  if (!row) return null;
  if (row.expires_at < now) {
    sqlite.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  // Rotate: revoke single-use refresh token upon consumption
  sqlite.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?").run(tokenHash);
  return row;
}

export function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  sqlite.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?").run(tokenHash);
}

export function getDatabaseHealth() {
  const ping = sqlite.prepare("SELECT 1 AS ok").get();
  const users = sqlite.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const projects = sqlite.prepare("SELECT COUNT(*) AS c FROM projects").get().c;
  const journal = sqlite.prepare("PRAGMA journal_mode").get();
  return {
    ok: ping?.ok === 1,
    engine: "sqlite-wal",
    journal_mode: journal?.journal_mode || "wal",
    path: path.basename(SQLITE_PATH),
    counts: { users, projects },
  };
}
