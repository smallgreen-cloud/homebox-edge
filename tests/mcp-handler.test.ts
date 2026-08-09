import { describe, expect, it, vi } from "vitest";

const tools = vi.hoisted(() => ({
  callTool: vi.fn(),
  TOOL_DEFINITIONS: [{ name: "search_assets", inputSchema: {} }],
}));
vi.mock("../src/mcp/tools", () => tools);

import { handleMcp } from "../src/mcp/handler";

function environment(authenticated = true) {
  return {
    DB: {} as D1Database,
    PUBLIC_BASE_URL: "https://inventory.example",
    MCP_KEYS: {
      get: vi.fn().mockResolvedValue(
        authenticated
          ? JSON.stringify({ uid: "owner", expires_at: Math.floor(Date.now() / 1000) + 3600 })
          : null,
      ),
    } as unknown as KVNamespace,
  };
}

function request(method: string, params?: unknown) {
  return new Request("https://inventory.example/mcp", {
    method: "POST",
    headers: { Authorization: "Bearer hi_test", "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

describe("Remote MCP handler", () => {
  it("authenticates, initializes and dispatches tools", async () => {
    expect((await handleMcp(request("tools/list"), environment(false))).status).toBe(401);
    const initialized = await handleMcp(request("initialize"), environment());
    expect(await initialized.json()).toMatchObject({
      result: { serverInfo: { name: "homebox-edge" } },
    });
    tools.callTool.mockResolvedValue([{ id: "asset_1" }]);
    await handleMcp(
      request("tools/call", { name: "search_assets", arguments: { query: "Laptop" } }),
      environment(),
    );
    expect(tools.callTool).toHaveBeenCalledWith(
      expect.anything(),
      "owner",
      "search_assets",
      { query: "Laptop" },
    );
  });

  it("returns JSON-RPC errors without leaking exceptions", async () => {
    const unknown = await handleMcp(request("unknown"), environment());
    expect(await unknown.json()).toMatchObject({ error: { code: -32601 } });
    const invalid = await handleMcp(
      new Request("https://inventory.example/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer hi_test" },
        body: "not json",
      }),
      environment(),
    );
    expect(await invalid.json()).toMatchObject({ error: { code: -32700 } });

    const invalidRequest = await handleMcp(
      new Request("https://inventory.example/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer hi_test", "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "1.0", id: {}, method: 123 }),
      }),
      environment(),
    );
    expect(await invalidRequest.json()).toMatchObject({ error: { code: -32600 } });
  });
});
