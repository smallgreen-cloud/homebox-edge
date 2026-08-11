import { z } from "zod";

import { parseHomeboxCsv, renderHomeboxCsv } from "../compat/homebox-csv";
import {
  HomeAssetPatchSchema,
  HomeAssetSchema,
  type StoredHomeAsset,
} from "../core/asset";
import type { StoredAssetAttachment } from "../core/attachment";
import { InvalidRequestError, NotFoundError } from "../errors";
import { publicAttachment } from "../media/asset-photos";
import {
  archiveAsset,
  getAsset,
  insertAsset,
  listAssets,
  searchAssets,
  updateAsset,
  upsertImportedAssets,
} from "../storage/assets";
import {
  listAttachments,
  listPrimaryPhotoAttachments,
} from "../storage/attachments";

type ToolEnv = {
  DB: Env["DB"];
  PUBLIC_BASE_URL: string;
};

const AssetIdSchema = z.object({ asset_id: z.string().min(1) }).strict();
const SearchSchema = z.object({ query: z.string().trim().min(1).max(500) }).strict();
const CsvSchema = z.object({ csv_text: z.string().min(1).max(5 * 1024 * 1024) }).strict();
const ImportCsvSchema = CsvSchema.extend({ confirmed: z.literal(true) }).strict();
const UpdateSchema = z
  .object({ asset_id: z.string().min(1), patch: HomeAssetPatchSchema })
  .strict();
const EmptySchema = z.object({}).strict();

function jsonInputSchema(schema: z.ZodType) {
  const { $schema: _schema, ...inputSchema } = z.toJSONSchema(schema);
  return inputSchema;
}

export const TOOL_DEFINITIONS = [
  {
    name: "create_asset",
    description: "建立一筆已確認的家庭資產。",
    inputSchema: jsonInputSchema(HomeAssetSchema),
  },
  {
    name: "search_assets",
    description: "搜尋目前擁有者的未封存家庭資產。",
    inputSchema: jsonInputSchema(SearchSchema),
  },
  {
    name: "get_asset",
    description: "讀取一筆家庭資產完整資料。",
    inputSchema: jsonInputSchema(AssetIdSchema),
  },
  {
    name: "update_asset",
    description: "更新一筆家庭資產的允許欄位。",
    inputSchema: jsonInputSchema(UpdateSchema),
  },
  {
    name: "archive_asset",
    description: "封存資產；不永久刪除。",
    inputSchema: jsonInputSchema(AssetIdSchema),
  },
  {
    name: "preview_homebox_csv",
    description: "解析並預覽 HomeBox CSV/TSV；不寫入。",
    inputSchema: jsonInputSchema(CsvSchema),
  },
  {
    name: "import_homebox_csv",
    description: "匯入已確認的 HomeBox CSV/TSV。confirmed 必須為 true。",
    inputSchema: jsonInputSchema(ImportCsvSchema),
  },
  {
    name: "export_homebox_csv",
    description: "以 HomeBox v0.26.2 canonical CSV 格式匯出全部資產。",
    inputSchema: jsonInputSchema(EmptySchema),
  },
] as const;

function publicAsset(
  env: ToolEnv,
  asset: StoredHomeAsset,
  attachments?: readonly StoredAssetAttachment[],
) {
  const photos = attachments?.map((attachment) =>
    publicAttachment(env.PUBLIC_BASE_URL, attachment),
  );
  const primaryPhoto = photos?.find((attachment) => attachment.primary_photo);
  return {
    ...asset,
    detail_url: `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/a/${encodeURIComponent(asset.id)}`,
    ...(photos ? { attachments: photos } : {}),
    ...(primaryPhoto ? { primary_photo: primaryPhoto } : {}),
  };
}

export async function callTool(
  env: ToolEnv,
  userId: string,
  name: string,
  args: unknown,
): Promise<unknown> {
  if (name === "create_asset") {
    const raw = typeof args === "object" && args !== null ? args : {};
    const input = HomeAssetSchema.parse({ quantity: 1, ...raw });
    const now = new Date().toISOString();
    const asset: StoredHomeAsset = {
      ...input,
      id: `asset_${crypto.randomUUID()}`,
      created_at: now,
      updated_at: now,
    };
    await insertAsset(env.DB, userId, asset);
    return publicAsset(env, asset);
  }
  if (name === "search_assets") {
    const { query } = SearchSchema.parse(args);
    const [assets, primaryPhotos] = await Promise.all([
      searchAssets(env.DB, userId, query),
      listPrimaryPhotoAttachments(env.DB, userId),
    ]);
    const primaryByAsset = new Map(
      primaryPhotos.map((attachment) => [attachment.asset_id, attachment]),
    );
    return assets.map((asset) => {
      const primary = primaryByAsset.get(asset.id);
      return publicAsset(env, asset, primary ? [primary] : []);
    });
  }
  if (name === "get_asset") {
    const { asset_id: id } = AssetIdSchema.parse(args);
    const asset = await getAsset(env.DB, userId, id);
    if (!asset) throw new NotFoundError("asset not found");
    const attachments = await listAttachments(env.DB, userId, id);
    return publicAsset(env, asset, attachments);
  }
  if (name === "update_asset") {
    const { asset_id: id, patch } = UpdateSchema.parse(args);
    const changed = await updateAsset(env.DB, userId, id, patch, new Date().toISOString());
    if (!changed) throw new NotFoundError("asset not found or patch is empty");
    return { id, updated: true };
  }
  if (name === "archive_asset") {
    const { asset_id: id } = AssetIdSchema.parse(args);
    const archived = await archiveAsset(env.DB, userId, id, new Date().toISOString());
    if (!archived) throw new NotFoundError("asset not found or already archived");
    return { id, archived: true };
  }
  if (name === "preview_homebox_csv") {
    const { csv_text: csv } = CsvSchema.parse(args);
    const assets = parseHomeboxCsv(csv);
    return {
      count: assets.length,
      sample: assets.slice(0, 10),
      requires_confirmation: true,
    };
  }
  if (name === "import_homebox_csv") {
    const { csv_text: csv } = ImportCsvSchema.parse(args);
    const assets = parseHomeboxCsv(csv);
    const result = await upsertImportedAssets(
      env.DB,
      userId,
      assets,
      new Date().toISOString(),
    );
    return { imported: assets.length, ...result };
  }
  if (name === "export_homebox_csv") {
    EmptySchema.parse(args);
    const assets = await listAssets(env.DB, userId, true);
    return { format: "homebox.csv", count: assets.length, content: renderHomeboxCsv(assets) };
  }
  throw new InvalidRequestError(`unknown tool: ${name}`);
}
