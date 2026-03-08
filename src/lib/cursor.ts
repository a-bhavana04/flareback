export async function getCursor<T = Record<string, string>>(
  kv: KVNamespace,
  key: string,
): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setCursor(
  kv: KVNamespace,
  key: string,
  value: Record<string, string | number>,
): Promise<void> {
  await kv.put(key, JSON.stringify(value));
}
