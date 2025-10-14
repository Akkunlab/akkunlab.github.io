import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';

export type CacheEntry<T> = {
  value: T;
  lastChange?: string;
  cachedAt: number;
};

const CACHE_DIR = '.cache';
const CACHE_FILE = path.join(CACHE_DIR, 'notion-cache.json');
export const CACHE_TTL_MS = 5 * 60 * 1000; // 既定のTTLは5分

let memoryStore: Record<string, CacheEntry<any>> = {};
let localStore: Record<string, CacheEntry<any>> | null = null;

// Cloudflare KV 設定
const { CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN, MODE } = import.meta.env;

const isProduction = MODE === 'production';
const isKVConfigured = () => Boolean(CF_ACCOUNT_ID && CF_KV_NAMESPACE_ID && CF_API_TOKEN);
const isKVAvailable = () => isProduction && isKVConfigured();

if (isProduction && !isKVConfigured()) {
  throw new Error('Cloudflare KV environment variables (CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN) are required in production.');
}

const kvBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values`

/** Cloudflare KV からキャッシュを取得 */
const kvGet = async <T,>(key: string): Promise<CacheEntry<T> | null> => {
  if (!isKVAvailable()) return null;
  try {
    const res = await fetch(`${kvBaseUrl}/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as CacheEntry<T>;
  } catch {
    return null;
  }
};

/** Cloudflare KV へキャッシュを保存 */
const kvSet = async <T,>(key: string, entry: CacheEntry<T>): Promise<boolean> => {
  if (!isKVAvailable()) return false;
  try {
    const res = await fetch(`${kvBaseUrl}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    });
    return res.ok;
  } catch {
    return false;
  }
};

/** キャッシュをメモリに読み込み */
const ensureLocalLoaded = async () => {
  if (localStore) return;
  try {
    if (!fssync.existsSync(CACHE_DIR)) {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    }
    if (fssync.existsSync(CACHE_FILE)) {
      const raw = await fs.readFile(CACHE_FILE, 'utf-8');
      localStore = JSON.parse(raw) as Record<string, CacheEntry<any>>;
    } else {
      localStore = {};
    }
  } catch {
    localStore = {};
  }
};

/** キャッシュ内容をディスクへ保存 */
const persistLocal = async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(localStore ?? {}, null, 2), 'utf-8');
  } catch {
    // 書き込み失敗は無視
  }
};

/** キャッシュの取得
 * @param key キャッシュキー
 * @returns キャッシュエントリ
 */
export const getCache = async <T,>(key: string): Promise<CacheEntry<T> | null> => {
  const mem = memoryStore[key] as CacheEntry<T> | undefined;

  if (mem) return mem;
  if (isKVAvailable()) {
    const fromKV = await kvGet<T>(key);
    if (fromKV) {
      memoryStore[key] = fromKV;
      return fromKV;
    }
  }

  await ensureLocalLoaded(); // ローカルフォールバック

  const fromLocal = (localStore?.[key] as CacheEntry<T>) ?? null;

  if (fromLocal) memoryStore[key] = fromLocal;

  return fromLocal;
};

/** キャッシュの保存
 * @param key キャッシュキー
 * @param entry 保存するキャッシュエントリ
 */
export const setCache = async <T,>(key: string, entry: CacheEntry<T>) => {
  memoryStore[key] = entry;

  // KV が利用可能ならKVへ保存
  if (isKVAvailable()) {
    await kvSet<T>(key, entry);
    return;
  }

  // ローカル保存
  await ensureLocalLoaded();

  if (!localStore) localStore = {};

  localStore[key] = entry;

  await persistLocal();
};

/** TTL（有効期限）内かどうかを判定
 * @param cachedAt キャッシュ時刻（エポック ms）
 * @param ttlMs TTL（有効期限）をミリ秒で指定
 * @returns TTLが有効かどうか
 */
export const isTTLValid = (cachedAt: number, ttlMs = CACHE_TTL_MS) => Date.now() - cachedAt < ttlMs;
