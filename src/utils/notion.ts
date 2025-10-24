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
  isTTLValid,
  getDevImageDirectory,
  getDevImagePublicPath,
} from './cache';
import { ensureImageCached } from './imageCache';
import { normalizeTagName } from './filterTags';
import { IMAGE_FORMAT, IMAGE_QUALITY, OGP_IMAGE } from '@/constants';
import type { NotionRecord, Tag } from '@/types';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const renderer = new MDXRenderer();

const makeListCacheKey = (databaseId: string, options?: any) =>
  `notion:list:${databaseId}:${JSON.stringify(options ?? {})}`;
const makePageCacheKey = (pageId: string, isProduction: boolean) =>
  `notion:page:${pageId}:${isProduction ? 'prod' : 'dev'}`;

const DEV_PAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const IMAGE_CAPTURE_REGEX = /!\[[^\]]*]\(([^)]+)\)/g;

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

/**
 * 開発環境でキャッシュした画像のローカルパスを要求
 * @param publicUrl 公開パス
 * @returns 実ファイルのパス（存在しない場合は null）
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
 * @param content Markdown 変換後の本文
 * @param ogImage OGP 画像のパス
 * @returns すべての画像が利用可能なら true
 */
const devAssetsAvailable = (content: string, ogImage: string): boolean => {
  const base = getDevImagePublicPath();
  if (!base) return true;

  const targets = new Set<string>();
  if (ogImage?.startsWith(base)) targets.add(ogImage);

  const escapedBase = escapeRegex(base);
  const regex = new RegExp(`!\[[^\]]*]\((${escapedBase}[^)]+)\)`, 'g');

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
 * @param markdown Markdown 文字列
 * @returns 変換後の本文と OGP 画像
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

/* ヘルパー関数 */
/**
 * Notion プロパティから安全に値を取り出す
 * @param property プロパティ本体
 * @param type 期待する型
 * @param fallback 取得できなかった場合の既定値
 * @param extract 実際に値を抜き出す処理
 * @returns 抽出した値
 */
const getProperty = <T>(property: any, type: string, fallback: T, extract: (prop: any) => T): T =>
  property?.type === type ? extract(property) : fallback;

const getRichText = (p: any) => getProperty(p, 'rich_text', '', prop => prop.rich_text[0]?.plain_text || '');
const getSelect = (p: any) => getProperty(p, 'select', '', prop => prop.select?.name || '');
const getTitle = (p: any) => getProperty(p, 'title', '', prop => prop.title[0]?.plain_text || '');
const getMultiSelect = (p: any) =>
  getProperty(p, 'multi_select', [], prop => prop.multi_select.map((tag: Tag) => ({ id: tag.id, name: tag.name })));
const getNumber = (p: any) => getProperty(p, 'number', '', prop => prop.number?.toString() || '');
const getUrl = (p: any) => getProperty(p, 'url', '', prop => prop.url || '');
const getDate = (p: any) => getProperty(p, 'date', '', prop => prop.date?.start || '');
const getCheckbox = (p: any) => getProperty(p, 'checkbox', false, prop => prop.checkbox === true);
const getLastEdited = (p: any) => getProperty(p, 'last_edited_time', '', prop => prop.last_edited_time);

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
 * Notion ページを NotionRecord オブジェクトへ整形
 * @param page Notion ページ
 * @returns NotionRecord オブジェクト
 */
const pageToNotionRecord = async (
  { id, properties }: PageObjectResponse,
): Promise<NotionRecord> => {
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
    image: (await fetchNotionPage(id))?.ogImage ?? OGP_IMAGE,

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

  const cleanedRecord = Object.fromEntries(
    Object.entries(record).filter(([key, value]) => {
      if (value === undefined) return false;
      if (value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (key === 'published' && value === true) return false;
      return true;
    }),
  ) as Partial<NotionRecord>;

  return cleanedRecord as NotionRecord;
};

/**
 * DB 構造を参照して published/types のフィルタ条件を作成
 */
const buildListFilters = async (
  databaseId: string,
  options?: { types?: string[] },
) => {
  const { types } = options || {};
  const filters: any[] = [];

  try {
    const dbInfo = await notion.databases.retrieve({ database_id: databaseId });
    const properties = (dbInfo as any).properties;

    if (properties?.published?.type === 'checkbox') {
      filters.push({ property: 'published', checkbox: { equals: true } });
    }
    if (types && properties?.types?.type === 'select') {
      const orFilters = types.map(type => ({ property: 'types', select: { equals: type } }));
      filters.push({ or: orFilters });
    }
  } catch (error) {
    console.warn('Database structure check failed, proceeding without filters:', error);
  }

  return filters;
};

/**
 * last_edited_time を利用してデータベースの変更を検知
 */
const hasDatabaseChangedSince = async (
  databaseId: string,
  sinceISO: string,
): Promise<boolean> => {
  if (!sinceISO) return true;

  try {
    const resp = await notion.databases.query({
      database_id: databaseId,
      page_size: 1,
      filter: { timestamp: 'last_edited_time', last_edited_time: { after: sinceISO } } as any,
    });
    return resp.results.length > 0;
  } catch (error) {
    console.warn('Change detection failed for database:', error);
    throw error;
  }
};

/**
 * 指定時刻以降に更新されたページ ID を列挙
 */
const listChangedPageIdsSince = async (
  databaseId: string,
  sinceISO: string,
): Promise<string[]> => {
  if (!sinceISO) return [];

  const changedIds: string[] = [];
  let cursor: string | undefined;

  while (true) {
    const resp = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      filter: { timestamp: 'last_edited_time', last_edited_time: { after: sinceISO } } as any,
    });

    for (const result of resp.results as any[]) {
      if (result?.id) changedIds.push(result.id);
    }

    if (!resp.has_more || !resp.next_cursor) break;
    cursor = resp.next_cursor as string;
  }

  return Array.from(new Set(changedIds));
};

