export const ASSET_ATTACHMENT_TYPES = [
  "photo",
  "manual",
  "warranty",
  "attachment",
  "receipt",
  "thumbnail",
] as const;

export type AssetAttachmentType = (typeof ASSET_ATTACHMENT_TYPES)[number];

export interface StoredAssetAttachment {
  id: string;
  asset_id: string;
  type: AssetAttachmentType;
  primary_photo: boolean;
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

export interface PublicAssetAttachment
  extends Omit<StoredAssetAttachment, "object_key" | "thumbnail_key"> {
  original_url: string;
  thumbnail_url?: string;
}
