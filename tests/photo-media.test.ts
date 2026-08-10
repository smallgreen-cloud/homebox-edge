import { describe, expect, it, vi } from "vitest";

import {
  MAX_PHOTO_BYTES,
  parsePhotoUploadRequest,
  processPhoto,
  readPhotoBytes,
} from "../src/media/photos";

describe("photo upload boundary", () => {
  it("accepts a bounded supported image and normalizes its title", () => {
    const request = new Request(
      "https://inventory.example/api/assets/asset_1/photos?title=Coffee%20cup.jpg&primary=true",
      {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": "1024",
        },
        body: new Uint8Array(1024),
      },
    );

    expect(parsePhotoUploadRequest(request)).toEqual({
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      title: "Coffee cup.jpg",
      primary: true,
    });
  });

  it("rejects unknown-length, oversized, and unsupported uploads before buffering", () => {
    expect(() =>
      parsePhotoUploadRequest(
        new Request("https://inventory.example/photos", {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: new Uint8Array([1]),
        }),
      ),
    ).toThrow(/content-length/i);
    expect(() =>
      parsePhotoUploadRequest(
        new Request("https://inventory.example/photos", {
          method: "POST",
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(MAX_PHOTO_BYTES + 1),
          },
          body: new Uint8Array([1]),
        }),
      ),
    ).toThrow(/8 MB/i);
    expect(() =>
      parsePhotoUploadRequest(
        new Request("https://inventory.example/photos", {
          method: "POST",
          headers: {
            "Content-Type": "image/svg+xml",
            "Content-Length": "10",
          },
          body: new Uint8Array(10),
        }),
      ),
    ).toThrow(/JPEG, PNG, WebP, GIF, or AVIF/i);
  });

  it("validates image bytes and creates a bounded WebP thumbnail", async () => {
    const transform = vi.fn();
    const output = vi.fn().mockResolvedValue({
      response: () =>
        new Response(new Uint8Array([4, 5, 6]), {
          headers: { "Content-Type": "image/webp" },
        }),
    });
    const transformer = { transform, output };
    transform.mockReturnValue(transformer);
    const images = {
      info: vi.fn().mockResolvedValue({
        format: "image/jpeg",
        fileSize: 3,
        width: 1200,
        height: 800,
      }),
      input: vi.fn().mockReturnValue(transformer),
    } as unknown as ImagesBinding;

    await expect(processPhoto(images, new Uint8Array([1, 2, 3]).buffer)).resolves.toMatchObject({
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      thumbnailMimeType: "image/webp",
    });
    expect(transform).toHaveBeenCalledWith({
      width: 500,
      height: 500,
      fit: "scale-down",
    });
    expect(output).toHaveBeenCalledWith({ format: "image/webp", quality: 80, anim: false });
  });

  it("stops when streamed bytes exceed the declared or maximum size", async () => {
    const understated = new Request("https://inventory.example/photos", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "Content-Length": "2" },
      body: new Uint8Array([1, 2, 3]),
    });
    await expect(readPhotoBytes(understated, 2)).rejects.toThrow(/Content-Length/i);

    const incomplete = new Request("https://inventory.example/photos", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg", "Content-Length": "4" },
      body: new Uint8Array([1, 2, 3]),
    });
    await expect(readPhotoBytes(incomplete, 4)).rejects.toThrow(/Content-Length/i);
  });
});
