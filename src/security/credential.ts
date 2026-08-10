const textEncoder = new TextEncoder();

export function legacyTokenStorageKey(token: string): string {
  return `inventory:key:${token}`;
}

export async function tokenStorageKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(token));
  const fingerprint = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `inventory:key-sha256:${fingerprint}`;
}
