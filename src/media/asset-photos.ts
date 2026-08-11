import type {
  PublicAssetAttachment,
  StoredAssetAttachment,
} from "../core/attachment";
import { InvalidRequestError, NotFoundError } from "../errors";
import { getAsset } from "../storage/assets";
import {
  countPhotoAttachments,
  deleteAttachment,
  insertAttachment,
  setPrimaryPhoto,
} from "../storage/attachments";
import {
  parsePhotoUploadRequest,
  processPhoto,
  readPhotoBytes,
} from "./photos";

interface PhotoBindings {
  DB: D1Database;
  ASSET_FILES: R2Bucket;
  IMAGES: ImagesBinding;
}

function urlBase(value: string): string {
  return value.replace(/\/$/, "");
}

export function publicAttachment(
  origin: string,
  attachment: StoredAssetAttachment,
): PublicAssetAttachment {
  const base = `${urlBase(origin)}/api/assets/${encodeURIComponent(attachment.asset_id)}`;
  const attachmentPath = `${base}/attachments/${encodeURIComponent(attachment.id)}`;
  return {
    id: attachment.id,
    asset_id: attachment.asset_id,
    type: attachment.type,
    primary_photo: attachment.primary_photo,
    title: attachment.title,
    mime_type: attachment.mime_type,
    size_bytes: attachment.size_bytes,
    width: attachment.width,
    height: attachment.height,
    created_at: attachment.created_at,
    updated_at: attachment.updated_at,
    original_url: attachmentPath,
    ...(attachment.thumbnail_key ? { thumbnail_url: `${attachmentPath}/thumbnail` } : {}),
  };
}

async function ownerKey(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function cleanupObjects(bucket: R2Bucket, keys: string[]): Promise<void> {
  try {
    await bucket.delete(keys);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "photo object rollback failed",
        objectCount: keys.length,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function uploadAssetPhoto(
  env: PhotoBindings,
  userId: string,
  assetId: string,
  request: Request,
): Promise<StoredAssetAttachment> {
  if (!(await getAsset(env.DB, userId, assetId))) {
    throw new NotFoundError("Asset not found");
  }
  const upload = parsePhotoUploadRequest(request);
  const bytes = await readPhotoBytes(request, upload.sizeBytes);
  const processed = await processPhoto(env.IMAGES, bytes);
  const attachmentId = `attachment_${crypto.randomUUID()}`;
  const keyPrefix = `users/${await ownerKey(userId)}/assets/${assetId}/${attachmentId}`;
  const objectKey = `${keyPrefix}/original`;
  const thumbnailKey = `${keyPrefix}/thumbnail.webp`;
  const keys = [objectKey, thumbnailKey];
  const now = new Date().toISOString();
  const attachment: StoredAssetAttachment = {
    id: attachmentId,
    asset_id: assetId,
    type: "photo",
    primary_photo: false,
    title: upload.title,
    object_key: objectKey,
    thumbnail_key: thumbnailKey,
    mime_type: processed.mimeType,
    size_bytes: upload.sizeBytes,
    width: processed.width,
    height: processed.height,
    created_at: now,
    updated_at: now,
  };

  try {
    await Promise.all([
      env.ASSET_FILES.put(objectKey, bytes, {
        httpMetadata: { contentType: processed.mimeType },
      }),
      env.ASSET_FILES.put(thumbnailKey, processed.thumbnailBytes, {
        httpMetadata: { contentType: processed.thumbnailMimeType },
      }),
    ]);
    const shouldBecomePrimary =
      upload.primary || (await countPhotoAttachments(env.DB, userId, assetId)) === 0;
    await insertAttachment(env.DB, userId, attachment);
    if (shouldBecomePrimary) {
      const selected = await setPrimaryPhoto(
        env.DB,
        userId,
        assetId,
        attachmentId,
        now,
      );
      if (!selected) throw new InvalidRequestError("Photo could not be selected as primary");
      return { ...attachment, primary_photo: true };
    }
    return attachment;
  } catch (error) {
    await deleteAttachment(env.DB, userId, assetId, attachmentId).catch(() => null);
    await cleanupObjects(env.ASSET_FILES, keys);
    throw error;
  }
}
