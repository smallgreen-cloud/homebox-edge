import { z } from "zod";

import { ConflictError } from "./errors";
import { legacyTokenStorageKey, tokenStorageKey } from "./security/credential";

const KEY_TTL_SECONDS = 365 * 24 * 60 * 60;
const MAX_KEYS_PER_OWNER = 3;

const LegacyStoredKeySchema = z.object({
  id: z.string().uuid(),
  key: z.string().startsWith("hi_"),
  preview: z.string(),
  created_at: z.number().int(),
  expires_at: z.number().int(),
});
const LegacyTokenSchema = z.object({
  uid: z.string().min(1),
  expires_at: z.number().int(),
});

type LegacyStoredKey = z.infer<typeof LegacyStoredKeySchema>;

interface KeyOwner {
  uid: string;
  email: string;
}

interface IssuedKey extends PublicKeyRecord {
  key: string;
}

export interface PublicKeyRecord {
  id: string;
  preview: string;
  created_at: number;
  expires_at: number;
}

function legacyIndexKey(uid: string): string {
  return `inventory:user-keys:${uid}`;
}

async function readLegacyIndex(namespace: KVNamespace, uid: string): Promise<LegacyStoredKey[]> {
  const raw = await namespace.get(legacyIndexKey(uid));
  if (!raw) return [];
  try {
    const parsed = z.array(LegacyStoredKeySchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

async function ensureRegistryMigrated(
  db: D1Database,
  namespace: KVNamespace,
  uid: string,
  now: number,
): Promise<void> {
  const migrated = await db
    .prepare("SELECT 1 AS migrated FROM mcp_key_registry_migrations WHERE user_id = ?")
    .bind(uid)
    .first<{ migrated: number }>();
  if (migrated) return;

  const legacy = (await readLegacyIndex(namespace, uid)).filter(
    (record) => record.expires_at > now,
  );
  const verified: Array<{
    record: LegacyStoredKey;
    raw: string;
    legacyKvKey: string;
    hashedKvKey: string;
  }> = [];
  for (const record of legacy) {
    const legacyKvKey = legacyTokenStorageKey(record.key);
    const raw = await namespace.get(legacyKvKey);
    if (!raw) continue;
    try {
      const token = LegacyTokenSchema.safeParse(JSON.parse(raw));
      if (token.success && token.data.uid === uid && token.data.expires_at > now) {
        verified.push({
          record,
          raw,
          legacyKvKey,
          hashedKvKey: await tokenStorageKey(record.key),
        });
      }
    } catch {
      // A malformed legacy record was never a valid credential, so it is not migrated.
    }
  }

  const statements = verified.map(({ record, hashedKvKey }) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO mcp_keys
         (id, user_id, kv_key, preview, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        uid,
        hashedKvKey,
        record.preview,
        record.created_at,
        record.expires_at,
      ),
  );
  statements.push(
    db
      .prepare(
        `INSERT OR IGNORE INTO mcp_key_registry_migrations (user_id, migrated_at)
         VALUES (?, ?)`,
      )
      .bind(uid, now),
  );
  await db.batch(statements);

  for (const { record, raw, legacyKvKey, hashedKvKey } of verified) {
    try {
      await namespace.put(hashedKvKey, raw, { expiration: record.expires_at });
      await namespace.delete(legacyKvKey);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "failed to rotate legacy MCP key storage",
          key_id: record.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

export async function listKeys(
  db: D1Database,
  namespace: KVNamespace,
  uid: string,
  now = Math.floor(Date.now() / 1_000),
): Promise<PublicKeyRecord[]> {
  await ensureRegistryMigrated(db, namespace, uid, now);
  const result = await db
    .prepare(
      `SELECT id, preview, created_at, expires_at FROM mcp_keys
       WHERE user_id = ? AND expires_at > ?
       ORDER BY created_at DESC`,
    )
    .bind(uid, now)
    .all<PublicKeyRecord>();
  return result.results;
}

export async function issueKey(
  db: D1Database,
  namespace: KVNamespace,
  owner: KeyOwner,
): Promise<IssuedKey> {
  const now = Math.floor(Date.now() / 1_000);
  await ensureRegistryMigrated(db, namespace, owner.uid, now);

  const id = crypto.randomUUID();
  const key = `hi_${crypto.randomUUID().replaceAll("-", "")}`;
  const record: IssuedKey = {
    id,
    key,
    preview: `${key.slice(0, 7)}…${key.slice(-4)}`,
    created_at: now,
    expires_at: now + KEY_TTL_SECONDS,
  };
  const kvKey = await tokenStorageKey(key);
  const inserted = await db
    .prepare(
      `INSERT INTO mcp_keys (id, user_id, kv_key, preview, created_at, expires_at)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE (
         SELECT COUNT(*) FROM mcp_keys WHERE user_id = ? AND expires_at > ?
       ) < ?`,
    )
    .bind(
      record.id,
      owner.uid,
      kvKey,
      record.preview,
      record.created_at,
      record.expires_at,
      owner.uid,
      now,
      MAX_KEYS_PER_OWNER,
    )
    .run();
  if ((inserted.meta.changes ?? 0) === 0) {
    throw new ConflictError(`最多 ${MAX_KEYS_PER_OWNER} 把有效 MCP key`);
  }

  try {
    await namespace.put(
      kvKey,
      JSON.stringify({
        uid: owner.uid,
        email: owner.email,
        issued_at: now,
        expires_at: record.expires_at,
      }),
      { expirationTtl: KEY_TTL_SECONDS },
    );
  } catch (error) {
    try {
      await db
        .prepare("DELETE FROM mcp_keys WHERE user_id = ? AND id = ?")
        .bind(owner.uid, record.id)
        .run();
    } catch (cleanupError) {
      console.error(
        JSON.stringify({
          message: "failed to compensate MCP key registry write",
          key_id: record.id,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        }),
      );
    }
    throw error;
  }
  return record;
}

export async function revokeKey(
  db: D1Database,
  namespace: KVNamespace,
  uid: string,
  id: string,
): Promise<boolean> {
  await ensureRegistryMigrated(db, namespace, uid, Math.floor(Date.now() / 1_000));
  const owned = await db
    .prepare("SELECT kv_key FROM mcp_keys WHERE user_id = ? AND id = ?")
    .bind(uid, id)
    .first<{ kv_key: string }>();
  if (!owned) return false;

  // Remove the compatibility mirror first. If that fails, D1 remains valid and
  // the caller gets an error; after the D1 row is removed, authorization stops
  // immediately and a stale KV cache is blocked by the migration marker.
  await namespace.delete(owned.kv_key);
  const deleted = await db
    .prepare("DELETE FROM mcp_keys WHERE user_id = ? AND id = ?")
    .bind(uid, id)
    .run();
  return (deleted.meta.changes ?? 0) > 0;
}
