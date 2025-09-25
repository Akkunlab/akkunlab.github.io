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

let cacheStore: Record<string, CacheEntry<any>> | null = null;

/** キャッシュをメモリに読み込み */
const ensureCacheLoaded = async () => {
  if (cacheStore) return;
  try {
    if (!fssync.existsSync(CACHE_DIR)) {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    }
    if (fssync.existsSync(CACHE_FILE)) {
      const raw = await fs.readFile(CACHE_FILE, 'utf-8');
      cacheStore = JSON.parse(raw) as Record<string, CacheEntry<any>>;
    } else {
      cacheStore = {};
    }
  } catch {
    cacheStore = {};
  }
};

/** キャッシュ内容をディスクへ保存 */
const persistCache = async () => {
  try {
    if (!fssync.existsSync(CACHE_DIR)) {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    }
    await fs.writeFile(CACHE_FILE, JSON.stringify(cacheStore ?? {}, null, 2), 'utf-8');
  } catch {
    // 書き込み失敗は無視（機能影響を避けるため）
  }
};

/** キャッシュの取得
 * @param key キャッシュキー
 * @returns キャッシュエントリ
 */
export const getCache = async <T,>(key: string): Promise<CacheEntry<T> | null> => {
  await ensureCacheLoaded();
  return (cacheStore?.[key] as CacheEntry<T>) ?? null;
};

/** キャッシュの保存
 * @param key キャッシュキー
 * @param entry 保存するキャッシュエントリ
 */
export const setCache = async <T,>(key: string, entry: CacheEntry<T>) => {
  await ensureCacheLoaded();
  if (!cacheStore) cacheStore = {};
  cacheStore[key] = entry;
  await persistCache();
};

/** TTL（有効期限）内かどうかを判定
 * @param cachedAt キャッシュ時刻（エポック ms）
 * @param ttlMs TTL（有効期限）をミリ秒で指定
 * @returns TTLが有効かどうか
 */
export const isTTLValid = (cachedAt: number, ttlMs = CACHE_TTL_MS) => Date.now() - cachedAt < ttlMs;
