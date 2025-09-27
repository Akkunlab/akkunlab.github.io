import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { getCache, setCache, isTTLValid } from './cache';

/**
 * Incremental Notion sync utility.
 * Strategy:
 * 1. Keep last sync timestamp (notion:lastSyncedAt)
 * 2. Query DB for pages with last_edited_time > lastSyncedAt (paginated)
 * 3. For each changed page: fetch blocks + meta and update caches
 * 4. Track an index of all page IDs (notion:db:<DB_ID>:index)
 * 5. Detect archived pages and remove them from index
 * 6. Periodically sweep cached page IDs no longer in index (orphan cleanup)
 *
 * Key schema (KV/Redis friendly):
 * - notion:lastSyncedAt => ISO string
 * - notion:db:<DB_ID>:index => { ids: string[], updatedAt }
 * - notion:page:<PAGE_ID>:meta => { page: PageObjectResponse, last_edited_time }
 * - notion:page:<PAGE_ID>:blocks => { blocks: any[], last_block_fetched }
 */

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });

// Default sweep interval TTL (ms). If index cache older than this we do a lightweight full ID refresh.
const INDEX_SWEEP_TTL = 10 * 60 * 1000; // 10 min
// SWR config for public API responses
export const DEFAULT_SWR_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';

type IndexPayload = { ids: string[]; updatedAt: number };
type PageMetaPayload = { page: PageObjectResponse; last_edited_time: string };
type PageBlocksPayload = { blocks: any[]; last_block_fetched: number };

const keyLastSyncedAt = 'notion:lastSyncedAt';
const keyDbIndex = (db: string) => `notion:db:${db}:index`;
const keyPageMeta = (id: string) => `notion:page:${id}:meta`;
const keyPageBlocks = (id: string) => `notion:page:${id}:blocks`;

/** Lightweight wrapper for KV style get/set via existing file cache adapter */
async function getKV<T>(key: string) {
  const entry = await getCache<T>(key);
  return entry?.value ?? null;
}
async function setKV<T>(key: string, value: T) {
  await setCache(key, { value, cachedAt: Date.now() });
}

export interface IncrementalSyncResult {
  updatedPageIds: string[]; // pages we re-fetched
  archivedPageIds: string[]; // pages removed due to archive flag
  orphanPurged: string[]; // orphan cache keys purged (meta + blocks)
  lastSyncedAt: string; // new last synced timestamp
  totalIndexSize: number; // final page count
}

/**
 * Perform incremental sync for a database
 */
export async function incrementalSync(databaseId: string): Promise<IncrementalSyncResult> {
  if (!databaseId) throw new Error('databaseId required');

  // 1. Load last sync timestamp
  const lastSyncedAt = (await getKV<string>(keyLastSyncedAt)) || '';
  const updatedPageIds: string[] = [];
  const archivedPageIds: string[] = [];
  const orphanPurged: string[] = [];

  // 2. Query DB for changes since lastSyncedAt (iterate pagination)
  let hasMore = true;
  let startCursor: string | undefined = undefined;
  let newLatest = lastSyncedAt; // track largest last_edited_time we see

  while (hasMore) {
    const query: any = { database_id: databaseId, page_size: 100 };
    if (startCursor) query.start_cursor = startCursor;
    if (lastSyncedAt) {
      query.filter = {
        timestamp: 'last_edited_time',
        last_edited_time: { after: lastSyncedAt },
      };
    }
    const resp = await notion.databases.query(query);
    for (const r of resp.results) {
      const page = r as PageObjectResponse & { archived?: boolean };
      const le = (page as any).last_edited_time as string;
      if (le && (!newLatest || le > newLatest)) newLatest = le;
      if (page.archived) {
        archivedPageIds.push(page.id);
        continue;
      }
      // Fetch blocks only for changed page
      await fetchAndCachePage(page.id, page, updatedPageIds);
    }
    hasMore = resp.has_more;
    startCursor = resp.next_cursor || undefined;
    if (!lastSyncedAt) {
      // Initial full sync: we still need to continue through all pages, but we also need index
    }
  }

  // 3. Refresh full index if missing or stale OR first sync OR archived changes
  let index = await getKV<IndexPayload>(keyDbIndex(databaseId));
  const needFullIndex = !index || Date.now() - index.updatedAt > INDEX_SWEEP_TTL || !lastSyncedAt || archivedPageIds.length > 0;
  if (needFullIndex) {
    index = await rebuildIndex(databaseId);
  }

  // 4. Remove archived pages from index & purge their meta/blocks caches
  if (archivedPageIds.length && index) {
    const remaining = index.ids.filter(id => !archivedPageIds.includes(id));
    if (remaining.length !== index.ids.length) {
      index.ids = remaining;
      index.updatedAt = Date.now();
      await setKV(keyDbIndex(databaseId), index);
    }
    for (const pid of archivedPageIds) {
      // Mark as orphan (we don't have direct delete in file cache, we can overwrite with empty or rely on sweep)
      await setKV(keyPageMeta(pid), { page: { id: pid } as any, last_edited_time: 'archived' } as PageMetaPayload);
      await setKV(keyPageBlocks(pid), { blocks: [], last_block_fetched: Date.now() } as PageBlocksPayload);
    }
  }

  // 5. Orphan cleanup: any meta key whose id not in index
  if (index) {
    // We cannot list keys via file adapter easily (would require reading raw file). Skip heavy listing.
    // Provide hook for external sweeper; here we do nothing beyond marking archived.
  }

  // 6. Persist new lastSyncedAt
  const finalSynced = newLatest || lastSyncedAt || new Date().toISOString();
  await setKV(keyLastSyncedAt, finalSynced);

  return {
    updatedPageIds,
    archivedPageIds,
    orphanPurged,
    lastSyncedAt: finalSynced,
    totalIndexSize: index?.ids.length || 0,
  };
}

