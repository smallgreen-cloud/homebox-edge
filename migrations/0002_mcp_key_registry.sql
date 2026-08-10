CREATE TABLE mcp_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kv_key TEXT NOT NULL UNIQUE,
  preview TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_mcp_keys_user_expiry
ON mcp_keys(user_id, expires_at DESC);

CREATE TABLE mcp_key_registry_migrations (
  user_id TEXT PRIMARY KEY,
  migrated_at INTEGER NOT NULL
);
