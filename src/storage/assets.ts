import { HomeAssetSchema, type HomeAsset, type StoredHomeAsset } from "../core/asset";
import { assertValidParentGraph, type ParentEdge } from "../core/parent-graph";

interface AssetRow {
  id: string;
  import_ref: string | null;
  parent_import_ref: string | null;
  location_json: string;
  tags_json: string;
  asset_id: string | null;
  archived: number | boolean;
  url: string | null;
  name: string;
  quantity: number;
  description: string | null;
  insured: number | boolean;
  notes: string | null;
  purchase_price: number;
  purchase_from: string | null;
  purchase_date: string | null;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  lifetime_warranty: number | boolean;
  warranty_expires: string | null;
  warranty_details: string | null;
  sold_to: string | null;
  sold_price: number;
  sold_date: string | null;
  sold_notes: string | null;
  custom_fields_json: string;
  created_at: string;
  updated_at: string;
}

const INSERT_COLUMNS = `
  id, user_id, import_ref, parent_import_ref, location_json, tags_json,
  asset_id, archived, url, name, quantity, description, insured, notes,
  purchase_price, purchase_from, purchase_date, manufacturer, model_number,
  serial_number, lifetime_warranty, warranty_expires, warranty_details,
  sold_to, sold_price, sold_date, sold_notes, custom_fields_json,
  created_at, updated_at
`;

const INSERT_PLACEHOLDERS = Array.from({ length: 30 }, () => "?").join(", ");

interface AssetRelationRow extends ParentEdge {
  id: string;
  import_ref: string | null;
  parent_import_ref: string | null;
}

function optional(value: string | null): string | undefined {
  return value ?? undefined;
}

