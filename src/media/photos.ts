import { InvalidRequestError, PayloadTooLargeError } from "../errors";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export interface PhotoUploadRequest {
  mimeType: string;
  sizeBytes: number;
  title: string;
  primary: boolean;
}

export interface ProcessedPhoto {
  mimeType: string;
  width: number;
  height: number;
  thumbnailBytes: ArrayBuffer;
  thumbnailMimeType: "image/webp";
}

function normalizeMimeType(value: string | null): string {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function parsePhotoUploadRequest(request: Request): PhotoUploadRequest {
  const lengthValue = request.headers.get("Content-Length");
  if (!lengthValue || !/^\d+$/.test(lengthValue)) {
    throw new InvalidRequestError("Photo upload requires a valid Content-Length header");
  }
  const sizeBytes = Number(lengthValue);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1) {
    throw new InvalidRequestError("Photo upload Content-Length must be greater than zero");
  }
  if (sizeBytes > MAX_PHOTO_BYTES) {
    throw new PayloadTooLargeError("Photo uploads are limited to 8 MB");
  }

  const mimeType = normalizeMimeType(request.headers.get("Content-Type"));
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new InvalidRequestError("Photo must be JPEG, PNG, WebP, GIF, or AVIF");
  }

  const url = new URL(request.url);
  const requestedTitle = url.searchParams.get("title")?.trim() ?? "";
  const title = requestedTitle.slice(0, 255) || "Photo";
  return {
    mimeType,
    sizeBytes,
    title,
    primary: url.searchParams.get("primary") === "true",
  };
}

export async function readPhotoBytes(
  request: Request,
  expectedSize: number,
): Promise<ArrayBuffer> {
  if (!request.body) throw new InvalidRequestError("Photo upload body is required");
  const bytes = new Uint8Array(expectedSize);
  const reader = request.body.getReader();
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.byteLength > expectedSize || offset + value.byteLength > MAX_PHOTO_BYTES) {
      await reader.cancel("Photo body exceeded Content-Length");
      throw new InvalidRequestError("Photo body does not match Content-Length");
    }
    bytes.set(value, offset);
    offset += value.byteLength;
  }
  if (offset !== expectedSize) {
    throw new InvalidRequestError("Photo body does not match Content-Length");
  }
  return bytes.buffer;
}

export async function processPhoto(
  images: ImagesBinding,
  bytes: ArrayBuffer,
): Promise<ProcessedPhoto> {
  const info = await images.info(new Blob([bytes]).stream());
  if (info.format === "image/svg+xml" || !("width" in info) || !("height" in info)) {
    throw new InvalidRequestError("Photo bytes must contain a valid JPEG, PNG, WebP, GIF, or AVIF image");
  }
  const detectedMimeType = normalizeMimeType(info.format);
  if (!SUPPORTED_MIME_TYPES.has(detectedMimeType)) {
    throw new InvalidRequestError("Photo bytes must contain a valid JPEG, PNG, WebP, GIF, or AVIF image");
  }
  if (!Number.isFinite(info.width) || !Number.isFinite(info.height)) {
    throw new InvalidRequestError("Photo dimensions could not be read");
  }

  const result = await images
    .input(new Blob([bytes]).stream())
    .transform({ width: 500, height: 500, fit: "scale-down" })
    .output({ format: "image/webp", quality: 80, anim: false });
  const response = result.response();
  if (!response.ok) {
    throw new InvalidRequestError("Photo thumbnail could not be generated");
  }
  return {
    mimeType: detectedMimeType,
    width: info.width,
    height: info.height,
    thumbnailBytes: await response.arrayBuffer(),
    thumbnailMimeType: "image/webp",
  };
}
