import { Hono } from "hono";
import { z } from "zod";

import { authenticateWeb } from "./auth";
import { parseHomeboxCsv, renderHomeboxCsv } from "./compat/homebox-csv";
import { HomeAssetPatchSchema, HomeAssetSchema } from "./core/asset";
import { issueKey, listKeys, revokeKey } from "./key-manager";
import { handleMcp } from "./mcp/handler";
import {
  archiveAsset,
  getAsset,
  insertAsset,
  listAssets,
  searchAssets,
  updateAsset,
  upsertImportedAssets,
} from "./storage/assets";

type RuntimeEnv = Env & { ADMIN_TOKEN?: string };
type Variables = { ownerId: string };

const app = new Hono<{ Bindings: RuntimeEnv; Variables: Variables }>();

const CsvPayloadSchema = z
  .object({ csv_text: z.string().min(1).max(5 * 1024 * 1024) })
  .strict();
const CsvImportPayloadSchema = z
  .object({
    csv_text: z.string().min(1).max(5 * 1024 * 1024),
    confirmed: z.boolean(),
  })
  .strict();

async function requireOwner(
  request: Request,
  adminToken: string | undefined,
): Promise<{ uid: string; email: string } | null> {
  return authenticateWeb(request, adminToken);
}

app.onError((error, context) => {
  console.error(
    JSON.stringify({
      message: "request failed",
      path: new URL(context.req.url).pathname,
      error: error.message,
    }),
  );
  return context.json({ error: "Internal server error" }, 500);
});

app.get("/healthz", (context) =>
  context.json({ ok: true, service: "homebox-edge", version: "0.1.0" }),
);

app.post("/mcp", (context) => handleMcp(context.req.raw, context.env));

app.use("/api/*", async (context, next) => {
  const owner = await requireOwner(context.req.raw, context.env.ADMIN_TOKEN);
  if (!owner) return context.json({ error: "Unauthorized" }, 401);
  context.set("ownerId", owner.uid);
  await next();
});

app.get("/api/me", (context) =>
  context.json({ authenticated: true, owner: context.get("ownerId") }),
);

app.get("/api/keys", async (context) =>
  context.json({ keys: await listKeys(context.env.MCP_KEYS, context.get("ownerId")) }),
);

app.post("/api/keys", async (context) => {
  try {
    const record = await issueKey(context.env.MCP_KEYS, {
      uid: context.get("ownerId"),
      email: "owner",
    });
    const origin = new URL(context.req.url).origin;
    return context.json({
      id: record.id,
      key: record.key,
      expires_at: record.expires_at,
      connector_url: `${origin}/mcp?key=${record.key}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "建立 MCP key 失敗";
    return context.json({ error: message }, 400);
  }
});

app.delete("/api/keys/:id", async (context) => {
  const revoked = await revokeKey(
    context.env.MCP_KEYS,
    context.get("ownerId"),
    context.req.param("id"),
  );
  return revoked
    ? context.json({ revoked: true })
    : context.json({ error: "Key not found" }, 404);
});

app.get("/api/assets", async (context) => {
  const query = context.req.query("q")?.trim() ?? "";
  const includeArchived = context.req.query("include_archived") === "true";
  const assets = query
    ? await searchAssets(
        context.env.DB,
        context.get("ownerId"),
        query,
        includeArchived,
      )
    : await listAssets(context.env.DB, context.get("ownerId"), includeArchived);
  return context.json({ assets });
});

app.post("/api/assets", async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Request body must be JSON" }, 400);
  }
  const object = typeof body === "object" && body !== null ? body : {};
  const parsed = HomeAssetSchema.safeParse({ quantity: 1, ...object });
  if (!parsed.success) return context.json({ error: "Invalid asset" }, 400);
  const now = new Date().toISOString();
  const asset = {
    ...parsed.data,
    id: `asset_${crypto.randomUUID()}`,
    created_at: now,
    updated_at: now,
  };
  await insertAsset(context.env.DB, context.get("ownerId"), asset);
  return context.json({ asset }, 201);
});

app.get("/api/assets/:id", async (context) => {
  const asset = await getAsset(
    context.env.DB,
    context.get("ownerId"),
    context.req.param("id"),
  );
  return asset
    ? context.json({ asset })
    : context.json({ error: "Asset not found" }, 404);
});

app.patch("/api/assets/:id", async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Request body must be JSON" }, 400);
  }
  const parsed = HomeAssetPatchSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: "Invalid asset patch" }, 400);
  const changed = await updateAsset(
    context.env.DB,
    context.get("ownerId"),
    context.req.param("id"),
    parsed.data,
    new Date().toISOString(),
  );
  return changed
    ? context.json({ updated: true })
    : context.json({ error: "Asset not found or patch is empty" }, 404);
});

app.post("/api/assets/:id/archive", async (context) => {
  const archived = await archiveAsset(
    context.env.DB,
    context.get("ownerId"),
    context.req.param("id"),
    new Date().toISOString(),
  );
  return archived
    ? context.json({ archived: true })
    : context.json({ error: "Asset not found or already archived" }, 404);
});

app.post("/api/homebox/preview", async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Request body must be JSON" }, 400);
  }
  const parsed = CsvPayloadSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: "Invalid CSV payload" }, 400);
  try {
    const assets = parseHomeboxCsv(parsed.data.csv_text);
    return context.json({
      count: assets.length,
      sample: assets.slice(0, 10),
      requires_confirmation: true,
      compatibility: "HomeBox v0.26.2 item CSV",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV parse failed";
    return context.json({ error: message }, 400);
  }
});

app.post("/api/homebox/import", async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return context.json({ error: "Request body must be JSON" }, 400);
  }
  const base = CsvImportPayloadSchema.safeParse(body);
  if (!base.success) return context.json({ error: "Invalid CSV payload" }, 400);
  if (base.data.confirmed !== true) {
    return context.json({ error: "Import requires confirmed: true" }, 409);
  }
  try {
    const assets = parseHomeboxCsv(base.data.csv_text);
    const result = await upsertImportedAssets(
      context.env.DB,
      context.get("ownerId"),
      assets,
      new Date().toISOString(),
    );
    return context.json({ imported: assets.length, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV import failed";
    return context.json({ error: message }, 400);
  }
});

app.get("/api/homebox/export", async (context) => {
  const assets = await listAssets(context.env.DB, context.get("ownerId"), true);
  const csv = renderHomeboxCsv(assets);
  const timestamp = new Date().toISOString().slice(0, 10);
  return context.body(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="homebox-edge-${timestamp}.csv"`,
    "Cache-Control": "private, no-store",
  });
});

app.all("*", async (context) => {
  const requestUrl = new URL(context.req.url);
  const isAppRoute =
    requestUrl.pathname === "/" ||
    requestUrl.pathname === "/app" ||
    requestUrl.pathname === "/assets" ||
    /^\/a\/[^/]+\/?$/.test(requestUrl.pathname);
  if (isAppRoute) {
    requestUrl.pathname = "/";
    requestUrl.searchParams.set("asset-version", "homebox-edge-v1");
  }
  const response = await context.env.ASSETS.fetch(
    new Request(requestUrl, context.req.raw),
  );
  if (isAppRoute && response.ok) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  }
  return response.status === 404
    ? context.json({ error: "Not found" }, 404)
    : response;
});

export default app;
