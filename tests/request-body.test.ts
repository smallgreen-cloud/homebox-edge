import { describe, expect, it } from "vitest";

import { PayloadTooLargeError } from "../src/errors";
import { readJsonBody } from "../src/http/body";

describe("bounded Worker JSON requests", () => {
  it("parses a body that is inside the byte boundary", async () => {
    const request = new Request("https://inventory.example/api/assets", {
      method: "POST",
      body: JSON.stringify({ name: "Camera" }),
    });

    await expect(readJsonBody(request, 64)).resolves.toEqual({ name: "Camera" });
  });

  it("rejects declared and streamed bodies beyond the byte boundary", async () => {
    const declared = new Request("https://inventory.example/api/assets", {
      method: "POST",
      headers: { "Content-Length": "65" },
      body: "{}",
    });
    await expect(readJsonBody(declared, 64)).rejects.toMatchObject({
      status: 413,
    });

    const streamed = new Request("https://inventory.example/api/assets", {
      method: "POST",
      body: JSON.stringify({ name: "x".repeat(128) }),
    });
    await expect(readJsonBody(streamed, 64)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("rejects malformed JSON with a public 400 error", async () => {
    const request = new Request("https://inventory.example/api/assets", {
      method: "POST",
      body: "not-json",
    });

    await expect(readJsonBody(request, 64)).rejects.toMatchObject({ status: 400 });
  });
});
