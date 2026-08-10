import { Hono } from "hono";
import { z } from "zod";

import { authenticateWeb } from "./auth";
import { parseHomeboxCsv, renderHomeboxCsv } from "./compat/homebox-csv";
import { HomeAssetPatchSchema, HomeAssetSchema } from "./core/asset";
import { PublicHttpError } from "./errors";
import {
  MAX_CSV_REQUEST_BYTES,
  MAX_STANDARD_JSON_BYTES,
  readJsonBody,
} from "./http/body";
import { issueKey, listKeys, revokeKey } from "./key-manager";
import { publicAttachment, uploadAssetPhoto } from "./media/asset-photos";
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
import {
  getAttachment,
  listAttachments,
  listPrimaryPhotoAttachments,
  setPrimaryPhoto,
  updateAttachmentTitle,
} from "./storage/attachments";

type RuntimeEnv = Env & {
  ADMIN_TOKEN?: string;
  TEMP_ADMIN_TOKEN?: string;
  TEMP_ADMIN_TOKEN_EXPIRES_AT?: string;
};
type Variables = { ownerId: string };

const app = new Hono<{ Bindings: RuntimeEnv; Variables: Variables }>();

const CsvPayloadSchema = z
  .object({ csv_text: z.string().min(1) })
  .strict();
const CsvImportPayloadSchema = z
  .object({
    csv_text: z.string().min(1),
    confirmed: z.boolean(),
  })
  .strict();
const AttachmentPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    primary: z.literal(true).optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.primary === true);

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;

async function requireOwner(
  request: Request,
  env: RuntimeEnv,
): Promise<{ uid: string; email: string } | null> {
  return authenticateWeb(request, {
    adminToken: env.ADMIN_TOKEN,
    temporaryAdminToken: env.TEMP_ADMIN_TOKEN,
    temporaryAdminTokenExpiresAt: env.TEMP_ADMIN_TOKEN_EXPIRES_AT,
  });
}

app.use("*", async (context, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    context.header(name, value);
  }
  const pathname = new URL(context.req.url).pathname;
  if (pathname.startsWith("/api/") || pathname === "/mcp") {
    context.header("Cache-Control", "private, no-store");
  }
});

app.onError((error, context) => {
  if (error instanceof PublicHttpError) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status,
      headers: { "Content-Type": "application/json; charset=UTF-8" },
    });
  }
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
  context.json({ ok: true, service: "homebox-edge", version: "0.2.0" }),
);

app.post("/mcp", (context) => handleMcp(context.req.raw, context.env));
app.get("/mcp", (context) => context.body(null, 405, { Allow: "POST" }));

app.use("/api/*", async (context, next) => {
  const owner = await requireOwner(context.req.raw, context.env);
  if (!owner) return context.json({ error: "Unauthorized" }, 401);
  context.set("ownerId", owner.uid);
  await next();
});

app.get("/api/me", (context) =>
  context.json({ authenticated: true, owner: context.get("ownerId") }),
);

app.get("/api/keys", async (context) =>
  context.json({
    keys: await listKeys(context.env.DB, context.env.MCP_KEYS, context.get("ownerId")),
  }),
);

app.post("/api/keys", async (context) => {
  const record = await issueKey(
    context.env.DB,
    context.env.MCP_KEYS,
    {
      uid: context.get("ownerId"),
      email: "owner",
    },
  );
  const origin = new URL(context.req.url).origin;
  return context.json({
    id: record.id,
    key: record.key,
    expires_at: record.expires_at,
    connector_url: `${origin}/mcp?token=${record.key}`,
  });
});

