import { describe, expect, it } from "vitest";

import { authenticateWeb, extractMcpToken, parseTokenRecord } from "../src/auth";

describe("HomeBox Edge authentication", () => {
  it("prefers bearer MCP tokens and accepts connector URL fallback", () => {
    expect(
      extractMcpToken(
        new Request("https://inventory.example/mcp?key=hi_url", {
          headers: { Authorization: "Bearer hi_header" },
        }),
      ),
    ).toBe("hi_header");
    expect(extractMcpToken(new Request("https://inventory.example/mcp?key=hi_url"))).toBe(
      "hi_url",
    );
  });

  it("rejects malformed and expired KV records", () => {
    expect(parseTokenRecord("bad json", 100)).toBeNull();
    expect(parseTokenRecord(JSON.stringify({ uid: "owner", expires_at: 99 }), 100)).toBeNull();
    expect(parseTokenRecord(JSON.stringify({ uid: "owner", expires_at: 101 }), 100)).toMatchObject({
      uid: "owner",
    });
  });

  it("accepts only an exact owner bearer token", async () => {
    const valid = new Request("https://inventory.example/api/me", {
      headers: { Authorization: "Bearer exact-secret" },
    });
    const invalid = new Request("https://inventory.example/api/me", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    await expect(authenticateWeb(valid, "exact-secret")).resolves.toMatchObject({ uid: "owner" });
    await expect(authenticateWeb(invalid, "exact-secret")).resolves.toBeNull();
    await expect(authenticateWeb(valid, undefined)).resolves.toBeNull();
  });
});
