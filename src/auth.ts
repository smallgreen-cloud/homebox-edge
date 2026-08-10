import { legacyTokenStorageKey, tokenStorageKey } from "./security/credential";

export interface TokenIdentity {
  uid: string;
  email?: string;
  expires_at?: number;
}

export function extractMcpToken(request: Request): string {
  const authorization = request.headers.get("Authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const url = new URL(request.url);
  return url.searchParams.get("key") ?? url.searchParams.get("token") ?? "";
}

export function parseTokenRecord(
  raw: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): TokenIdentity | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("uid" in value) ||
      typeof value.uid !== "string" ||
      value.uid.length === 0 ||
      ("email" in value && typeof value.email !== "string") ||
      ("expires_at" in value &&
        (typeof value.expires_at !== "number" || value.expires_at <= nowSeconds))
    ) {
      return null;
    }
    const identity: TokenIdentity = { uid: value.uid };
    if ("email" in value && typeof value.email === "string") {
      identity.email = value.email;
    }
    if ("expires_at" in value && typeof value.expires_at === "number") {
      identity.expires_at = value.expires_at;
    }
    return identity;
  } catch {
    return null;
  }
}

export async function authenticateMcp(
  request: Request,
  db: D1Database,
  tokens: KVNamespace,
  nowSeconds = Math.floor(Date.now() / 1_000),
): Promise<TokenIdentity | null> {
  const token = extractMcpToken(request);
  if (!token.startsWith("hi_")) return null;
  const hashedKvKey = await tokenStorageKey(token);
  const registered = await db
    .prepare(
      `SELECT user_id AS uid, expires_at FROM mcp_keys
       WHERE kv_key = ? AND expires_at > ?`,
    )
    .bind(hashedKvKey, nowSeconds)
    .first<{ uid: string; expires_at: number }>();
  if (registered) return registered;

  const legacyKvKey = legacyTokenStorageKey(token);
  const legacyRegistered = await db
    .prepare(
      `SELECT user_id AS uid, expires_at FROM mcp_keys
       WHERE kv_key = ? AND expires_at > ?`,
    )
    .bind(legacyKvKey, nowSeconds)
    .first<{ uid: string; expires_at: number }>();
  if (legacyRegistered) {
    try {
      const raw = await tokens.get(legacyKvKey);
      if (raw) {
        await tokens.put(hashedKvKey, raw, { expiration: legacyRegistered.expires_at });
      }
      const rotated = await db
        .prepare("UPDATE mcp_keys SET kv_key = ? WHERE kv_key = ?")
        .bind(hashedKvKey, legacyKvKey)
        .run();
      if ((rotated.meta.changes ?? 0) > 0 && raw) {
        await tokens.delete(legacyKvKey);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "failed to rotate registered MCP key storage",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return legacyRegistered;
  }

  // During the one-time production upgrade, existing connector keys still
  // authenticate through their legacy KV records until that owner has been
  // migrated. Once the marker exists, D1 is authoritative and a stale KV
  // cache cannot resurrect a revoked credential.
  const raw = await tokens.get(legacyKvKey);
  const legacy = raw ? parseTokenRecord(raw, nowSeconds) : null;
  if (!legacy) return null;
  const migrated = await db
    .prepare("SELECT 1 AS migrated FROM mcp_key_registry_migrations WHERE user_id = ?")
    .bind(legacy.uid)
    .first<{ migrated: number }>();
  return migrated ? null : legacy;
}

async function digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

export async function authenticateWeb(
  request: Request,
  adminToken: string | undefined,
): Promise<{ uid: "owner"; email: "owner" } | null> {
  const authorization = request.headers.get("Authorization");
  if (
    !authorization?.startsWith("Bearer ") ||
    typeof adminToken !== "string" ||
    adminToken.length === 0
  ) {
    return null;
  }
  const [supplied, expected] = await Promise.all([
    digest(authorization.slice(7)),
    digest(adminToken),
  ]);
  // Both digests have the same fixed length. A full XOR pass avoids the
  // length and early-return timing leaks of direct string comparison, while
  // also running in Node's Web Crypto test runtime.
  const left = new Uint8Array(supplied);
  const right = new Uint8Array(expected);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0 ? { uid: "owner", email: "owner" } : null;
}
