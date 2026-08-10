import { describe, expect, it } from "vitest";

import {
  authenticateMcp,
  authenticateWeb,
  extractMcpToken,
  parseTokenRecord,
} from "../src/auth";

function database(options: { registered?: boolean; migrated?: boolean }) {
  return {
    prepare: (sql: string) => {
      const api = {
        bind: () => api,
        first: async () =>
          sql.includes("FROM mcp_keys") && options.registered
            ? { uid: "owner", expires_at: 1_000 }
            : sql.includes("mcp_key_registry_migrations") && options.migrated
              ? { migrated: 1 }
              : null,
      };
      return api;
    },
  } as unknown as D1Database;
}

function tokens(raw: string | null) {
  return { get: async () => raw } as unknown as KVNamespace;
}

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

  it("uses the D1 registry as authorization authority after legacy migration", async () => {
    const request = new Request("https://inventory.example/mcp?token=hi_registered");
    await expect(
      authenticateMcp(request, database({ registered: true }), tokens(null), 100),
    ).resolves.toMatchObject({ uid: "owner" });

    const staleLegacy = JSON.stringify({ uid: "owner", expires_at: 1_000 });
    await expect(
      authenticateMcp(
        request,
        database({ registered: false, migrated: true }),
        tokens(staleLegacy),
        100,
      ),
    ).resolves.toBeNull();
  });

  it("rotates an already-registered legacy credential to hashed storage on use", async () => {
    const token = "hi_existing_legacy";
    const legacyKey = `inventory:key:${token}`;
    let registryKey = legacyKey;
    const values = new Map([
      [legacyKey, JSON.stringify({ uid: "owner", expires_at: 1_000 })],
    ]);
    const db = {
      prepare: (sql: string) => {
        let bound: unknown[] = [];
        const statement = {
          bind: (...next: unknown[]) => {
            bound = next;
            return statement;
          },
          first: async () =>
            sql.includes("FROM mcp_keys") && bound[0] === registryKey
              ? { uid: "owner", expires_at: 1_000 }
              : null,
          run: async () => {
            if (sql.includes("UPDATE mcp_keys") && bound[1] === registryKey) {
              registryKey = String(bound[0]);
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          },
        };
        return statement;
      },
    } as unknown as D1Database;
    const namespace = {
      get: async (key: string) => values.get(key) ?? null,
      put: async (key: string, raw: string) => {
        values.set(key, raw);
      },
      delete: async (key: string) => {
        values.delete(key);
      },
    } as unknown as KVNamespace;

    await expect(
      authenticateMcp(
        new Request(`https://inventory.example/mcp?token=${token}`),
        db,
        namespace,
        100,
      ),
    ).resolves.toMatchObject({ uid: "owner" });
    expect(registryKey).toMatch(/^inventory:key-sha256:[a-f0-9]{64}$/);
    expect(registryKey).not.toContain(token);
    expect(values.has(legacyKey)).toBe(false);
    expect(values.has(registryKey)).toBe(true);
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
