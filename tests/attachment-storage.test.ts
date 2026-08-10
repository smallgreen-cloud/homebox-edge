import { describe, expect, it, vi } from "vitest";

import type { StoredAssetAttachment } from "../src/core/attachment";
import {
  countPhotoAttachments,
  deleteAttachment,
  getAttachment,
  insertAttachment,
  listAttachments,
  listPrimaryPhotoAttachments,
  setPrimaryPhoto,
  updateAttachmentTitle,
} from "../src/storage/attachments";

const row = {
  id: "attachment_1",
  user_id: "owner",
  asset_id: "asset_1",
  type: "photo",
  primary_photo: 1,
  title: "Front.jpg",
  object_key: "users/owner/assets/asset_1/attachment_1/original",
  thumbnail_key: "users/owner/assets/asset_1/attachment_1/thumbnail.webp",
  mime_type: "image/jpeg",
  size_bytes: 2048,
  width: 1200,
  height: 800,
  created_at: "2026-08-10T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
};

const attachment: StoredAssetAttachment = {
  id: row.id,
  asset_id: row.asset_id,
  type: "photo",
  primary_photo: true,
  title: row.title,
  object_key: row.object_key,
  thumbnail_key: row.thumbnail_key,
  mime_type: row.mime_type,
  size_bytes: row.size_bytes,
  width: row.width,
  height: row.height,
  created_at: row.created_at,
  updated_at: row.updated_at,
};

function database(options: { first?: unknown; results?: unknown[]; changes?: number } = {}) {
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
        first: vi.fn().mockResolvedValue(options.first ?? null),
        all: vi.fn().mockResolvedValue({ results: options.results ?? [] }),
        run: vi.fn().mockResolvedValue({ meta: { changes: options.changes ?? 1 } }),
      };
      return api;
    }),
    batch: vi.fn(async () => [
      { success: true, meta: { changes: 1 }, results: [] },
      { success: true, meta: { changes: 1 }, results: [] },
    ]),
  };
  return { db: db as unknown as D1Database, statements, batch: db.batch };
}

describe("D1 asset attachment repository", () => {
  it("inserts and maps HomeBox-compatible photo metadata in the owner scope", async () => {
    const target = database({ first: row, results: [row] });
    await insertAttachment(target.db, "owner", attachment);
    expect(target.statements[0]?.sql).toContain("INSERT INTO asset_attachments");
    expect(target.statements[0]?.values).toContain("owner");

    await expect(getAttachment(target.db, "owner", "asset_1", "attachment_1")).resolves.toEqual(
      attachment,
    );
    await expect(listAttachments(target.db, "owner", "asset_1")).resolves.toEqual([attachment]);
    await expect(listPrimaryPhotoAttachments(target.db, "owner")).resolves.toEqual([attachment]);
    expect(target.statements.at(-1)?.sql).toContain("primary_photo = 1");
  });

  it("counts photos and switches one primary photo atomically", async () => {
    const countTarget = database({ first: { count: 2 } });
    await expect(countPhotoAttachments(countTarget.db, "owner", "asset_1")).resolves.toBe(2);

    const target = database({ first: row });
    await expect(
      setPrimaryPhoto(target.db, "owner", "asset_1", "attachment_1", "now"),
    ).resolves.toBe(true);
    expect(target.batch).toHaveBeenCalledOnce();
    const sql = target.statements.map((statement) => statement.sql).join("\n");
    expect(sql).toContain("primary_photo = 0");
    expect(sql).toContain("primary_photo = 1");
  });

  it("updates titles and returns deleted object references for R2 cleanup", async () => {
    const titleTarget = database({ changes: 1 });
    await expect(
      updateAttachmentTitle(
        titleTarget.db,
        "owner",
        "asset_1",
        "attachment_1",
        "New title",
        "now",
      ),
    ).resolves.toBe(true);
    expect(titleTarget.statements[0]?.values).toContain("owner");

    const deleteTarget = database({ first: row, changes: 1 });
    await expect(
      deleteAttachment(deleteTarget.db, "owner", "asset_1", "attachment_1"),
    ).resolves.toEqual(attachment);
    expect(deleteTarget.statements.at(-1)?.sql).toContain("DELETE FROM asset_attachments");
    expect(deleteTarget.statements.at(-1)?.values).toEqual([
      "owner",
      "asset_1",
      "attachment_1",
    ]);
  });
});
