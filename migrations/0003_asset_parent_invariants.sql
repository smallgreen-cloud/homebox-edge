-- Parent references are portable HomeBox identifiers. Keep their invariants
-- inside D1 as the final authority so concurrent API/MCP writes cannot bypass
-- application validation.

CREATE TRIGGER assets_parent_insert
BEFORE INSERT ON assets
WHEN NEW.parent_import_ref IS NOT NULL AND trim(NEW.parent_import_ref) <> ''
BEGIN
  SELECT CASE
    WHEN NEW.import_ref = NEW.parent_import_ref
    THEN RAISE(ABORT, 'cyclic parent refs')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM assets
      WHERE user_id = NEW.user_id AND import_ref = NEW.parent_import_ref
    )
    THEN RAISE(ABORT, 'parent import ref was not found')
  END;
END;

CREATE TRIGGER assets_import_ref_update
BEFORE UPDATE OF import_ref ON assets
WHEN COALESCE(NEW.import_ref, '') <> COALESCE(OLD.import_ref, '')
  AND EXISTS (
    SELECT 1 FROM assets
    WHERE user_id = OLD.user_id
      AND parent_import_ref = OLD.import_ref
      AND id <> OLD.id
  )
BEGIN
  SELECT RAISE(ABORT, 'import ref is referenced by child assets');
END;

CREATE TRIGGER assets_parent_update
BEFORE UPDATE OF import_ref, parent_import_ref ON assets
WHEN NEW.parent_import_ref IS NOT NULL AND trim(NEW.parent_import_ref) <> ''
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM assets
      WHERE user_id = NEW.user_id AND import_ref = NEW.parent_import_ref
    )
    THEN RAISE(ABORT, 'parent import ref was not found')
  END;
  SELECT CASE
    WHEN EXISTS (
      WITH RECURSIVE ancestors(ref) AS (
        SELECT NEW.parent_import_ref
        UNION ALL
        SELECT parent.parent_import_ref
        FROM assets AS parent
        JOIN ancestors ON parent.import_ref = ancestors.ref
        WHERE parent.user_id = NEW.user_id
          AND parent.id <> NEW.id
          AND parent.parent_import_ref IS NOT NULL
          AND trim(parent.parent_import_ref) <> ''
      )
      SELECT 1 FROM ancestors WHERE ref = NEW.import_ref
    )
    THEN RAISE(ABORT, 'cyclic parent refs')
  END;
END;
