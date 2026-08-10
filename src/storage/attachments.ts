import type {
  AssetAttachmentType,
  StoredAssetAttachment,
} from "../core/attachment";

interface AttachmentRow {
  id: string;
  user_id: string;
  asset_id: string;
  type: AssetAttachmentType;
  primary_photo: number | boolean;
  title: string;
  object_key: string;
  thumbnail_key: string | null;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

function rowToAttachment(row: AttachmentRow): StoredAssetAttachment {
  return {
    id: row.id,
    asset_id: row.asset_id,
    type: row.type,
    primary_photo: Boolean(row.primary_photo),
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
}

export async function insertAttachment(
  db: D1Database,
  userId: string,
  attachment: StoredAssetAttachment,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO asset_attachments (
        id, user_id, asset_id, type, primary_photo, title, object_key,
        thumbnail_key, mime_type, size_bytes, width, height, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      attachment.id,
      userId,
      attachment.asset_id,
      attachment.type,
      Number(attachment.primary_photo),
      attachment.title,
      attachment.object_key,
      attachment.thumbnail_key,
      attachment.mime_type,
      attachment.size_bytes,
      attachment.width,
      attachment.height,
      attachment.created_at,
      attachment.updated_at,
    )
    .run();
}

export async function listAttachments(
  db: D1Database,
  userId: string,
  assetId: string,
): Promise<StoredAssetAttachment[]> {
  const result = await db
    .prepare(
      `SELECT * FROM asset_attachments
       WHERE user_id = ? AND asset_id = ?
       ORDER BY primary_photo DESC, created_at DESC`,
    )
    .bind(userId, assetId)
    .all<AttachmentRow>();
  return result.results.map(rowToAttachment);
}

export async function listPrimaryPhotoAttachments(
  db: D1Database,
  userId: string,
): Promise<StoredAssetAttachment[]> {
  const result = await db
    .prepare(
      `SELECT * FROM asset_attachments
       WHERE user_id = ? AND type = 'photo' AND primary_photo = 1
       ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<AttachmentRow>();
  return result.results.map(rowToAttachment);
}

export async function getAttachment(
  db: D1Database,
  userId: string,
  assetId: string,
  attachmentId: string,
): Promise<StoredAssetAttachment | null> {
  const row = await db
    .prepare(
      `SELECT * FROM asset_attachments
       WHERE user_id = ? AND asset_id = ? AND id = ?`,
    )
    .bind(userId, assetId, attachmentId)
    .first<AttachmentRow>();
  return row ? rowToAttachment(row) : null;
}

export async function countPhotoAttachments(
  db: D1Database,
  userId: string,
  assetId: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM asset_attachments
       WHERE user_id = ? AND asset_id = ? AND type = 'photo'`,
    )
    .bind(userId, assetId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function setPrimaryPhoto(
  db: D1Database,
  userId: string,
  assetId: string,
  attachmentId: string,
  updatedAt: string,
): Promise<boolean> {
  const attachment = await getAttachment(db, userId, assetId, attachmentId);
  if (!attachment || attachment.type !== "photo") return false;
  const statements = [
    db
      .prepare(
        `UPDATE asset_attachments SET primary_photo = 0, updated_at = ?
         WHERE user_id = ? AND asset_id = ? AND type = 'photo' AND primary_photo = 1`,
      )
      .bind(updatedAt, userId, assetId),
    db
      .prepare(
        `UPDATE asset_attachments SET primary_photo = 1, updated_at = ?
         WHERE user_id = ? AND asset_id = ? AND id = ? AND type = 'photo'`,
      )
      .bind(updatedAt, userId, assetId, attachmentId),
  ];
  const result = await db.batch(statements);
  return (result[1]?.meta.changes ?? 0) > 0;
}

export async function updateAttachmentTitle(
  db: D1Database,
  userId: string,
  assetId: string,
  attachmentId: string,
  title: string,
  updatedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE asset_attachments SET title = ?, updated_at = ?
       WHERE user_id = ? AND asset_id = ? AND id = ?`,
    )
    .bind(title, updatedAt, userId, assetId, attachmentId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteAttachment(
  db: D1Database,
  userId: string,
  assetId: string,
  attachmentId: string,
): Promise<StoredAssetAttachment | null> {
  const attachment = await getAttachment(db, userId, assetId, attachmentId);
  if (!attachment) return null;
  const result = await db
    .prepare(
      "DELETE FROM asset_attachments WHERE user_id = ? AND asset_id = ? AND id = ?",
    )
    .bind(userId, assetId, attachmentId)
    .run();
  return (result.meta.changes ?? 0) > 0 ? attachment : null;
}
