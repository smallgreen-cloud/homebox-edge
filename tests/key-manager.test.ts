import { describe, expect, it, vi } from "vitest";

import { issueKey, listKeys, revokeKey } from "../src/key-manager";

interface KeyRow {
  id: string;
  user_id: string;
  kv_key: string;
  preview: string;
  created_at: number;
  expires_at: number;
}

function d1() {
  const rows = new Map<string, KeyRow>();
  const migrated = new Set<string>();
  const prepare = vi.fn((sql: string) => {
    let values: unknown[] = [];
    const api = {
      bind: vi.fn((...next: unknown[]) => {
        values = next;
        return api;
      }),
      first: vi.fn(async () => {
        if (sql.includes("mcp_key_registry_migrations")) {
          return migrated.has(String(values[0])) ? { migrated: 1 } : null;
        }
        if (sql.includes("SELECT kv_key")) {
          const row = rows.get(String(values[1]));
          return row && row.user_id === values[0] ? { kv_key: row.kv_key } : null;
        }
        return null;
      }),
      all: vi.fn(async () => ({
        results: [...rows.values()]
          .filter((row) => row.user_id === values[0] && row.expires_at > Number(values[1]))
          .map(({ id, preview, created_at, expires_at }) => ({
            id,
            preview,
            created_at,
            expires_at,
          })),
      })),
      run: vi.fn(async () => {
        if (sql.includes("INSERT") && sql.includes("mcp_keys")) {
          const [id, userId, kvKey, preview, createdAt, expiresAt] = values;
          const liveCount = [...rows.values()].filter(
            (row) => row.user_id === userId && row.expires_at > Number(values[7] ?? 0),
          ).length;
          const maximum = Number(values[8] ?? Number.POSITIVE_INFINITY);
          if (liveCount >= maximum || rows.has(String(id))) return { meta: { changes: 0 } };
          rows.set(String(id), {
            id: String(id),
            user_id: String(userId),
            kv_key: String(kvKey),
            preview: String(preview),
            created_at: Number(createdAt),
            expires_at: Number(expiresAt),
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes("INSERT") && sql.includes("mcp_key_registry_migrations")) {
          migrated.add(String(values[0]));
          return { meta: { changes: 1 } };
        }
        if (sql.includes("DELETE FROM mcp_keys")) {
          const row = rows.get(String(values[1]));
          const changed = row?.user_id === values[0] && rows.delete(String(values[1]));
          return { meta: { changes: Number(changed) } };
        }
        return { meta: { changes: 0 } };
      }),
    };
    return api;
  });
  const db = {
    prepare,
    batch: vi.fn(async (statements: Array<{ run(): Promise<unknown> }>) =>
      Promise.all(statements.map((statement) => statement.run())),
    ),
  };
  return { db: db as unknown as D1Database, rows, migrated };
}

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
    const registry = d1();
    const created = await issueKey(registry.db, target.namespace, {
      uid: "owner",
      email: "owner",
    });
    expect(created.key).toMatch(/^hi_/);
    const storedRegistryKey = [...registry.rows.values()][0]?.kv_key;
    const storedKvKey = [...target.values.keys()][0];
    expect(storedRegistryKey).toMatch(/^inventory:key-sha256:[a-f0-9]{64}$/);
    expect(storedKvKey).toBe(storedRegistryKey);
    expect(storedRegistryKey).not.toContain(created.key);
    expect(target.values.get(storedKvKey!)).toContain('"uid":"owner"');
    expect(await listKeys(registry.db, target.namespace, "owner")).toEqual([
      expect.objectContaining({ id: created.id, preview: expect.not.stringContaining(created.key) }),
    ]);
  });

  it("revokes only keys owned by the authenticated owner", async () => {
    const target = kv();
    const registry = d1();
    const created = await issueKey(registry.db, target.namespace, {
      uid: "owner",
      email: "owner",
    });
    const storageKey = [...target.values.keys()][0]!;
    await expect(revokeKey(registry.db, target.namespace, "other", created.id)).resolves.toBe(
      false,
    );
    await expect(revokeKey(registry.db, target.namespace, "owner", created.id)).resolves.toBe(
      true,
    );
    expect(storageKey).not.toContain(created.key);
    expect(target.values.has(storageKey)).toBe(false);
  });

  it("migrates a live legacy KV index once so deployed connector keys survive", async () => {
    const target = kv();
    const registry = d1();
    const legacy = {
      id: "4a918e3a-cf0d-4f98-9fed-aa2e531616c4",
      key: "hi_legacy",
      preview: "hi_lega…gacy",
      created_at: 100,
      expires_at: 10_000,
    };
    target.values.set("inventory:user-keys:owner", JSON.stringify([legacy]));
    target.values.set(
      "inventory:key:hi_legacy",
      JSON.stringify({ uid: "owner", email: "owner", expires_at: 10_000 }),
    );

    await expect(listKeys(registry.db, target.namespace, "owner", 1_000)).resolves.toEqual([
      expect.objectContaining({ id: legacy.id }),
    ]);
    expect(registry.migrated.has("owner")).toBe(true);
    expect([...registry.rows.values()][0]?.kv_key).toMatch(
      /^inventory:key-sha256:[a-f0-9]{64}$/,
    );
    expect(target.values.has("inventory:key:hi_legacy")).toBe(false);
  });

  it("does not resurrect a revoked record when the old KV index is stale", async () => {
    const target = kv();
    const registry = d1();
    const first = await issueKey(registry.db, target.namespace, {
      uid: "owner",
      email: "owner",
    });
    target.values.set("inventory:user-keys:owner", JSON.stringify([first]));

    await revokeKey(registry.db, target.namespace, "owner", first.id);
    const second = await issueKey(registry.db, target.namespace, {
      uid: "owner",
      email: "owner",
    });

    await expect(listKeys(registry.db, target.namespace, "owner")).resolves.toEqual([
      expect.objectContaining({ id: second.id }),
    ]);
  });
});
