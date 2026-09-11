CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  title TEXT NOT NULL,
  journey TEXT NOT NULL,
  session TEXT NOT NULL,
  status TEXT NOT NULL,
  kept INTEGER NOT NULL DEFAULT 0,
  active_artifact_id TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_owner_updated ON projects (owner, updated_at);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  payload TEXT NOT NULL,
  storage_key TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS artifacts_project ON artifacts (project_id);

CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  owner TEXT NOT NULL,
  request_key TEXT NOT NULL,
  status TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL,
  input TEXT NOT NULL,
  artifact_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS generations_request_key ON generations (owner, request_key);
CREATE INDEX IF NOT EXISTS generations_project ON generations (project_id);
CREATE INDEX IF NOT EXISTS generations_owner_created ON generations (owner, created_at);

CREATE TABLE IF NOT EXISTS interaction_events (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  project_id TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_project ON interaction_events (project_id);

CREATE TABLE IF NOT EXISTS journey_versions (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  definition TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS journey_version_unique ON journey_versions (journey_id, version);

CREATE TABLE IF NOT EXISTS journey_settings (
  journey_id TEXT PRIMARY KEY,
  hidden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS preferences (
  owner TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
