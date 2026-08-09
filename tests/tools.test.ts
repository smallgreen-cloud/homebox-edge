import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  insertAsset: vi.fn(),
  upsertImportedAssets: vi.fn(),
  getAsset: vi.fn(),
  listAssets: vi.fn(),
  searchAssets: vi.fn(),
  updateAsset: vi.fn(),
  archiveAsset: vi.fn(),
}));
vi.mock("../src/storage/assets", () => storage);

import { callTool, TOOL_DEFINITIONS } from "../src/mcp/tools";

const env = { DB: {} as D1Database, PUBLIC_BASE_URL: "https://inventory.example" };
const asset = {
  id: "asset_1",
  import_ref: "ref-1",
  location: ["Home"],
  tags: ["Important"],
  archived: false,
  name: "Laptop",
  quantity: 1,
  insured: false,
  purchase_price: 0,
  lifetime_warranty: false,
  sold_price: 0,
  custom_fields: {},
  created_at: "2026-08-08T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  storage.getAsset.mockResolvedValue(asset);
  storage.listAssets.mockResolvedValue([asset]);
  storage.searchAssets.mockResolvedValue([asset]);
  storage.updateAsset.mockResolvedValue(true);
  storage.archiveAsset.mockResolvedValue(true);
  storage.upsertImportedAssets.mockResolvedValue({ created: 1, updated: 0 });
});

describe("household asset MCP tools", () => {
  it("advertises strict schemas for the full HomeBox-compatible asset surface", () => {
    const definitions = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));
    expect(definitions.get("create_asset")?.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: {
        manufacturer: { type: "string" },
        model_number: { type: "string" },
        serial_number: { type: "string" },
        custom_fields: { type: "object" },
      },
    });
    expect(definitions.get("update_asset")?.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: {
        patch: {
          type: "object",
          additionalProperties: false,
          properties: { warranty_details: { type: "string" } },
        },
      },
    });
  });

  it("creates, searches, reads, updates and soft-archives owner assets", async () => {
    const created = await callTool(env, "owner", "create_asset", {
      name: "Laptop",
      location: ["Home"],
    });
    expect(storage.insertAsset).toHaveBeenCalledWith(
      env.DB,
      "owner",
      expect.objectContaining({ id: expect.stringMatching(/^asset_/) }),
    );
    expect(created).toMatchObject({ name: "Laptop", detail_url: expect.stringContaining("/a/") });

    await callTool(env, "owner", "search_assets", { query: "Laptop" });
    expect(storage.searchAssets).toHaveBeenCalledWith(env.DB, "owner", "Laptop");
    await expect(callTool(env, "owner", "get_asset", { asset_id: "asset_1" })).resolves.toMatchObject({
      id: "asset_1",
    });
    await expect(
      callTool(env, "owner", "update_asset", { asset_id: "asset_1", patch: { notes: "Mine" } }),
    ).resolves.toEqual({ id: "asset_1", updated: true });
    await expect(callTool(env, "owner", "archive_asset", { asset_id: "asset_1" })).resolves.toEqual({
      id: "asset_1",
      archived: true,
    });
  });

  it("rejects a directly-created asset that points to its own import ref", async () => {
    await expect(
      callTool(env, "owner", "create_asset", {
        import_ref: "same-ref",
        parent_import_ref: "same-ref",
        name: "Loop",
      }),
    ).rejects.toThrow("own parent");
    expect(storage.insertAsset).not.toHaveBeenCalled();
  });

  it("previews CSV without writing and imports only after confirmation", async () => {
    const csv = "HB.import_ref,HB.location,HB.name\nref-1,Home,Laptop";
    await expect(callTool(env, "owner", "preview_homebox_csv", { csv_text: csv })).resolves.toMatchObject({
      count: 1,
      requires_confirmation: true,
    });
    expect(storage.upsertImportedAssets).not.toHaveBeenCalled();
    await expect(
      callTool(env, "owner", "import_homebox_csv", { csv_text: csv, confirmed: false }),
    ).rejects.toThrow("confirmed");
    await expect(
      callTool(env, "owner", "import_homebox_csv", { csv_text: csv, confirmed: true }),
    ).resolves.toMatchObject({ imported: 1 });
    expect(storage.upsertImportedAssets).toHaveBeenCalledOnce();
  });

  it("exports canonical HomeBox CSV and rejects unknown tools", async () => {
    const exported = await callTool(env, "owner", "export_homebox_csv", {});
    expect(exported).toMatchObject({ format: "homebox.csv", count: 1 });
    expect(exported).toHaveProperty(
      "content",
      expect.stringContaining("HB.parent_import_ref"),
    );
    await expect(callTool(env, "owner", "nope", {})).rejects.toThrow("unknown tool");
  });
});
