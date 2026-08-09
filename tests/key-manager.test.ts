import { describe, expect, it, vi } from "vitest";

import { issueKey, listKeys, revokeKey } from "../src/key-manager";

function kv() {
  const values = new Map<string, string>();
  return {
    values,
    namespace: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    } as unknown as KVNamespace,
  };
}

describe("MCP key lifecycle", () => {
  it("issues a revocable owner-bound hi_ key and lists only its preview", async () => {
    const target = kv();
    const created = await issueKey(target.namespace, { uid: "owner", email: "owner" });
    expect(created.key).toMatch(/^hi_/);
    expect(target.values.get(`inventory:key:${created.key}`)).toContain('"uid":"owner"');
    expect(await listKeys(target.namespace, "owner")).toEqual([
      expect.objectContaining({ id: created.id, preview: expect.not.stringContaining(created.key) }),
    ]);
  });

  it("revokes only keys owned by the authenticated owner", async () => {
    const target = kv();
    const created = await issueKey(target.namespace, { uid: "owner", email: "owner" });
    await expect(revokeKey(target.namespace, "other", created.id)).resolves.toBe(false);
    await expect(revokeKey(target.namespace, "owner", created.id)).resolves.toBe(true);
    expect(target.values.has(`inventory:key:${created.key}`)).toBe(false);
  });
});