function rowToAsset(row: AssetRow): StoredHomeAsset {
  const parsed = HomeAssetSchema.parse({
    import_ref: optional(row.import_ref),
    parent_import_ref: optional(row.parent_import_ref),
    location: JSON.parse(row.location_json),
    tags: JSON.parse(row.tags_json),
    asset_id: optional(row.asset_id),
    archived: Boolean(row.archived),
    url: optional(row.url),
    name: row.name,
    quantity: row.quantity,
    description: optional(row.description),
    insured: Boolean(row.insured),
    notes: optional(row.notes),
    purchase_price: row.purchase_price,
    purchase_from: optional(row.purchase_from),
    purchase_date: optional(row.purchase_date),
    manufacturer: optional(row.manufacturer),
    model_number: optional(row.model_number),
    serial_number: optional(row.serial_number),
    lifetime_warranty: Boolean(row.lifetime_warranty),
    warranty_expires: optional(row.warranty_expires),
    warranty_details: optional(row.warranty_details),
    sold_to: optional(row.sold_to),
    sold_price: row.sold_price,
    sold_date: optional(row.sold_date),
    sold_notes: optional(row.sold_notes),
    custom_fields: JSON.parse(row.custom_fields_json),
  });
  return {
    ...parsed,
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function bindValues(userId: string, asset: StoredHomeAsset): unknown[] {
  return [
    asset.id,
    userId,
    asset.import_ref ?? null,
    asset.parent_import_ref ?? null,
    JSON.stringify(asset.location),
    JSON.stringify(asset.tags),
    asset.asset_id ?? null,
    Number(asset.archived),
    asset.url ?? null,
    asset.name,
    asset.quantity,
    asset.description ?? null,
    Number(asset.insured),
    asset.notes ?? null,
    asset.purchase_price,
    asset.purchase_from ?? null,
    asset.purchase_date ?? null,
    asset.manufacturer ?? null,
    asset.model_number ?? null,
    asset.serial_number ?? null,
    Number(asset.lifetime_warranty),
    asset.warranty_expires ?? null,
    asset.warranty_details ?? null,
    asset.sold_to ?? null,
    asset.sold_price,
    asset.sold_date ?? null,
    asset.sold_notes ?? null,
    JSON.stringify(asset.custom_fields),
    asset.created_at,
    asset.updated_at,
  ];
}

function sortByParentDependency(assets: readonly HomeAsset[]): HomeAsset[] {
  const byRef = new Map(
    assets.flatMap((asset) => (asset.import_ref ? [[asset.import_ref, asset] as const] : [])),
  );
  const visited = new Set<HomeAsset>();
  const ordered: HomeAsset[] = [];
  const visit = (asset: HomeAsset): void => {
    if (visited.has(asset)) return;
    const parent = asset.parent_import_ref ? byRef.get(asset.parent_import_ref) : undefined;
    if (parent) visit(parent);
    visited.add(asset);
    ordered.push(asset);
  };
  for (const asset of assets) visit(asset);
  return ordered;
}

async function loadAssetRelations(
  db: D1Database,
  userId: string,
): Promise<AssetRelationRow[]> {
  const result = await db
    .prepare(
      `SELECT id, import_ref, parent_import_ref FROM assets
       WHERE user_id = ?`,
    )
    .bind(userId)
    .all<AssetRelationRow>();
  return result.results;
}

export async function insertAsset(
  db: D1Database,
  userId: string,
  asset: StoredHomeAsset,
): Promise<void> {
  if (asset.parent_import_ref) {
    const relations = await loadAssetRelations(db, userId);
    assertValidParentGraph([...relations, asset]);
  }
  await db
    .prepare(`INSERT INTO assets (${INSERT_COLUMNS}) VALUES (${INSERT_PLACEHOLDERS})`)
    .bind(...bindValues(userId, asset))
    .run();
}

export async function upsertImportedAssets(
  db: D1Database,
  userId: string,
  input: readonly HomeAsset[],
  now: string,
): Promise<{ created: number; updated: number }> {
  if (input.length === 0) return { created: 0, updated: 0 };
  const assets = input.map((value) => HomeAssetSchema.parse(value));
  const refs = assets.flatMap((asset) => (asset.import_ref ? [asset.import_ref] : []));
  const inputRefs = new Set(refs);
  if (inputRefs.size !== refs.length) {
    throw new Error("duplicate import refs in one import are not allowed");
  }
  const relations = await loadAssetRelations(db, userId);
  const proposedRefs = new Set(refs);
  const unchanged = relations.filter(
    (row) => !row.import_ref || !proposedRefs.has(row.import_ref),
  );
  assertValidParentGraph([...unchanged, ...assets]);
  const existing = new Set(
    relations.flatMap((row) => (row.import_ref ? [row.import_ref] : [])),
  );

  const sql = `INSERT INTO assets (${INSERT_COLUMNS}) VALUES (${INSERT_PLACEHOLDERS})
    ON CONFLICT(user_id, import_ref) WHERE import_ref IS NOT NULL AND import_ref <> ''
    DO UPDATE SET
      parent_import_ref = excluded.parent_import_ref,
      location_json = excluded.location_json,
      tags_json = excluded.tags_json,
      asset_id = excluded.asset_id,
      archived = excluded.archived,
      url = excluded.url,
      name = excluded.name,
      quantity = excluded.quantity,
      description = excluded.description,
      insured = excluded.insured,
      notes = excluded.notes,
      purchase_price = excluded.purchase_price,
      purchase_from = excluded.purchase_from,
      purchase_date = excluded.purchase_date,
      manufacturer = excluded.manufacturer,
      model_number = excluded.model_number,
      serial_number = excluded.serial_number,
      lifetime_warranty = excluded.lifetime_warranty,
      warranty_expires = excluded.warranty_expires,
      warranty_details = excluded.warranty_details,
      sold_to = excluded.sold_to,
      sold_price = excluded.sold_price,
      sold_date = excluded.sold_date,
      sold_notes = excluded.sold_notes,
      custom_fields_json = excluded.custom_fields_json,
      updated_at = excluded.updated_at`;

  const statements = sortByParentDependency(assets).map((asset) => {
    const stored: StoredHomeAsset = {
      ...asset,
      id: `asset_${crypto.randomUUID()}`,
      created_at: now,
      updated_at: now,
    };
    return db.prepare(sql).bind(...bindValues(userId, stored));
  });
  // D1 guarantees that one batch is one transaction. Splitting this array
  // would allow an error in a later chunk to leave earlier rows committed.
  await db.batch(statements);
  const updated = assets.filter((asset) => asset.import_ref && existing.has(asset.import_ref)).length;
  return { created: assets.length - updated, updated };
}

export async function getAsset(
  db: D1Database,
  userId: string,
  assetId: string,
): Promise<StoredHomeAsset | null> {
  const row = await db
    .prepare("SELECT * FROM assets WHERE user_id = ? AND id = ?")
    .bind(userId, assetId)
    .first<AssetRow>();
  return row ? rowToAsset(row) : null;
}

export async function listAssets(
  db: D1Database,
  userId: string,
  includeArchived = false,
): Promise<StoredHomeAsset[]> {
  const archivedClause = includeArchived ? "" : "AND archived = 0";
  const result = await db
    .prepare(
      `SELECT * FROM assets WHERE user_id = ? ${archivedClause}
       ORDER BY updated_at DESC LIMIT 20000`,
    )
    .bind(userId)
    .all<AssetRow>();
  return result.results.map(rowToAsset);
}

function searchTokens(query: string): string[] {
  return query
    .split(/\s+/)
    .map((token) => token.replaceAll('"', '""').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function toFtsQuery(query: string): string {
  return searchTokens(query)
    .map((token) => `"${token}"*`)
    .join(" OR ");
}

export async function searchAssets(
  db: D1Database,
  userId: string,
  query: string,
  includeArchived = false,
): Promise<StoredHomeAsset[]> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const containsCjk = tokens.some((token) => /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(token));
  if (containsCjk) {
    const archivedClause = includeArchived ? "" : "AND a.archived = 0";
    const searchableText = `lower(
      COALESCE(a.name, '') || char(10) || COALESCE(a.asset_id, '') || char(10) ||
      COALESCE(a.description, '') || char(10) || COALESCE(a.notes, '') || char(10) ||
      COALESCE(a.manufacturer, '') || char(10) || COALESCE(a.model_number, '') || char(10) ||
      COALESCE(a.serial_number, '') || char(10) || COALESCE(a.location_json, '') || char(10) ||
      COALESCE(a.tags_json, '') || char(10) || COALESCE(a.custom_fields_json, '')
    )`;
    const tokenClauses = tokens.map(() => `instr(${searchableText}, lower(?)) > 0`).join(" OR ");
    const result = await db
      .prepare(
        `SELECT a.* FROM assets a
         WHERE a.user_id = ? ${archivedClause} AND (${tokenClauses})
         ORDER BY a.updated_at DESC LIMIT 100`,
      )
      .bind(userId, ...tokens)
      .all<AssetRow>();
    return result.results.map(rowToAsset);
  }

  const fts = toFtsQuery(query);
  const archivedClause = includeArchived ? "" : "AND a.archived = 0";
  const result = await db
    .prepare(
      `SELECT a.* FROM assets a
       JOIN assets_fts f ON f.rowid = a.rowid
       WHERE a.user_id = ? ${archivedClause} AND assets_fts MATCH ?
       ORDER BY rank LIMIT 100`,
    )
    .bind(userId, fts)
    .all<AssetRow>();
  return result.results.map(rowToAsset);
}

export async function updateAsset(
  db: D1Database,
  userId: string,
  assetId: string,
  patch: Partial<HomeAsset>,
  updatedAt: string,
): Promise<boolean> {
  const allowed: Record<string, unknown> = {
    import_ref: patch.import_ref,
    parent_import_ref: patch.parent_import_ref,
    location_json: patch.location ? JSON.stringify(patch.location) : undefined,
    tags_json: patch.tags ? JSON.stringify(patch.tags) : undefined,
    asset_id: patch.asset_id,
    archived: patch.archived === undefined ? undefined : Number(patch.archived),
    url: patch.url,
    name: patch.name,
    quantity: patch.quantity,
    description: patch.description,
    insured: patch.insured === undefined ? undefined : Number(patch.insured),
    notes: patch.notes,
    purchase_price: patch.purchase_price,
    purchase_from: patch.purchase_from,
    purchase_date: patch.purchase_date,
    manufacturer: patch.manufacturer,
    model_number: patch.model_number,
    serial_number: patch.serial_number,
    lifetime_warranty:
      patch.lifetime_warranty === undefined ? undefined : Number(patch.lifetime_warranty),
    warranty_expires: patch.warranty_expires,
    warranty_details: patch.warranty_details,
    sold_to: patch.sold_to,
    sold_price: patch.sold_price,
    sold_date: patch.sold_date,
    sold_notes: patch.sold_notes,
    custom_fields_json: patch.custom_fields
      ? JSON.stringify(patch.custom_fields)
      : undefined,
  };
  const entries = Object.entries(allowed).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return false;
  if (patch.import_ref !== undefined || patch.parent_import_ref !== undefined) {
    const relations = await loadAssetRelations(db, userId);
    const target = relations.find((row) => row.id === assetId);
    if (!target) return false;
    const proposed: AssetRelationRow = {
      ...target,
      import_ref: patch.import_ref ?? target.import_ref,
      parent_import_ref: patch.parent_import_ref ?? target.parent_import_ref,
    };
    assertValidParentGraph(
      relations.map((row) => (row.id === assetId ? proposed : row)),
    );
  }
  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  const result = await db
    .prepare(`UPDATE assets SET ${assignments}, updated_at = ? WHERE user_id = ? AND id = ?`)
    .bind(...entries.map(([, value]) => value), updatedAt, userId, assetId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function archiveAsset(
  db: D1Database,
  userId: string,
  assetId: string,
  updatedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE assets SET archived = 1, updated_at = ? WHERE user_id = ? AND id = ? AND archived = 0",
    )
    .bind(updatedAt, userId, assetId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
