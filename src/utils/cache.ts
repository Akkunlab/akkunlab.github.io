﻿import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';

export type CacheEntry<T> = {
  value: T;
  lastChange?: string;
  cachedAt: number;
};

export const CACHE_TTL_MS = 5 * 60 * 1000;

const CACHE_DIR = '.cache';
const DEV_CONTENT_DIR = path.join(CACHE_DIR, 'dev', 'content');
const DEV_IMAGE_PUBLIC_SUBDIR = '_notion-cache';

const memoryStore: Record<string, CacheEntry<any>> = {};

const {
  CF_ACCOUNT_ID,
  CF_KV_NAMESPACE_ID,
  CF_API_TOKEN,
  MODE,
  CF_R2_ACCESS_KEY_ID,
  CF_R2_SECRET_ACCESS_KEY,
  CF_R2_BUCKET_NAME,
} = import.meta.env;

const isProduction = MODE === 'production';
const isKVConfigured = () => Boolean(CF_ACCOUNT_ID && CF_KV_NAMESPACE_ID && CF_API_TOKEN);
const isKVAvailable = () => isProduction && isKVConfigured();

if (isProduction && !isKVConfigured()) {
  throw new Error(
    'Cloudflare KV environment variables (CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN) are required in production.',
  );
}

const kvBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values`;

/**
 * ディレクトリを存在チェックして無ければ作成
 * @param dir ディレクトリパス
 */
const ensureDir = async (dir: string) => {
  if (!fssync.existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
};

/**
 * キャッシュキーをファイル名に使えるハッシュへ変換
 * @param key キャッシュキー
 * @returns SHA-1 ハッシュ文字列
 */
const keyToFilename = (key: string) => createHash('sha1').update(key).digest('hex');

/**
 * 開発モード用の JSON キャッシュを読み込む
 * @param key キャッシュキー
 * @returns キャッシュエントリまたは null
 */
const readDevCache = async <T>(key: string): Promise<CacheEntry<T> | null> => {
  const filename = `${keyToFilename(key)}.json`;
  const filePath = path.join(DEV_CONTENT_DIR, filename);
  if (!fssync.existsSync(filePath)) return null;

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
};

/**
 * 開発モード用の JSON キャッシュを書き出す
 * @param key キャッシュキー
 * @param entry 保存するエントリ
 */
const writeDevCache = async <T>(key: string, entry: CacheEntry<T>) => {
  await ensureDir(DEV_CONTENT_DIR);
  const filename = `${keyToFilename(key)}.json`;
  const filePath = path.join(DEV_CONTENT_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
};

/**
 * Cloudflare KV からキャッシュを取得
 * @param key キャッシュキー
 * @returns キャッシュエントリまたは null
 */
const kvGet = async <T>(key: string): Promise<CacheEntry<T> | null> => {
  if (!isKVAvailable()) return null;

  try {
    const res = await fetch(`${kvBaseUrl}/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    });

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const text = await res.text();
    if (!text) return null;

    return JSON.parse(text) as CacheEntry<T>;
  } catch {
    return null;
  }
};

/**
 * Cloudflare KV にキャッシュを書き込む
 * @param key キャッシュキー
 * @param entry 保存するエントリ
 */
const kvSet = async <T>(key: string, entry: CacheEntry<T>) => {
  if (!isKVAvailable()) return;

  await fetch(`${kvBaseUrl}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entry),
  });
};

/**
 * キャッシュを取得（メモリ → KV → ローカルの順）
 * @param key キャッシュキー
 * @returns キャッシュエントリまたは null
 */
export const getCache = async <T>(key: string): Promise<CacheEntry<T> | null> => {
  const mem = memoryStore[key] as CacheEntry<T> | undefined;
  if (mem) return mem;

  if (isKVAvailable()) {
    const fromKV = await kvGet<T>(key);
    if (fromKV) {
      memoryStore[key] = fromKV;
      return fromKV;
    }
  }

  const fromDev = await readDevCache<T>(key);
  if (fromDev) {
    memoryStore[key] = fromDev;
    return fromDev;
  }

  return null;
};

/**
 * キャッシュを書き込む（メモリに保持し、KV かローカルへ保存）
 * @param key キャッシュキー
 * @param entry 保存するエントリ
 */
export const setCache = async <T>(key: string, entry: CacheEntry<T>) => {
  memoryStore[key] = entry;

  if (isKVAvailable()) {
    await kvSet<T>(key, entry);
    return;
  }

  await writeDevCache<T>(key, entry);
};

/**
 * TTL の有効期限内かどうかを判定
 * @param cachedAt キャッシュ保存時刻
 * @param ttlMs 有効期限（ミリ秒）
 * @returns 有効期限内なら true
 */
export const isTTLValid = (cachedAt: number, ttlMs = CACHE_TTL_MS) => Date.now() - cachedAt < ttlMs;

/**
 * 開発時に画像を保存するディレクトリパスを返す
 * @returns ディレクトリパス
 */
export const getDevImageDirectory = () => path.join('public', DEV_IMAGE_PUBLIC_SUBDIR);

/**
 * 開発時に画像を参照するための公開パスを返す
 * @returns 公開パス
 */
export const getDevImagePublicPath = () => `/${DEV_IMAGE_PUBLIC_SUBDIR}`;

/**
 * Cloudflare R2 の設定を取得（不足があれば null）
 * @returns R2 設定か null
 */
export const getR2Config = () => {
  if (!CF_ACCOUNT_ID || !CF_R2_ACCESS_KEY_ID || !CF_R2_SECRET_ACCESS_KEY || !CF_R2_BUCKET_NAME) {
    return null;
  }

  return {
    accountId: CF_ACCOUNT_ID,
    accessKeyId: CF_R2_ACCESS_KEY_ID,
    secretAccessKey: CF_R2_SECRET_ACCESS_KEY,
    bucketName: CF_R2_BUCKET_NAME,
    publicBaseUrl: `https://${CF_R2_BUCKET_NAME}.${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  };
};

/**
 * 文字列を SHA-1 でハッシュ化
 * @param value ハッシュ対象の文字列
 * @returns 16 進ハッシュ文字列
 */
export const hashString = (value: string) => createHash('sha1').update(value).digest('hex');
