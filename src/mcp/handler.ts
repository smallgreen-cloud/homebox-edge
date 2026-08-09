import { z } from "zod";

import { authenticateMcp } from "../auth";
import { callTool, TOOL_DEFINITIONS } from "./tools";

type McpEnv = {
  DB: Env["DB"];
  MCP_KEYS: Env["MCP_KEYS"];
  PUBLIC_BASE_URL: string;
};

const JsonRpcRequestSchema = z
  .object({
    jsonrpc: z.literal("2.0"),
    id: z.union([z.string(), z.number(), z.null()]).optional(),
    method: z.string().min(1),
    params: z.unknown().optional(),
  })
  .strict();

const ToolCallParamsSchema = z
  .object({
    name: z.string().min(1),
    arguments: z.unknown().optional(),
    _meta: z.unknown().optional(),
  })
  .passthrough();

function jsonRpc(
  id: string | number | null | undefined,
  result?: unknown,
  error?: { code: number; message: string },
): Response {
  return Response.json({
    jsonrpc: "2.0",
    id: id ?? null,
    ...(error ? { error } : { result }),
  });
}

export async function handleMcp(request: Request, env: McpEnv): Promise<Response> {
  const identity = await authenticateMcp(request, env.MCP_KEYS);
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return jsonRpc(undefined, undefined, { code: -32700, message: "Parse error" });
  }
  const parsed = JsonRpcRequestSchema.safeParse(value);
  if (!parsed.success) {
    return jsonRpc(undefined, undefined, { code: -32600, message: "Invalid Request" });
  }
  const rpc = parsed.data;

  if (rpc.method === "initialize") {
    return jsonRpc(rpc.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "homebox-edge", version: "0.1.0" },
    });
  }
  if (rpc.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (rpc.method === "tools/list") return jsonRpc(rpc.id, { tools: TOOL_DEFINITIONS });
  if (rpc.method === "tools/call") {
    const params = ToolCallParamsSchema.safeParse(rpc.params);
    if (!params.success) {
      return jsonRpc(rpc.id, undefined, { code: -32602, message: "Tool name is required" });
    }
    try {
      const value = await callTool(
        env,
        identity.uid,
        params.data.name,
        params.data.arguments ?? {},
      );
      return jsonRpc(rpc.id, {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool error";
      return jsonRpc(rpc.id, {
        isError: true,
        content: [{ type: "text", text: message }],
      });
    }
  }
  return jsonRpc(rpc.id, undefined, { code: -32601, message: "Method not found" });
}