app.delete("/api/keys/:id", async (context) => {
  const revoked = await revokeKey(
    context.env.DB,
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
  const origin = new URL(context.req.url).origin;
  const primaryPhotos = await listPrimaryPhotoAttachments(
    context.env.DB,
    context.get("ownerId"),
  );
  const primaryByAsset = new Map(
    primaryPhotos.map((attachment) => [
      attachment.asset_id,
      publicAttachment(origin, attachment),
    ]),
  );
  return context.json({
    assets: assets.map((asset) => ({
      ...asset,
      ...(primaryByAsset.has(asset.id)
        ? { primary_photo: primaryByAsset.get(asset.id) }
        : {}),
    })),
  });
});

app.post("/api/assets", async (context) => {
  const body = await readJsonBody(context.req.raw, MAX_STANDARD_JSON_BYTES);
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
  if (!asset) return context.json({ error: "Asset not found" }, 404);
  const attachments = await listAttachments(
    context.env.DB,
    context.get("ownerId"),
    asset.id,
  );
  const origin = new URL(context.req.url).origin;
  return context.json({
    asset: {
      ...asset,
      attachments: attachments.map((attachment) => publicAttachment(origin, attachment)),
    },
  });
});

app.post("/api/assets/:id/photos", async (context) => {
  const attachment = await uploadAssetPhoto(
    context.env,
    context.get("ownerId"),
    context.req.param("id"),
    context.req.raw,
  );
  return context.json(
    { attachment: publicAttachment(new URL(context.req.url).origin, attachment) },
    201,
  );
});

async function attachmentResponse(
  env: RuntimeEnv,
  ownerId: string,
  assetId: string,
  attachmentId: string,
  thumbnail: boolean,
): Promise<Response> {
  const attachment = await getAttachment(env.DB, ownerId, assetId, attachmentId);
  if (!attachment) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const key = thumbnail ? attachment.thumbnail_key : attachment.object_key;
  if (!key) return Response.json({ error: "Thumbnail not found" }, { status: 404 });
  const object = await env.ASSET_FILES.get(key);
  if (!object) return Response.json({ error: "Attachment object not found" }, { status: 404 });
  const headers = new Headers({
    "Content-Type": thumbnail ? "image/webp" : attachment.mime_type,
    "Content-Length": String(object.size),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.title)}`,
    "Cache-Control": "private, no-store",
    ETag: object.httpEtag ?? object.etag,
  });
  return new Response(object.body, { headers });
}

app.get("/api/assets/:id/attachments/:attachmentId", (context) =>
  attachmentResponse(
    context.env,
    context.get("ownerId"),
    context.req.param("id"),
    context.req.param("attachmentId"),
    false,
  ),
);

app.get("/api/assets/:id/attachments/:attachmentId/thumbnail", (context) =>
  attachmentResponse(
    context.env,
    context.get("ownerId"),
    context.req.param("id"),
    context.req.param("attachmentId"),
    true,
  ),
);

app.patch("/api/assets/:id/attachments/:attachmentId", async (context) => {
  const body = await readJsonBody(context.req.raw, MAX_STANDARD_JSON_BYTES);
  const patch = AttachmentPatchSchema.safeParse(body);
  if (!patch.success) return context.json({ error: "Invalid attachment patch" }, 400);
  const ownerId = context.get("ownerId");
  const assetId = context.req.param("id");
  const attachmentId = context.req.param("attachmentId");
  const attachment = await getAttachment(
    context.env.DB,
    ownerId,
    assetId,
    attachmentId,
  );
  if (!attachment) return context.json({ error: "Attachment not found" }, 404);
  const now = new Date().toISOString();
  if (patch.data.title !== undefined) {
    await updateAttachmentTitle(
      context.env.DB,
      ownerId,
      assetId,
      attachmentId,
      patch.data.title,
      now,
    );
  }
  if (patch.data.primary === true) {
    const changed = await setPrimaryPhoto(
      context.env.DB,
      ownerId,
      assetId,
      attachmentId,
      now,
    );
    if (!changed) return context.json({ error: "Photo not found" }, 404);
  }
  return context.json({ updated: true });
});

app.patch("/api/assets/:id", async (context) => {
  const body = await readJsonBody(context.req.raw, MAX_STANDARD_JSON_BYTES);
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
  const body = await readJsonBody(context.req.raw, MAX_CSV_REQUEST_BYTES);
  const parsed = CsvPayloadSchema.safeParse(body);
  if (!parsed.success) return context.json({ error: "Invalid CSV payload" }, 400);
  const assets = parseHomeboxCsv(parsed.data.csv_text);
  return context.json({
    count: assets.length,
    sample: assets.slice(0, 10),
    requires_confirmation: true,
    compatibility: "HomeBox v0.26.2 item CSV",
  });
});

app.post("/api/homebox/import", async (context) => {
  const body = await readJsonBody(context.req.raw, MAX_CSV_REQUEST_BYTES);
  const base = CsvImportPayloadSchema.safeParse(body);
  if (!base.success) return context.json({ error: "Invalid CSV payload" }, 400);
  if (base.data.confirmed !== true) {
    return context.json({ error: "Import requires confirmed: true" }, 409);
  }
  const assets = parseHomeboxCsv(base.data.csv_text);
  const result = await upsertImportedAssets(
    context.env.DB,
    context.get("ownerId"),
    assets,
    new Date().toISOString(),
  );
  return context.json({ imported: assets.length, ...result });
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
    requestUrl.searchParams.set("asset-version", "sha256-2d2e9be37c3e");
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
