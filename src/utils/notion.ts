import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionConverter } from 'notion-to-md';
import { MDXRenderer } from 'notion-to-md/plugins/renderer';
import * as path from 'path';
import * as fssync from 'fs';
import {
  CACHE_TTL_MS,
  getCache,
  setCache,
  deleteCache,
  isTTLValid,
  getDevImageDirectory,
  getDevImagePublicPath,
} from './cache';
import { ensureImageCached } from './imageCache';
import { normalizeTagName } from './tagUtils';
import { isHttpUrl } from './url';
import { IMAGE_FORMAT, IMAGE_QUALITY, OGP_IMAGE } from '@/constants';
import type { NotionRecord, Tag } from '@/types';

// Notion ページの単一プロパティ値（rich_text / select / date など）の型
type NotionProperty = PageObjectResponse['properties'][string];
// DB 構造（プロパティ名 -> 構成。type の判定にのみ使用）
type DbProps = Record<string, { type?: string } | undefined>;
// 一覧取得のオプション
type ListOptions = {
  types?: string[];
  sorts?: Array<
    (
      | { property: string }
      | { timestamp: 'created_time' | 'last_edited_time' }
    ) & { direction: 'ascending' | 'descending' }
  >;
};

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const renderer = new MDXRenderer();

// キャッシュキー生成
const makeCacheKey = {
  list: (databaseId: string, options?: Record<string, unknown>) =>
    `notion:list:${databaseId}:${JSON.stringify(options ?? {})}`,
  page: (pageId: string, isProduction: boolean) =>
    `notion:page:${pageId}:${isProduction ? 'prod' : 'dev'}`,
  dbProps: (databaseId: string) => `notion:db-props:${databaseId}`,
};

// TTL設定
const TTL = {
  dbProps: 60 * 60 * 1000, // 1時間
  devPage: 24 * 60 * 60 * 1000, // 24時間
  list: CACHE_TTL_MS, // 5分
};

const IMAGE_CAPTURE_REGEX = /!\[[^\]]*]\(([^)]+)\)/g;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 空段落を &nbsp; に変換するトランスフォーマを設定
 */
renderer.createBlockTransformer('paragraph', {
  transform: async ({ block, utils }) => {
    if (block.paragraph.rich_text.length === 0) return '&nbsp;\n';
    const text = await utils.transformRichText(block.paragraph.rich_text);
    return `${text}\n\n`;
  },
});

/**
 * Notion プロパティから安全に値を取り出す
 */
// property.type の実行時判定で値を取り出すため、extract 内は型を絞れず any を許容する
const getProperty = <T>(
  property: NotionProperty | undefined,
  type: string,
  fallback: T,
  extract: (prop: any) => T,
): T => (property?.type === type ? extract(property) : fallback);

type Prop = NotionProperty | undefined;

const getRichText = (p: Prop) => getProperty(p, 'rich_text', '', prop => prop.rich_text[0]?.plain_text || '');
const getSelect = (p: Prop) => getProperty(p, 'select', '', prop => prop.select?.name || '');
const getTitle = (p: Prop) => getProperty(p, 'title', '', prop => prop.title[0]?.plain_text || '');
const getMultiSelect = (p: Prop): Tag[] =>
  getProperty<Tag[]>(p, 'multi_select', [], prop =>
    prop.multi_select.map((tag: { id: string; name: string }) => ({ id: tag.id, name: tag.name })),
  );
const getNumber = (p: Prop) => getProperty(p, 'number', '', prop => prop.number?.toString() || '');
const getUrl = (p: Prop) => getProperty(p, 'url', '', prop => prop.url || '');
const getDate = (p: Prop) => getProperty(p, 'date', '', prop => {
  const start = prop.date?.start || '';
  const end = prop.date?.end || '';
  if (start && end) return `${start}/${end}`;
  return start;
});
const getCheckbox = (p: Prop) => getProperty(p, 'checkbox', false, prop => prop.checkbox === true);
const getLastEdited = (p: Prop) => getProperty(p, 'last_edited_time', '', prop => prop.last_edited_time);