/**
 * ページがフィルタ条件に一致するかを評価
 */
const doesPageMatchFilters = (
  page: any,
  options?: { types?: string[] },
  dbProps?: any,
): boolean => {
  const properties = page?.properties || {};

  if (dbProps?.published?.type === 'checkbox') {
    const published = getCheckbox(properties.published);
    if (!published) return false;
  }

  if (options?.types && dbProps?.types?.type === 'select') {
    const typeVal = getSelect(properties.types);
    if (!options.types.includes(typeVal)) return false;
  }

  return true;
};

/**
 * Notion データベースからページ一覧を取得し、キャッシュを更新
 */
export const fetchNotionPageList = async (
  databaseId: string,
  options?: {
    types?: string[];
    sorts?: Array<
      (
        | { property: string }
        | { timestamp: 'created_time' | 'last_edited_time' }
      ) & { direction: 'ascending' | 'descending' }
    >;
  },
): Promise<NotionRecord[]> => {
  if (!databaseId) {
    throw new Error('databaseId is not defined in the environment variables.');
  }

  const { sorts } = options || {};
  const isProduction = import.meta.env.MODE === 'production';
  const listCacheTtl = isProduction ? CACHE_TTL_MS : DEV_PAGE_CACHE_TTL_MS;

  const cacheKey = makeListCacheKey(databaseId, { ...(options || {}), sorts });
  const cached = await getCache<NotionRecord[]>(cacheKey);

  if (cached && isTTLValid(cached.cachedAt, listCacheTtl)) {
    return cached.value;
  }

  let dbProps: any = null;
  try {
    const dbInfo = await notion.databases.retrieve({ database_id: databaseId });
    dbProps = (dbInfo as any).properties || {};
  } catch (error) {
    console.warn('Failed to get database properties:', error);
  }

  if (cached) {
    try {
      const changed = await hasDatabaseChangedSince(databaseId, cached.lastChange ?? '');

      if (!changed) {
        await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
        return cached.value;
      }

      const changedIds = await listChangedPageIdsSince(databaseId, cached.lastChange ?? '');

      if (changedIds.length === 0) {
        await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
        return cached.value;
      }

      const requiresFullSort = (sorts || []).some(sort => 'timestamp' in sort);
      const CHANGED_THRESHOLD = 100;

      if (changedIds.length > CHANGED_THRESHOLD || requiresFullSort) {
        const filters = await buildListFilters(databaseId, options);
        const queryOptions: any = { database_id: databaseId };

        if (filters.length > 0) {
          queryOptions.filter = filters.length === 1 ? filters[0] : { and: filters };
        }
        if (sorts && sorts.length > 0) {
          queryOptions.sorts = sorts;
        }

        const response = await notion.databases.query(queryOptions);
        const maxEdited =
          response.results
            .map((r: any) => r.last_edited_time as string | undefined)
            .filter(Boolean)
            .sort()
            .pop() ?? '';
        const records = await Promise.all(response.results.map(page => pageToNotionRecord(page as PageObjectResponse)));

        await setCache(cacheKey, { value: records, lastChange: maxEdited, cachedAt: Date.now() });
        return records;
      }

      const byId = new Map<string, NotionRecord>();
      for (const record of cached.value) {
        byId.set(record.id, record);
      }

      let maxEdited = cached.lastChange ?? '';

      for (const id of changedIds) {
        try {
          const page = (await notion.pages.retrieve({ page_id: id })) as any;
          const lastEdited = page.last_edited_time as string | undefined;
          if (lastEdited && lastEdited > maxEdited) maxEdited = lastEdited;

          if (doesPageMatchFilters(page, options, dbProps)) {
            const record = await pageToNotionRecord(page as PageObjectResponse);
            byId.set(record.id, record);
          } else {
            byId.delete(id);
          }
        } catch (error) {
          // ページ取得に失敗した場合はスキップ
        }
      }

      let merged = Array.from(byId.values());

      if (sorts && sorts.length > 0) {
        for (const sort of sorts.slice().reverse()) {
          const direction = sort.direction === 'ascending' ? 1 : -1;
          if ('property' in sort) {
            const prop = sort.property;
            merged = merged.sort((a: any, b: any) => ((a as any)[prop] ?? '') > ((b as any)[prop] ?? '') ? direction : -direction);
          }
        }
      }

      await setCache(cacheKey, { value: merged, lastChange: maxEdited, cachedAt: Date.now() });
      return merged;
    } catch (error) {
      await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
      return cached.value;
    }
  }

  const filters = await buildListFilters(databaseId, options);
  const queryOptions: any = { database_id: databaseId };

  if (filters.length > 0) {
    queryOptions.filter = filters.length === 1 ? filters[0] : { and: filters };
  }
  if (sorts && sorts.length > 0) {
    queryOptions.sorts = sorts;
  }

  const response = await notion.databases.query(queryOptions);
  const maxEdited =
    response.results
      .map((r: any) => r.last_edited_time as string | undefined)
      .filter(Boolean)
      .sort()
      .pop() ?? '';
  const records = await Promise.all(response.results.map(page => pageToNotionRecord(page as PageObjectResponse)));

  await setCache(cacheKey, { value: records, lastChange: maxEdited, cachedAt: Date.now() });
  return records;
};

