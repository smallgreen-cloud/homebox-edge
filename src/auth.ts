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
  tokens: KVNamespace,
): Promise<TokenIdentity | null> {
  const token = extractMcpToken(request);
  if (!token.startsWith("hi_")) return null;
  const raw = await tokens.get(`inventory:key:${token}`);
  return raw ? parseTokenRecord(raw) : null;
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