/**
 * 開発環境でキャッシュした画像のローカルパスを要求
 */
const resolveDevFsPath = (publicUrl: string): string | null => {
  const base = getDevImagePublicPath();
  if (!publicUrl || !base || !publicUrl.startsWith(base)) return null;

  const relative = publicUrl.slice(base.length).replace(/^\/+/, '');
  if (!relative) return null;

  return path.join(getDevImageDirectory(), relative);
};

/**
 * 開発用キャッシュに必要な画像がそろっているか確認
 */
const devAssetsAvailable = (content: string, ogImage: string): boolean => {
  const base = getDevImagePublicPath();
  if (!base) return true;

  const targets = new Set<string>();
  if (ogImage?.startsWith(base)) targets.add(ogImage);

  const escapedBase = escapeRegex(base);
  const regex = new RegExp(`!\\[[^\\]]*\\]\\((${escapedBase}[^)]+)\\)`, 'g');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    const url = match[1];
    if (url) targets.add(url);
  }

  for (const publicUrl of targets) {
    const fsPath = resolveDevFsPath(publicUrl);
    if (fsPath && !fssync.existsSync(fsPath)) {
      return false;
    }
  }

  return true;
};

/**
 * Markdown 内の画像をキャッシュに取り込み、参照を差し替える
 */
const processMarkdownImages = async (
  markdown: string,
): Promise<{ content: string; ogImage: string }> => {
  const matches = Array.from(markdown.matchAll(IMAGE_CAPTURE_REGEX));
  if (matches.length === 0) return { content: markdown, ogImage: OGP_IMAGE };

  const replacements = new Map<string, string>();
  let ogImage = OGP_IMAGE;

  for (const match of matches) {
    const originalUrl = match[1]?.trim();
    if (!originalUrl || replacements.has(originalUrl)) continue;

    if (!isHttpUrl(originalUrl)) {
      if (ogImage === OGP_IMAGE) ogImage = originalUrl;
      continue;
    }

    try {
      const { publicUrl } = await ensureImageCached(originalUrl, {
        format: IMAGE_FORMAT,
        quality: IMAGE_QUALITY,
      });

      replacements.set(originalUrl, publicUrl);
      if (ogImage === OGP_IMAGE) ogImage = publicUrl;
    } catch (error) {
      console.warn('Failed to cache Notion image:', error);
    }
  }

  let processed = markdown;

  replacements.forEach((replacement, original) => {
    processed = processed.replaceAll(`(${original})`, `(${replacement})`);
  });

  if (ogImage === OGP_IMAGE) {
    const fallback = matches
      .map(match => replacements.get(match[1]) ?? match[1])
      .find(Boolean);
    if (fallback) ogImage = fallback as string;
  }

  return { content: processed, ogImage };
};

/**
 * ページネーション処理の共通化
 */
const paginateQuery = async <T>(
  queryFn: (cursor?: string) => Promise<{ results: T[]; has_more: boolean; next_cursor?: string | null }>,
): Promise<T[]> => {
  const results: T[] = [];
  let cursor: string | undefined;

  while (true) {
    const resp = await queryFn(cursor);
    results.push(...resp.results);
    if (!resp.has_more || !resp.next_cursor) break;
    cursor = resp.next_cursor;
  }

  return results;
};

/**
 * DB構造をキャッシュ付きで取得
 */
const getDatabaseProperties = async (databaseId: string): Promise<DbProps> => {
  const cacheKey = makeCacheKey.dbProps(databaseId);
  const cached = await getCache<DbProps>(cacheKey);

  if (cached && isTTLValid(cached.cachedAt, TTL.dbProps)) {
    return cached.value;
  }

  try {
    const dbInfo = await notion.databases.retrieve({ database_id: databaseId });
    const properties = ((dbInfo as { properties?: DbProps }).properties ?? {}) as DbProps;
    await setCache(cacheKey, { value: properties, cachedAt: Date.now() });
    return properties;
  } catch (error) {
    console.warn('Failed to get database properties:', error);
    return cached?.value || {};
  }
};

