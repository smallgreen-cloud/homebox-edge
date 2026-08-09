CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  import_ref TEXT,
  parent_import_ref TEXT,
  location_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  asset_id TEXT,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  url TEXT,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  description TEXT,
  insured INTEGER NOT NULL DEFAULT 0 CHECK (insured IN (0, 1)),
  notes TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  purchase_from TEXT,
  purchase_date TEXT,
  manufacturer TEXT,
  model_number TEXT,
  serial_number TEXT,
  lifetime_warranty INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_warranty IN (0, 1)),
  warranty_expires TEXT,
  warranty_details TEXT,
  sold_to TEXT,
  sold_price REAL NOT NULL DEFAULT 0,
  sold_date TEXT,
  sold_notes TEXT,
  custom_fields_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_assets_user_import_ref
ON assets(user_id, import_ref)
WHERE import_ref IS NOT NULL AND import_ref <> '';

CREATE INDEX idx_assets_user_updated
ON assets(user_id, archived, updated_at DESC);

CREATE VIRTUAL TABLE assets_fts USING fts5(
  name,
  description,
  notes,
  manufacturer,
  model_number,
  serial_number,
  location,
  tags,
  custom_fields
);

CREATE TRIGGER assets_ai AFTER INSERT ON assets BEGIN
  INSERT INTO assets_fts(
    rowid, name, description, notes, manufacturer, model_number,
    serial_number, location, tags, custom_fields
  ) VALUES (
    new.rowid, new.name, new.description, new.notes, new.manufacturer,
    new.model_number, new.serial_number, new.location_json, new.tags_json,
    new.custom_fields_json
  );
END;

CREATE TRIGGER assets_ad AFTER DELETE ON assets BEGIN
  DELETE FROM assets_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER assets_au AFTER UPDATE ON assets BEGIN
  DELETE FROM assets_fts WHERE rowid = old.rowid;
  INSERT INTO assets_fts(
    rowid, name, description, notes, manufacturer, model_number,
    serial_number, location, tags, custom_fields
  ) VALUES (
    new.rowid, new.name, new.description, new.notes, new.manufacturer,
    new.model_number, new.serial_number, new.location_json, new.tags_json,
    new.custom_fields_json
  );
END;
