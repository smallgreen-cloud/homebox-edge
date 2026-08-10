import { readFileSync } from "node:fs";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestHarness, type TestHarness } from "wrangler";

import { parseHomeboxCsv } from "../src/compat/homebox-csv";

const ADMIN_TOKEN = "integration-admin-token-Synthetic-for-testing-only";

const server: TestHarness = createTestHarness({
  workers: [
    {
      configPath: "./wrangler.jsonc",
      secrets: { ADMIN_TOKEN },
      vars: { PUBLIC_BASE_URL: "http://inventory.test" },
    },
  ],
});

const authorization = { Authorization: `Bearer ${ADMIN_TOKEN}` };
const householdCsv = readFileSync(
  new URL("../examples/homebox-v0.26.2-household-assets.csv", import.meta.url),
  "utf8",
);
const householdExpected = JSON.parse(
  readFileSync(
    new URL("../examples/homebox-v0.26.2-household-assets.expected.json", import.meta.url),
    "utf8",
  ),
) as {
  asset_count: number;
  active_count: number;
  first_import_into_empty_owner: { imported: number; created: number; updated: number };
  idempotent_replay: { imported: number; created: number; updated: number };
};

beforeAll(async () => {
  await server.listen();
});

beforeEach(async () => {
  await server.getWorker("homebox-edge").applyD1Migrations("DB");
});

afterEach(async () => {
  await server.reset();
});

afterAll(async () => {
  await server.close();
});