/**
 * 削除されたページのキャッシュをクリーンアップ
 */
const cleanupRemovedPages = async (removedIds: string[]): Promise<void> => {
  if (removedIds.length === 0) return;

  const isProduction = import.meta.env.MODE === 'production';

  await Promise.all(
    removedIds.map(pageId => deleteCache(makeCacheKey.page(pageId, isProduction))),
  );

  console.log(`Cleaned up caches for ${removedIds.length} removed/unpublished page(s)`);
};

// Asia/Tokyo の現在日付（YYYY-MM-DD）。publish フィルタの基準に使う
const getTokyoToday = (): string =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

// 複数フィルタを Notion クエリの filter 形式へまとめる
const combineFilters = (filters: any[]) =>
  filters.length === 1 ? filters[0] : { and: filters };

/**
 * 最新の編集時刻を取得
 */
const getMaxEditedTime = (pages: Array<{ last_edited_time?: string }>): string =>
  pages
    .map(p => p.last_edited_time)
    .filter(Boolean)
    .sort()
    .pop() ?? '';

/**
 * DB 構造を参照して published/publish/types のフィルタ条件を作成
 */
const buildListFilters = (
  dbProps: DbProps,
  options?: { types?: string[] },
): any[] => {
  const { types } = options || {};
  const filters: any[] = [];

  // published が true のものだけ取得
  if (dbProps?.published?.type === 'checkbox') {
    filters.push({ property: 'published', checkbox: { equals: true } });
  }

  // publish が現在日付以前のものを取得
  if (dbProps?.publish?.type === 'date') {
    filters.push({ property: 'publish', date: { on_or_before: getTokyoToday() } });
  }

  // types フィルタ
  if (types && dbProps?.types?.type === 'select') {
    const orFilters = types.map(type => ({ property: 'types', select: { equals: type } }));
    filters.push({ or: orFilters });
  }

  return filters;
};

/**
 * ページがフィルタ条件に一致するかを評価
 */
const doesPageMatchFilters = (
  page: PageObjectResponse,
  dbProps: DbProps,
  options?: { types?: string[] },
): boolean => {
  const properties = page.properties;

  // published が true かチェック
  if (dbProps?.published?.type === 'checkbox') {
    if (!getCheckbox(properties.published)) return false;
  }

  // publish が現在日付以前かチェック
  if (dbProps?.publish?.type === 'date') {
    const publishDate = getDate(properties.publish);
    if (publishDate && publishDate > getTokyoToday()) return false;
  }

  // types フィルタ
  if (options?.types && dbProps?.types?.type === 'select') {
    const typeVal = getSelect(properties.types);
    if (!options.types.includes(typeVal)) return false;
  }

  return true;
};

/**
 * Notion ページを NotionRecord オブジェクトへ整形
 * 注意: 画像は外部から渡される
 */
