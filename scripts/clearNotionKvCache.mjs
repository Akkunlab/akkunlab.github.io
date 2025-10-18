/**
 * Cloudflare KVからnotion:で始まるキャッシュをすべて削除するスクリプト
 * Run: node scripts/clearNotionKvCache.mjs
 */

import fs from 'fs';
import path from 'path';

/**
 * 環境変数を読み込む
 * @returns 環境変数のオブジェクト
 */
const loadEnv = () => {
  const env = { ...process.env };
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) {
    return env;
  }

  const content = fs.readFileSync(envPath, 'utf-8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [rawKey, ...rawValueParts] = trimmed.split('=');
    if (!rawKey || rawValueParts.length === 0) continue;

    const key = rawKey.trim();
    let value = rawValueParts.join('=').trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in env)) {
      env[key] = value;
    }
  }

  return env;
};

const env = loadEnv();

const accountId = env.CF_ACCOUNT_ID;
const namespaceId = env.CF_KV_NAMESPACE_ID;
const apiToken = env.CF_API_TOKEN;

if (!accountId || !namespaceId || !apiToken) {
  console.error('Cloudflare KV credentials are missing.');
  process.exit(1);
}

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
const headers = {
  Authorization: `Bearer ${apiToken}`,
};

/**
 * 指定されたURLからJSONを取得
 * @param url 取得するURL
 * @returns 取得したJSONデータ
 */
const fetchJson = async url => {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json();
};

/**
 * notion: で始まるキーをすべて取得
 * @returns notion: で始まるキーの配列
 */
const listNotionKeys = async () => {
  const keys = [];
  let cursor;

  do {
    const url = new URL(`${baseUrl}/keys`);
    if (cursor) url.searchParams.set('cursor', cursor);

    const data = await fetchJson(url);
    const chunk = Array.isArray(data.result) ? data.result : [];
    for (const item of chunk) {
      const name = item?.name;
      if (typeof name === 'string' && name.startsWith('notion:')) {
        keys.push(name);
      }
    }

    cursor = data?.result_info?.cursor;
  } while (cursor);

  return keys;
};

/**
 * 指定されたキーを削除
 * @param key 削除するキー
 */
const deleteKey = async key => {
  const encodedKey = encodeURIComponent(key);
  const res = await fetch(`${baseUrl}/values/${encodedKey}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete key "${key}" (${res.status}): ${text}`);
  }
};

const main = async () => {
  const keys = await listNotionKeys();

  if (keys.length === 0) {
    console.log('No notion:* keys found in KV namespace.');
    return;
  }

  console.log(`Deleting ${keys.length} notion:* keys from KV...`);

  for (const key of keys) {
    await deleteKey(key);
    console.log(`Deleted: ${key}`);
  }
  console.log('KV cleanup completed.');
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