/**
 * Notion ページを Markdown 文字列として取得し、画像をキャッシュ
 * @param pageId ページ ID
 * @returns ページ本文と OGP 画像
 */
export const fetchNotionPage = async (
  pageId: string,
): Promise<{ content: string; ogImage: string } | null> => {
  const isProduction = import.meta.env.MODE === 'production';
  const cacheKey = makePageCacheKey(pageId, isProduction);
  const cached = await getCache<{ content: string; ogImage: string }>(cacheKey);

  const ttl = isProduction ? CACHE_TTL_MS : DEV_PAGE_CACHE_TTL_MS;
  const assetsReady = !cached || isProduction || devAssetsAvailable(cached.value.content, cached.value.ogImage);

  if (cached && assetsReady && isTTLValid(cached.cachedAt, ttl)) {
    return cached.value;
  }

  let pageMeta: { last_edited_time?: string } | null = null;
  try {
    pageMeta = (await notion.pages.retrieve({ page_id: pageId })) as any;
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
 * Notion のページ配列からタグ一覧を生成
 * @param pages Notion から取得したページ配列
 * @returns 使用回数の多い順にソートされたタグ配列
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
      counts.set(id, {id, name, count: (counts.get(id)?.count ?? 0) + 1});
    }

    // category
    if (page.category) {
      const name = page.category.trim();

      if (name) {
        const id = normalizeTagName(name);
        counts.set(id, {id, name, count: (counts.get(id)?.count ?? 0) + 1});
      }
    }
  }

  // 出現回数が多い順、同じなら名前の辞書順
  const sorted = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
  const allTag: Tag = { id: 'all', name: 'All', count: pages.length };

  return [allTag, ...sorted];
};