async function createAsset(
  body: Record<string, unknown>,
): Promise<Awaited<ReturnType<TestHarness["fetch"]>>> {
  return server.fetch("/api/assets", {
    method: "POST",
    headers: { ...authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("production-build Worker integration", () => {
  it("imports the public household example idempotently through real D1", async () => {
    const preview = await server.fetch("/api/homebox/preview", {
      method: "POST",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ csv_text: householdCsv }),
    });
    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      count: householdExpected.asset_count,
      requires_confirmation: true,
    });

    const worker = server.getWorker<Env>("homebox-edge");
    const env = await worker.getEnv();
    await expect(
      env.DB.prepare("SELECT COUNT(*) AS count FROM assets").first<{ count: number }>(),
    ).resolves.toMatchObject({ count: 0 });

    const importExample = () =>
      server.fetch("/api/homebox/import", {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: householdCsv, confirmed: true }),
      });
    const firstImport = await importExample();
    expect(firstImport.status).toBe(200);
    await expect(firstImport.json()).resolves.toMatchObject(
      householdExpected.first_import_into_empty_owner,
    );

    const replay = await importExample();
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject(householdExpected.idempotent_replay);

    const active = await server.fetch("/api/assets", { headers: authorization });
    const activeBody = (await active.json()) as { assets: unknown[] };
    expect(activeBody.assets).toHaveLength(householdExpected.active_count);

    const all = await server.fetch("/api/assets?include_archived=true", {
      headers: authorization,
    });
    const allBody = (await all.json()) as { assets: unknown[] };
    expect(allBody.assets).toHaveLength(householdExpected.asset_count);

    const archivedSearch = await server.fetch(
      `/api/assets?q=${encodeURIComponent("已汰換")}&include_archived=true`,
      { headers: authorization },
    );
    await expect(archivedSearch.json()).resolves.toMatchObject({
      assets: [{ import_ref: "demo-retired-tablet", archived: true }],
    });

    const exported = await server.fetch("/api/homebox/export", { headers: authorization });
    expect(exported.status).toBe(200);
    const byImportRef = (csv: string) =>
      parseHomeboxCsv(csv).sort((left, right) =>
        (left.import_ref ?? "").localeCompare(right.import_ref ?? ""),
      );
    expect(byImportRef(await exported.text())).toEqual(byImportRef(householdCsv));
  });

  it("runs the real asset lifecycle and HomeBox CSV round trip", async () => {
    const created = await createAsset({
      name: "Integration coffee grinder",
      import_ref: "integration-grinder",
      location: ["Home", "Kitchen"],
      tags: ["Coffee"],
      quantity: 1,
    });
    expect(created.status).toBe(201);
    const createdAsset = (await created.json()) as { asset: { id: string } };

    const updated = await server.fetch(`/api/assets/${createdAsset.asset.id}`, {
      method: "PATCH",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Integration lifecycle verified" }),
    });
    expect(updated.status).toBe(200);

    const searched = await server.fetch("/api/assets?q=grinder", {
      headers: authorization,
    });
    await expect(searched.json()).resolves.toMatchObject({
      assets: [{ id: createdAsset.asset.id, notes: "Integration lifecycle verified" }],
    });

    const archived = await server.fetch(`/api/assets/${createdAsset.asset.id}/archive`, {
      method: "POST",
      headers: authorization,
    });
    expect(archived.status).toBe(200);

    const hidden = await server.fetch("/api/assets?q=grinder", { headers: authorization });
    await expect(hidden.json()).resolves.toMatchObject({ assets: [] });

    const restored = await server.fetch(`/api/assets/${createdAsset.asset.id}`, {
      method: "PATCH",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    expect(restored.status).toBe(200);

    const exported = await server.fetch("/api/homebox/export", { headers: authorization });
    expect(exported.status).toBe(200);
    expect(exported.headers.get("Content-Type")).toContain("text/csv");
    expect(await exported.text()).toContain("Integration coffee grinder");
  });

  it("runs migrations and enforces relation invariants in application and D1", async () => {
    const missingParent = await createAsset({
      name: "Orphan",
      import_ref: "orphan",
      parent_import_ref: "missing",
    });
    expect(missingParent.status).toBe(400);

    expect(await createAsset({ name: "Parent", import_ref: "parent" })).toMatchObject({
      status: 201,
    });
    expect(
      await createAsset({
        name: "Child",
        import_ref: "child",
        parent_import_ref: "parent",
      }),
    ).toMatchObject({ status: 201 });

    const worker = server.getWorker<Env>("homebox-edge");
    const env = await worker.getEnv();
    await expect(
      env.DB.prepare(
        "UPDATE assets SET parent_import_ref = 'child' WHERE user_id = 'owner' AND import_ref = 'parent'",
      ).run(),
    ).rejects.toThrow(/cyclic parent refs/i);

    const childFirstCsv = [
      "HB.import_ref,HB.parent_import_ref,HB.location,HB.name",
      "batch-child,batch-parent,Home,Batch child",
      "batch-parent,,Home,Batch parent",
    ].join("\n");
    const imported = await server.fetch("/api/homebox/import", {
      method: "POST",
      headers: { ...authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ csv_text: childFirstCsv, confirmed: true }),
    });
    expect(imported.status).toBe(200);
    await expect(imported.json()).resolves.toMatchObject({ created: 2, updated: 0 });
  });

  it("uses real D1 and KV bindings for a revocable MCP connection", async () => {
    const created = await server.fetch("/api/keys", {
      method: "POST",
      headers: authorization,
    });
    expect(created.status).toBe(200);
    const key = (await created.json()) as { id: string; key: string };

    const worker = server.getWorker<Env>("homebox-edge");
    const env = await worker.getEnv();
    const stored = await env.DB.prepare("SELECT kv_key FROM mcp_keys WHERE id = ?")
      .bind(key.id)
      .first<{ kv_key: string }>();
    expect(stored?.kv_key).toMatch(/^inventory:key-sha256:[a-f0-9]{64}$/);
    expect(stored?.kv_key).not.toContain(key.key);
    await expect(env.MCP_KEYS.get(`inventory:key:${key.key}`)).resolves.toBeNull();
    await expect(env.MCP_KEYS.get(stored!.kv_key)).resolves.not.toBeNull();

    const initialize = () =>
      server.fetch("/mcp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
      });
    expect((await initialize()).status).toBe(200);

    const revoked = await server.fetch(`/api/keys/${encodeURIComponent(key.id)}`, {
      method: "DELETE",
      headers: authorization,
    });
    expect(revoked.status).toBe(200);
    expect((await initialize()).status).toBe(401);
  });

  it("applies security headers and bounded request handling in the built Worker", async () => {
    const app = await server.fetch("/app");
    expect(app.status).toBe(200);
    expect(app.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(app.headers.get("Referrer-Policy")).toBe("no-referrer");

    const oversized = await server.fetch("/api/assets", {
      method: "POST",
      headers: {
        ...authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "x".repeat(65 * 1024) }),
    });
    expect(oversized.status).toBe(413);
  });
});