/** Fetch blocks + meta for a page and store */
async function fetchAndCachePage(pageId: string, page?: PageObjectResponse, updatedList?: string[]) {
  let pageObj = page;
  if (!pageObj) {
    pageObj = (await notion.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
  }
  const lastEdited: string = (pageObj as any).last_edited_time;
  await setKV<PageMetaPayload>(keyPageMeta(pageId), { page: pageObj, last_edited_time: lastEdited });

  // Blocks (pagination up to 100 at a time)
  const blocks: any[] = [];
  let cursor: string | undefined = undefined;
  let more = true;
  while (more) {
    const res: any = await notion.blocks.children.list({ block_id: pageId, page_size: 100, start_cursor: cursor });
    blocks.push(...res.results);
    more = res.has_more;
    cursor = res.next_cursor || undefined;
  }
  await setKV<PageBlocksPayload>(keyPageBlocks(pageId), { blocks, last_block_fetched: Date.now() });
  if (updatedList) updatedList.push(pageId);
}

/** Rebuild full index (IDs only) */
async function rebuildIndex(databaseId: string): Promise<IndexPayload> {
  const ids: string[] = [];
  let hasMore = true;
  let cursor: string | undefined = undefined;
  while (hasMore) {
    const resp = await notion.databases.query({ database_id: databaseId, page_size: 100, start_cursor: cursor });
    for (const r of resp.results) {
      const p = r as PageObjectResponse & { archived?: boolean };
      if (!p.archived) ids.push(p.id);
    }
    hasMore = resp.has_more;
    cursor = resp.next_cursor || undefined;
  }
  const payload: IndexPayload = { ids, updatedAt: Date.now() };
  await setKV(keyDbIndex(databaseId), payload);
  return payload;
}

/** Simple public reader that returns list of page meta from index (SWR friendly) */
export async function listPageMeta(databaseId: string) {
  const index = await getKV<IndexPayload>(keyDbIndex(databaseId));
  if (!index) return [];
  const metas: PageMetaPayload[] = [];
  for (const id of index.ids) {
    const meta = await getKV<PageMetaPayload>(keyPageMeta(id));
    if (meta && meta.last_edited_time !== 'archived') metas.push(meta);
  }
  return metas;
}

/** Get cached blocks (stale allowed) */
export async function getPageBlocks(pageId: string) {
  return (await getKV<PageBlocksPayload>(keyPageBlocks(pageId)))?.blocks ?? [];
}

/** Utility to build Cache-Control header string */
export function buildSWRCacheControl(maxAge = 60, stale = 300) {
  return `public, max-age=${maxAge}, stale-while-revalidate=${stale}`;
}

/** API Handler helper example (pseudo) */
// export async function handleList(req: Request) {
//   const db = 'YOUR_DB_ID';
//   const data = await listPageMeta(db);
//   return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': buildSWRCacheControl() } });
// }
