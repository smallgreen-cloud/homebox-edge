import { describe, expect, it, vi } from "vitest";

import type { HomeAsset, StoredHomeAsset } from "../src/core/asset";
import {
  archiveAsset,
  getAsset,
  insertAsset,
  listAssets,
  searchAssets,
  updateAsset,
  upsertImportedAssets,
} from "../src/storage/assets";

const asset: HomeAsset = {
  import_ref: "laptop-1",
  location: ["Home", "Office"],
  tags: ["Electronics"],
  asset_id: "000-123",
  archived: false,
  name: "Laptop",
  quantity: 1,
  insured: true,
  purchase_price: 32000,
  lifetime_warranty: false,
  sold_price: 0,
  custom_fields: { CPU: "M4" },
};

const stored: StoredHomeAsset = {
  ...asset,
  id: "asset_1",
  created_at: "2026-08-08T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
};

const row = {
  id: stored.id,
  import_ref: asset.import_ref,
  parent_import_ref: null,
  location_json: JSON.stringify(asset.location),
  tags_json: JSON.stringify(asset.tags),
  asset_id: asset.asset_id,
  archived: 0,
  url: null,
  name: asset.name,
  quantity: 1,
  description: null,
  insured: 1,
  notes: null,
  purchase_price: 32000,
  purchase_from: null,
  purchase_date: null,
  manufacturer: null,
  model_number: null,
  serial_number: null,
  lifetime_warranty: 0,
  warranty_expires: null,
  warranty_details: null,
  sold_to: null,
  sold_price: 0,
  sold_date: null,
  sold_notes: null,
  custom_fields_json: JSON.stringify(asset.custom_fields),
  created_at: stored.created_at,
  updated_at: stored.updated_at,
};

function database(options?: { first?: unknown; results?: unknown[]; changes?: number }) {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      const statement = { sql, values: [] as unknown[] };
      statements.push(statement);
      const api = {
        bind: vi.fn((...values: unknown[]) => {
          statement.values = values;
          return api;
        }),
        first: vi.fn().mockResolvedValue(options?.first ?? null),
        all: vi.fn().mockResolvedValue({ results: options?.results ?? [] }),
        run: vi.fn().mockResolvedValue({ meta: { changes: options?.changes ?? 1 } }),
      };
      return api;
    }),
    batch: vi.fn(async (statementsToRun: D1PreparedStatement[]) =>
      statementsToRun.map(() => ({ success: true, meta: { changes: 1 }, results: [] })),
    ),
  };
  return { db: db as unknown as D1Database, statements, batch: db.batch };
}

describe("D1 household asset repository", () => {
  it("inserts and upserts parameterized owner-scoped rows", async () => {
    const target = database();
    await insertAsset(target.db, "owner", stored);
    expect(target.statements[0]?.sql).toContain("INSERT INTO assets");
    expect(target.statements[0]?.values).toContain("owner");
    expect(target.statements[0]?.values).toContain('["Home","Office"]');

    await upsertImportedAssets(target.db, "owner", [asset], stored.updated_at);
    expect(target.batch).toHaveBeenCalledOnce();
    expect(target.statements.at(-1)?.sql).toContain("ON CONFLICT");
  });

  it("chunks import-ref lookups below D1 bind limits", async () => {
    const target = database();
    const many = Array.from({ length: 101 }, (_, index) => ({
      ...asset,
      import_ref: `ref-${index}`,
    }));
    await upsertImportedAssets(target.db, "owner", many, stored.updated_at);
    const lookups = target.statements.filter((statement) =>
      statement.sql.includes("SELECT import_ref"),
    );
    expect(lookups.length).toBeGreaterThan(1);
    expect(lookups.every((statement) => statement.values.length <= 100)).toBe(true);
  });

  it("rejects unresolved parent refs before any import batch writes", async () => {
    const target = database();
    await expect(
      upsertImportedAssets(
        target.db,
        "owner",
        [{ ...asset, import_ref: "child", parent_import_ref: "missing-parent" }],
        stored.updated_at,
      ),
    ).rejects.toThrow("parent import ref");
    expect(target.batch).not.toHaveBeenCalled();
  });

  it("maps rows only inside the authenticated owner scope", async () => {
    const found = database({ first: row, results: [row] });
    await expect(getAsset(found.db, "owner", "asset_1")).resolves.toMatchObject(asset);
    await expect(listAssets(found.db, "owner")).resolves.toHaveLength(1);
    expect(found.statements[0]?.values).toEqual(["owner", "asset_1"]);
  });

  it("uses bound FTS queries and excludes archived assets by default", async () => {
    const target = database({ results: [row] });
    await expect(searchAssets(target.db, "owner", 'Laptop "M4"')).resolves.toHaveLength(1);
    expect(target.statements[0]?.sql).toContain("archived = 0");
    expect(target.statements[0]?.values[0]).toBe("owner");
    await expect(searchAssets(target.db, "owner", "   ")).resolves.toEqual([]);
  });

  it("can include archived assets in owner-scoped search", async () => {
    const target = database({ results: [row] });
    await expect(searchAssets(target.db, "owner", "Laptop", true)).resolves.toHaveLength(1);
    expect(target.statements[0]?.sql).not.toContain("archived = 0");
    expect(target.statements[0]?.values).toEqual(["owner", '"Laptop"*']);
  });

  it("updates allowlisted columns and archives without deletion", async () => {
    const target = database({ changes: 1 });
    await expect(
      updateAsset(target.db, "owner", "asset_1", { notes: "Updated", tags: ["Important"] }, "now"),
    ).resolves.toBe(true);
    expect(target.statements[0]?.sql).toContain("tags_json = ?");
    await expect(updateAsset(target.db, "owner", "asset_1", {}, "now")).resolves.toBe(false);
    await expect(archiveAsset(target.db, "owner", "asset_1", "now")).resolves.toBe(true);
    expect(target.statements.at(-1)?.sql).not.toContain("DELETE");
  });
});