const pageToNotionRecord = (
  { id, properties }: PageObjectResponse,
  ogImage?: string,
): NotionRecord => {
  const record: Partial<NotionRecord> = {
    id,

    // Portfolio
    slug: getRichText(properties.slug),
    types: getSelect(properties.types),
    title: getTitle(properties.title),
    summary: getRichText(properties.summary),
    category: getSelect(properties.category),
    tags: getMultiSelect(properties.tags),
    link: getUrl(properties.link),
    year: getNumber(properties.year),
    event: getDate(properties.event),
    publish: getDate(properties.publish),
    updated: getLastEdited(properties.updated),
    published: getCheckbox(properties.published),
    image: ogImage ?? OGP_IMAGE,

    // Skills
    subcategory: getSelect(properties.subcategory),
    name: getTitle(properties.name),
    icon: getRichText(properties.icon),

    // Certifications
    date: getDate(properties.date),
    mark: getCheckbox(properties.mark),

    // EducationCareer
    start: getDate(properties.start),
    end: getDate(properties.end),
    dept_prog: getRichText(properties.dept_prog),

    // SocialLinks
    color: getRichText(properties.color),
  };

  // 空の値を除去
  const cleaned = Object.fromEntries(
    Object.entries(record).filter(([key, value]) => {
      if (key === 'id') return true; // idは必須
      if (value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (key === 'published' && value === true) return false;
      return true;
    }),
  );

  return cleaned as unknown as NotionRecord;
};

/**
 * Notion ページを Markdown 文字列として取得し、画像をキャッシュ
 */
export const fetchNotionPage = async (
  pageId: string,
): Promise<{ content: string; ogImage: string } | null> => {
  const isProduction = import.meta.env.MODE === 'production';
  const cacheKey = makeCacheKey.page(pageId, isProduction);
  const cached = await getCache<{ content: string; ogImage: string }>(cacheKey);

  const ttl = isProduction ? TTL.list : TTL.devPage;
  const assetsReady = !cached || isProduction || devAssetsAvailable(cached.value.content, cached.value.ogImage);

  if (cached && assetsReady && isTTLValid(cached.cachedAt, ttl)) {
    return cached.value;
  }

  let pageMeta: { last_edited_time?: string } | null = null;
  try {
    pageMeta = (await notion.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
  } catch (error) {
    if (cached && assetsReady) {
      console.warn('Failed to retrieve page metadata, using cached content:', error);
      return cached.value;
    }
    console.error('Failed to retrieve page metadata:', error);
    return null;
  }

  if (
    cached &&
    assetsReady &&
    pageMeta?.last_edited_time &&
    cached.lastChange === pageMeta.last_edited_time
  ) {
    await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
    return cached.value;
  }

  try {
    const n2m = new NotionConverter(notion).withRenderer(renderer);
    n2m.useDirectStrategy();

    const { content } = await n2m.convert(pageId);
    const processed = await processMarkdownImages(content);

    const result = {
      content: processed.content,
      ogImage: processed.ogImage || OGP_IMAGE,
    };

    await setCache(cacheKey, {
      value: result,
      lastChange: pageMeta?.last_edited_time ?? undefined,
      cachedAt: Date.now(),
    });

    return result;
  } catch (error) {
    console.error('Error fetching page from Notion:', error);

    if (cached && assetsReady) {
      console.warn('Falling back to cached page content due to error.');
      return cached.value;
    }

    return null;
  }
};

/**
 * Notion データベースからページ一覧を取得し、キャッシュを更新
 */
export const fetchNotionPageList = async (
  databaseId: string,
  options?: ListOptions,
): Promise<NotionRecord[]> => {
  if (!databaseId) {
    throw new Error('databaseId is not defined in the environment variables.');
  }

  const { sorts } = options || {};
  const isProduction = import.meta.env.MODE === 'production';
  const listCacheTtl = isProduction ? TTL.list : TTL.devPage;

  const cacheKey = makeCacheKey.list(databaseId, { ...(options || {}), sorts });
  const cached = await getCache<NotionRecord[]>(cacheKey);

  // キャッシュが有効ならそのまま返す
  if (cached && isTTLValid(cached.cachedAt, listCacheTtl)) {
    return cached.value;
  }

  // DB構造を取得（キャッシュ付き）
  const dbProps = await getDatabaseProperties(databaseId);
  const filters = buildListFilters(dbProps, options);

  // キャッシュがある場合は変更検知を試みる
  if (cached) {
    try {
      const hasChanges = await checkForDatabaseChanges(databaseId, cached.lastChange);

      if (!hasChanges) {
        // 削除されたページを検出
        const currentIds = await fetchCurrentPageIds(databaseId, filters);
        const cachedIds = cached.value.map(r => r.id);
        const removedIds = cachedIds.filter(id => !currentIds.has(id));

        if (removedIds.length > 0) {
          await cleanupRemovedPages(removedIds);
          const updatedValue = cached.value.filter(r => !removedIds.includes(r.id));
          await setCache(cacheKey, { value: updatedValue, lastChange: cached.lastChange, cachedAt: Date.now() });
          return updatedValue;
        }

        await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
        return cached.value;
      }

      // 変更があった場合、部分更新を試みる
      const changedIds = await listChangedPageIds(databaseId, cached.lastChange ?? '');
      const CHANGED_THRESHOLD = 100;
      const requiresFullSort = (sorts || []).some(sort => 'timestamp' in sort);

      if (changedIds.length > 0 && changedIds.length <= CHANGED_THRESHOLD && !requiresFullSort) {
        return await partialUpdate(
          databaseId,
          cached,
          changedIds,
          dbProps,
          options,
          sorts,
          cacheKey,
        );
      }
    } catch (error) {
      // エラー時はキャッシュを延長して返す
      await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
      return cached.value;
    }
  }

  // フル取得
  return await fullFetch(databaseId, filters, sorts, cacheKey, cached?.value);
};

/**
 * データベースの変更を検知
 */
const checkForDatabaseChanges = async (
  databaseId: string,
  sinceISO?: string,
): Promise<boolean> => {
  if (!sinceISO) return true;

  const resp = await notion.databases.query({
    database_id: databaseId,
    page_size: 1,
    filter: { timestamp: 'last_edited_time', last_edited_time: { after: sinceISO } } as any,
  });

  return resp.results.length > 0;
};

/**
 * 現在のページID一覧を取得
 */
const fetchCurrentPageIds = async (
  databaseId: string,
  filters: any[],
): Promise<Set<string>> => {
  const pages = await paginateQuery(cursor =>
    notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      ...(filters.length > 0 && {
        filter: combineFilters(filters),
      }),
    }),
  );

  return new Set(pages.map(p => p.id));
};

