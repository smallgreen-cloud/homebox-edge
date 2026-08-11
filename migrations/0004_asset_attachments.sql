-- HomeBox-compatible attachment metadata. Binary objects remain private in R2;
-- only ownership, presentation, and object references live in D1.
CREATE TABLE asset_attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'attachment'
    CHECK (type IN ('photo', 'manual', 'warranty', 'attachment', 'receipt', 'thumbnail')),
  primary_photo INTEGER NOT NULL DEFAULT 0 CHECK (primary_photo IN (0, 1)),
  title TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  thumbnail_key TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_asset_attachments_asset
ON asset_attachments(user_id, asset_id, created_at DESC);

CREATE UNIQUE INDEX idx_asset_attachments_primary_photo
ON asset_attachments(user_id, asset_id)
WHERE type = 'photo' AND primary_photo = 1;

-- A globally unique asset id is not enough: the attachment owner must also
-- match the asset owner, or direct D1 writes could create cross-owner links.
CREATE TRIGGER asset_attachments_owner_insert
BEFORE INSERT ON asset_attachments
WHEN NOT EXISTS (
  SELECT 1 FROM assets
  WHERE id = NEW.asset_id AND user_id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'attachment asset owner mismatch');
END;

CREATE TRIGGER asset_attachments_owner_update
BEFORE UPDATE OF user_id, asset_id ON asset_attachments
WHEN NOT EXISTS (
  SELECT 1 FROM assets
  WHERE id = NEW.asset_id AND user_id = NEW.user_id
)
BEGIN
  SELECT RAISE(ABORT, 'attachment asset owner mismatch');
END;
