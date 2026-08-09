import { z } from "zod";

const KEY_TTL_SECONDS = 365 * 24 * 60 * 60;
const MAX_KEYS_PER_OWNER = 3;

const StoredKeySchema = z.object({
  id: z.string().uuid(),
  key: z.string().startsWith("hi_"),
  preview: z.string(),
  created_at: z.number().int(),
  expires_at: z.number().int(),
});

type StoredKey = z.infer<typeof StoredKeySchema>;

interface KeyOwner {
  uid: string;
  email: string;
}

export interface PublicKeyRecord {
  id: string;
  preview: string;
  created_at: number;
  expires_at: number;
}

function indexKey(uid: string): string {
  return `inventory:user-keys:${uid}`;
}

async function readIndex(namespace: KVNamespace, uid: string): Promise<StoredKey[]> {
  const raw = await namespace.get(indexKey(uid));
  if (!raw) return [];
  try {
    const parsed = z.array(StoredKeySchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function listKeys(
  namespace: KVNamespace,
  uid: string,
  now = Math.floor(Date.now() / 1_000),
): Promise<PublicKeyRecord[]> {
  return (await readIndex(namespace, uid))
    .filter((record) => record.expires_at > now)
    .map(({ id, preview, created_at, expires_at }) => ({
      id,
      preview,
      created_at,
      expires_at,
    }));
}

export async function issueKey(
  namespace: KVNamespace,
  owner: KeyOwner,
): Promise<StoredKey> {
  const now = Math.floor(Date.now() / 1_000);
  const live = (await readIndex(namespace, owner.uid)).filter(
    (record) => record.expires_at > now,
  );
  if (live.length >= MAX_KEYS_PER_OWNER) {
    throw new Error(`最多 ${MAX_KEYS_PER_OWNER} 把有效 MCP key`);
  }
  const id = crypto.randomUUID();
  const key = `hi_${crypto.randomUUID().replaceAll("-", "")}`;
  const record: StoredKey = {
    id,
    key,
    preview: `${key.slice(0, 7)}…${key.slice(-4)}`,
    created_at: now,
    expires_at: now + KEY_TTL_SECONDS,
  };
  await namespace.put(
    `inventory:key:${key}`,
    JSON.stringify({
      uid: owner.uid,
      email: owner.email,
      issued_at: now,
      expires_at: record.expires_at,
    }),
    { expirationTtl: KEY_TTL_SECONDS },
  );
  await namespace.put(indexKey(owner.uid), JSON.stringify([...live, record]));
  return record;
}

export async function revokeKey(
  namespace: KVNamespace,
  uid: string,
  id: string,
): Promise<boolean> {
  const records = await readIndex(namespace, uid);
  const owned = records.find((record) => record.id === id);
  if (!owned) return false;
  await Promise.all([
    namespace.delete(`inventory:key:${owned.key}`),
    namespace.put(
      indexKey(uid),
      JSON.stringify(records.filter((record) => record.id !== id)),
    ),
  ]);
  return true;
}