/**
 * 指定時刻以降に更新されたページIDを列挙
 */
const listChangedPageIds = async (
  databaseId: string,
  sinceISO: string,
): Promise<string[]> => {
  if (!sinceISO) return [];

  const pages = await paginateQuery(cursor =>
    notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      filter: { timestamp: 'last_edited_time', last_edited_time: { after: sinceISO } } as any,
    }),
  );

  return [...new Set(pages.map(p => p.id))];
};

/**
 * 部分更新
 */
const partialUpdate = async (
  _databaseId: string,
  cached: { value: NotionRecord[]; lastChange?: string; cachedAt: number },
  changedIds: string[],
  dbProps: DbProps,
  options: { types?: string[] } | undefined,
  sorts: ListOptions['sorts'],
  cacheKey: string,
): Promise<NotionRecord[]> => {
  const byId = new Map<string, NotionRecord>(cached.value.map(r => [r.id, r]));
  let maxEdited = cached.lastChange ?? '';
  const removedIds: string[] = [];

  // 変更されたページを個別に取得・評価
  await Promise.all(
    changedIds.map(async id => {
      try {
        const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
        const lastEdited = page.last_edited_time;
        if (lastEdited && lastEdited > maxEdited) maxEdited = lastEdited;

        if (doesPageMatchFilters(page, dbProps, options)) {
          const pageContent = await fetchNotionPage(id);
          const record = pageToNotionRecord(page, pageContent?.ogImage);
          byId.set(record.id, record);
        } else {
          byId.delete(id);
          removedIds.push(id);
        }
      } catch {
        byId.delete(id);
        removedIds.push(id);
      }
    }),
  );

  if (removedIds.length > 0) {
    await cleanupRemovedPages(removedIds);
  }

  let merged = Array.from(byId.values());

  // ソート
  if (sorts && sorts.length > 0) {
    for (const sort of sorts.slice().reverse()) {
      const direction = sort.direction === 'ascending' ? 1 : -1;
      if ('property' in sort) {
        const prop = sort.property as keyof NotionRecord;
        merged = merged.sort((a, b) =>
          (a[prop] ?? '') > (b[prop] ?? '') ? direction : -direction,
        );
      }
    }
  }

  await setCache(cacheKey, { value: merged, lastChange: maxEdited, cachedAt: Date.now() });
  return merged;
};

