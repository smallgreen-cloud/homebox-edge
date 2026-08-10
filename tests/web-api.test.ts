import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ authenticateWeb: vi.fn() }));
const storage = vi.hoisted(() => ({
  insertAsset: vi.fn(),
  upsertImportedAssets: vi.fn(),
  getAsset: vi.fn(),
  listAssets: vi.fn(),
  searchAssets: vi.fn(),
  updateAsset: vi.fn(),
  archiveAsset: vi.fn(),
}));
const keys = vi.hoisted(() => ({
  issueKey: vi.fn(),
  listKeys: vi.fn(),
  revokeKey: vi.fn(),
}));
vi.mock("../src/auth", () => auth);
vi.mock("../src/storage/assets", () => storage);
vi.mock("../src/key-manager", () => keys);

import app from "../src/index";

const asset = {
  id: "asset_1",
  import_ref: "ref-1",
  location: ["Home", "Office"],
  tags: ["Electronics"],
  archived: false,
  name: "Laptop",
  quantity: 1,
  insured: true,
  purchase_price: 32000,
  lifetime_warranty: false,
  sold_price: 0,
  custom_fields: {},
  created_at: "2026-08-08T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
};

const env = {
  DB: {} as D1Database,
  MCP_KEYS: {} as KVNamespace,
  ASSET_FILES: {} as R2Bucket,
  ADMIN_TOKEN: "test-admin-token",
  PUBLIC_BASE_URL: "https://inventory.example",
  ASSETS: {
    fetch: vi.fn().mockResolvedValue(new Response("<html>inventory</html>")),
  } as unknown as Fetcher,
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.authenticateWeb.mockResolvedValue({ uid: "owner", email: "owner" });
  storage.listAssets.mockResolvedValue([asset]);
  storage.searchAssets.mockResolvedValue([asset]);
  storage.getAsset.mockResolvedValue(asset);
  storage.updateAsset.mockResolvedValue(true);
  storage.archiveAsset.mockResolvedValue(true);
  storage.upsertImportedAssets.mockResolvedValue({ created: 1, updated: 0 });
  keys.listKeys.mockResolvedValue([]);
  keys.issueKey.mockResolvedValue({ id: "key_1", key: "hi_secret", expires_at: 123 });
  keys.revokeKey.mockResolvedValue(true);
});

describe("web and HomeBox interchange API", () => {
  it("rejects unsupported MCP GET transport with the protocol-required method hint", async () => {
    const response = await app.request("/mcp", {}, env);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("lists, searches, creates and reads owner-scoped assets", async () => {
    expect(await (await app.request("/api/assets", {}, env)).json()).toMatchObject({
      assets: [{ id: "asset_1" }],
    });
    await app.request("/api/assets?q=Laptop", {}, env);
    expect(storage.searchAssets).toHaveBeenCalledWith(env.DB, "owner", "Laptop", false);

    const created = await app.request(
      "/api/assets",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Camera", location: ["Home"] }),
      },
      env,
    );
    expect(created.status).toBe(201);
    expect(storage.insertAsset).toHaveBeenCalledOnce();
    expect((await app.request("/api/assets/asset_1", {}, env)).status).toBe(200);
  });

  it("lists and searches archived assets only when explicitly requested", async () => {
    await app.request("/api/assets?include_archived=true", {}, env);
    expect(storage.listAssets).toHaveBeenCalledWith(env.DB, "owner", true);

    await app.request("/api/assets?q=Laptop&include_archived=true", {}, env);
    expect(storage.searchAssets).toHaveBeenCalledWith(env.DB, "owner", "Laptop", true);
  });

  it("updates and archives without permanent deletion", async () => {
    const updated = await app.request(
      "/api/assets/asset_1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Desk machine" }),
      },
      env,
    );
    expect(updated.status).toBe(200);
    expect(
      (await app.request("/api/assets/asset_1/archive", { method: "POST" }, env)).status,
    ).toBe(200);
    expect(storage.archiveAsset).toHaveBeenCalledOnce();
  });

  it("previews without writing, requires confirmation, imports and exports CSV", async () => {
    const csv = "HB.import_ref,HB.location,HB.name\nref-2,Home,Camera";
    const preview = await app.request(
      "/api/homebox/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csv }),
      },
      env,
    );
    expect(await preview.json()).toMatchObject({ count: 1, requires_confirmation: true });
    expect(storage.upsertImportedAssets).not.toHaveBeenCalled();

    const unconfirmed = await app.request(
      "/api/homebox/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csv, confirmed: false }),
      },
      env,
    );
    expect(unconfirmed.status).toBe(409);

    const imported = await app.request(
      "/api/homebox/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csv, confirmed: true }),
      },
      env,
    );
    expect(await imported.json()).toMatchObject({ imported: 1, created: 1 });

    const exported = await app.request("/api/homebox/export", {}, env);
    expect(exported.headers.get("Content-Type")).toContain("text/csv");
    expect(await exported.text()).toContain("HB.parent_import_ref");
    expect(storage.listAssets).toHaveBeenLastCalledWith(env.DB, "owner", true);
  });

  it("returns 413 before oversized CSV content reaches storage", async () => {
    const oversizedCsv = `HB.location,HB.name\nHome,${"x".repeat(5 * 1024 * 1024)}`;
    const response = await app.request(
      "/api/homebox/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: oversizedCsv, confirmed: true }),
      },
      env,
    );

    expect(response.status).toBe(413);
    expect(storage.upsertImportedAssets).not.toHaveBeenCalled();
  });

  it("issues, lists and revokes MCP keys", async () => {
    expect((await app.request("/api/keys", {}, env)).status).toBe(200);
    expect(keys.listKeys).toHaveBeenCalledWith(env.DB, env.MCP_KEYS, "owner");
    const created = await app.request(
      "https://inventory.example/api/keys",
      { method: "POST" },
      env,
    );
    expect(await created.json()).toMatchObject({
      connector_url: "https://inventory.example/mcp?token=hi_secret",
    });
    expect(keys.issueKey).toHaveBeenCalledWith(env.DB, env.MCP_KEYS, {
      uid: "owner",
      email: "owner",
    });
    expect((await app.request("/api/keys/key_1", { method: "DELETE" }, env)).status).toBe(200);
    expect(keys.revokeKey).toHaveBeenCalledWith(env.DB, env.MCP_KEYS, "owner", "key_1");
  });

  it("fails closed and returns safe validation/not-found errors", async () => {
    auth.authenticateWeb.mockResolvedValue(null);
    expect((await app.request("/api/assets", {}, env)).status).toBe(401);
    auth.authenticateWeb.mockResolvedValue({ uid: "owner" });
    storage.getAsset.mockResolvedValue(null);
    expect((await app.request("/api/assets/missing", {}, env)).status).toBe(404);
    const invalid = await app.request(
      "/api/assets",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      env,
    );
    expect(invalid.status).toBe(400);
  });

  it("does not return infrastructure errors to authenticated callers", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    keys.issueKey.mockRejectedValueOnce(new Error("D1 SQL and credential details"));

    const response = await app.request("/api/keys", { method: "POST" }, env);
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("Internal server error");
    expect(body).not.toContain("D1 SQL");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("serves SPA routes without edge caching", async () => {
    const response = await app.request("/assets", {}, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    const request = vi.mocked(env.ASSETS.fetch).mock.calls[0]![0] as Request;
    const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
    const indexVersion = createHash("sha256").update(html).digest("hex").slice(0, 12);
    expect(request.url).toContain(`asset-version=sha256-${indexVersion}`);
  });
});
