const DEDUP_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isDuplicate(
  kv: KVNamespace,
  hash: string,
): Promise<boolean> {
  const existing = await kv.get(`dedup:${hash}`);
  return existing !== null;
}

export async function markSeen(
  kv: KVNamespace,
  hash: string,
): Promise<void> {
  await kv.put(`dedup:${hash}`, '1', { expirationTtl: DEDUP_TTL });
}