/**
 * フル取得
 */
const fullFetch = async (
  databaseId: string,
  filters: any[],
  sorts: ListOptions['sorts'],
  cacheKey: string,
  oldRecords?: NotionRecord[],
): Promise<NotionRecord[]> => {
  const queryOptions: any = { database_id: databaseId, page_size: 100 };

  if (filters.length > 0) {
    queryOptions.filter = combineFilters(filters);
  }
  if (sorts && sorts.length > 0) {
    queryOptions.sorts = sorts;
  }

  const pages = await paginateQuery(cursor =>
    notion.databases.query({ ...queryOptions, start_cursor: cursor }),
  );

  const maxEdited = getMaxEditedTime(pages as Array<{ last_edited_time?: string }>);

  // 並列でページコンテンツを取得
  const pageContents = await Promise.all(
    pages.map(async page => {
      const content = await fetchNotionPage(page.id);
      return { id: page.id, ogImage: content?.ogImage };
    }),
  );

  const imageMap = new Map(pageContents.map(p => [p.id, p.ogImage]));
  const records = pages.map(page =>
    pageToNotionRecord(page as PageObjectResponse, imageMap.get(page.id)),
  );

  // 古いキャッシュとの差分で削除されたページをクリーンアップ
  if (oldRecords) {
    const oldIds = oldRecords.map(r => r.id);
    const newIds = records.map(r => r.id);
    const removedIds = oldIds.filter(id => !newIds.includes(id));
    await cleanupRemovedPages(removedIds);
  }

  await setCache(cacheKey, { value: records, lastChange: maxEdited, cachedAt: Date.now() });
  return records;
};

/**
 * Notion のページ配列からタグ一覧を生成
 */
export const buildTagsFromPages = (pages: NotionRecord[]): Tag[] => {
  const counts = new Map<string, Tag>();

  for (const page of pages) {
    // tags
    for (const tag of page.tags ?? []) {
      if (!tag.name) continue;

      const name = tag.name.trim();
      if (!name) continue;

      const id = normalizeTagName(name);
      counts.set(id, { id, name, count: (counts.get(id)?.count ?? 0) + 1 });
    }

    // category
    if (page.category) {
      const name = page.category.trim();

      if (name) {
        const id = normalizeTagName(name);
        counts.set(id, { id, name, count: (counts.get(id)?.count ?? 0) + 1 });
      }
    }
  }

  // 出現回数が多い順、同じなら名前の辞書順
  const sorted = [...counts.values()].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name),
  );
  const allTag: Tag = { id: 'all', name: 'すべて', count: pages.length };

  return [allTag, ...sorted];
};

const PORTFOLIO_DATABASE_ID = import.meta.env.PORTFOLIO_DATABASE_ID;

// 作品一覧（作品・記事）を制作日の降順で取得
export const fetchWorks = (): Promise<NotionRecord[]> =>
  fetchNotionPageList(PORTFOLIO_DATABASE_ID, {
    types: ['作品', '記事'],
    sorts: [{ property: 'event', direction: 'descending' }],
  });

// 活動一覧を実施日の降順で取得
export const fetchActivities = (): Promise<NotionRecord[]> =>
  fetchNotionPageList(PORTFOLIO_DATABASE_ID, {
    types: ['活動'],
    sorts: [{ property: 'event', direction: 'descending' }],
  });
