import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionConverter } from 'notion-to-md';
import { MDXRenderer } from 'notion-to-md/plugins/renderer';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fssync from 'fs';
import { getCache, setCache, isTTLValid } from './cache';

import { IMAGE_FORMAT, OGP_IMAGE } from '@/constants';
import type { NotionRecord, Tag } from '@/types';

const OUTPUT_DIR = './dist/_astro';
const ASTRO_DIR = '/_astro';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const renderer = new MDXRenderer();

const makeListCacheKey = (databaseId: string, options?: any) => `notion:list:${databaseId}:${JSON.stringify(options ?? {})}`;
const makePageCacheKey = (pageId: string, isProduction: boolean) => `notion:page:${pageId}:${isProduction ? 'prod' : 'dev'}`;

/* ヘルパー */
const getProperty = <T>(property: any, type: string, fallback: T, extract: (prop: any) => T): T =>
  property?.type === type ? extract(property) : fallback;

const getRichText = (p: any) => getProperty(p, 'rich_text', '', prop => prop.rich_text[0]?.plain_text || '');
const getSelect = (p: any) => getProperty(p, 'select', '', prop => prop.select?.name || '');
const getTitle = (p: any) => getProperty(p, 'title', '', prop => prop.title[0]?.plain_text || '');
const getMultiSelect = (p: any) => getProperty(p, 'multi_select', [], prop => prop.multi_select.map((tag: Tag) => ({ id: tag.id, name: tag.name })));
const getNumber = (p: any) => getProperty(p, 'number', '', prop => prop.number?.toString() || '');
const getUrl = (p: any) => getProperty(p, 'url', '', prop => prop.url || '');
const getDate = (p: any) => getProperty(p, 'date', '', prop => prop.date?.start || '');
const getCheckbox = (p: any) => getProperty(p, 'checkbox', false, prop => prop.checkbox === true);
const getLastEdited = (p: any) => getProperty(p, 'last_edited_time', '', prop => prop.last_edited_time);

/**
 * 空段落なら &nbsp; を返す
 */
renderer.createBlockTransformer('paragraph', {
  transform: async ({ block, utils }) => {
    if (block.paragraph.rich_text.length === 0) return '&nbsp;\n';

    const text = await utils.transformRichText(block.paragraph.rich_text);

    return `${text}\n\n`;
  },
});

/**
 * ページをNotionRecordオブジェクトに変換
 * @param page Notionページ
 * @returns NotionRecordオブジェクト
 */
const pageToNotionRecord = async (
  { id, properties }: PageObjectResponse
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
    Object.entries(record).filter(([key, v]) => {
      if (v === undefined) return false;                    // undefined
      if (v === "") return false;                           // 空文字
      if (Array.isArray(v) && v.length === 0) return false; // 空配列
      if (key === "published" && v === true) return false;  // published=true は削除
      return true;
    })
  ) as Partial<NotionRecord>;

  return cleanedRecord as NotionRecord;
};

// DB構造を見て published/types のフィルタを作成
const buildListFilters = async (
  databaseId: string,
  options?: { types?: string[] }
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
      const orFilters = types.map(t => ({ property: 'types', select: { equals: t } }));
      filters.push({ or: orFilters });
    }
  } catch (error) {
    console.warn('Database structure check failed, proceeding without filters:', error);
  }
  return filters;
};

// last_edited_time を用いたデータベース変更検知
const hasDatabaseChangedSince = async (
  databaseId: string,
  sinceISO: string
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
 * 変更のあったページIDを取得
 * @param databaseId 
 * @param sinceISO 
 * @returns 変更のあったページIDのリスト
 */
const listChangedPageIdsSince = async (
  databaseId: string,
  sinceISO: string
): Promise<string[]> => {
  if (!sinceISO) return [];

  const changedIds: string[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const resp = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      filter: { timestamp: 'last_edited_time', last_edited_time: { after: sinceISO } } as any,
    });

    for (const r of resp.results as any[]) {
      if (r?.id) changedIds.push(r.id);
    }

    if (!resp.has_more || !resp.next_cursor) break;
  
    cursor = resp.next_cursor as string;
  }

  return Array.from(new Set(changedIds));
};

/**
 * ページが現在のフィルタにマッチするかを評価
 * @param page 
 * @param options 
 * @param dbProps 
 * @returns true: マッチ, false: マッチしない
 */
const doesPageMatchFilters = (page: any, options?: { types?: string[] }, dbProps?: any): boolean => {
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
 * Notionデータベースからページのリストを取得（publishedプロパティがある場合はtrueのみ取得）
 * @param databaseId - 対象のNotionデータベースID
 * @param options - オプション設定
 * @param options.types - フィルタリングするタイプ（typesプロパティが存在する場合のみ適用）
 * @param options.sorts - ソート設定の配列
 * @returns Notionページのリスト
 */
export const fetchNotionPageList = async (
  databaseId: string, 
  options?: {
    types?: string[];
    sorts?: Array<(
      | { property: string }
      | { timestamp: 'created_time' | 'last_edited_time' }
    ) & { direction: 'ascending' | 'descending' }>;
  }
): Promise<NotionRecord[]> => {

  if (!databaseId) {
    throw new Error('databaseId is not defined in the environment variables.');
  }

  const { sorts } = options || {};

  // このリスト用のキャッシュキー
  const cacheKey = makeListCacheKey(databaseId, { ...(options || {}), sorts });
  const cached = await getCache<NotionRecord[]>(cacheKey);

  // TTL内のキャッシュがあればAPIを叩かず即返却
  if (cached && isTTLValid(cached.cachedAt)) return cached.value;

  // データベースのプロパティ情報を先に取得
  let dbProps: any = null;
  try {
    const dbInfo = await notion.databases.retrieve({ database_id: databaseId });
    dbProps = (dbInfo as any).properties || {};
  } catch (error) {
    console.warn('Failed to get database properties:', error);
  }

  // TTL切れ後に変更検知、未変更なら cachedAt を更新して返却
  if (cached) {
    try {
      const changed = await hasDatabaseChangedSince(databaseId, cached.lastChange ?? '');

      if (!changed) {
        await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
        return cached.value;
      }

      // 変更のあったページID一覧
      const changedIds = await listChangedPageIdsSince(databaseId, cached.lastChange ?? '');

      if (changedIds.length === 0) {
        await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
        return cached.value;
      }

      // タイムスタンプソートが要求される場合はフル再取得
      const requiresFullSort = (sorts || []).some((s) => 'timestamp' in s);

      // 変更件数が大きすぎる場合はフル再取得に切り替え
      const CHANGED_THRESHOLD = 100;

      if (changedIds.length > CHANGED_THRESHOLD || requiresFullSort) {
        // フル再取得
        const filters = await buildListFilters(databaseId, options);
        const queryOptions: any = { database_id: databaseId };

        if (filters.length > 0) queryOptions.filter = filters.length === 1 ? filters[0] : { and: filters };
        if (sorts && sorts.length > 0) queryOptions.sorts = sorts;

        const response = await notion.databases.query(queryOptions);
        const maxEdited = response.results.map((r: any) => r.last_edited_time as string | undefined).filter(Boolean).sort().pop() ?? '';
        const records = await Promise.all(response.results.map(page => pageToNotionRecord(page as PageObjectResponse)));
       
        await setCache(cacheKey, { value: records, lastChange: maxEdited, cachedAt: Date.now() });

        return records;
      }

      // 部分更新
      const byId = new Map<string, NotionRecord>();

      for (const r of cached.value) byId.set(r.id, r);

      let maxEdited = cached.lastChange ?? '';

      for (const id of changedIds) {
        try {
          const p = (await notion.pages.retrieve({ page_id: id })) as any;
          const lastEdited = p.last_edited_time as string | undefined;
          if (lastEdited && lastEdited > maxEdited) maxEdited = lastEdited;

          if (doesPageMatchFilters(p, options, dbProps)) {
            const rec = await pageToNotionRecord(p as PageObjectResponse);
            byId.set(rec.id, rec);
          } else {
            byId.delete(id);
          }
        } catch (e) {
          // 取得失敗時はスキップ
        }
      }

      // ソート適用
      let merged = Array.from(byId.values());

      if (sorts && sorts.length > 0) {
        for (const s of sorts.slice().reverse()) {
          const dir = s.direction === 'ascending' ? 1 : -1;
          if ('property' in s) {
            const prop = s.property;
            merged = merged.sort((a: any, b: any) => ((a as any)[prop] ?? '') > ((b as any)[prop] ?? '') ? dir : -dir);
          }
        }
      }

      await setCache(cacheKey, { value: merged, lastChange: maxEdited, cachedAt: Date.now() });

      return merged;
    } catch (e) {
      await setCache(cacheKey, { ...cached, cachedAt: Date.now() });

      return cached.value;
    }
  }

  // キャッシュが無い場合はフル取得
  const filters = await buildListFilters(databaseId, options);
  const queryOptions: any = { database_id: databaseId };

  if (filters.length > 0) queryOptions.filter = filters.length === 1 ? filters[0] : { and: filters };
  if (sorts && sorts.length > 0) queryOptions.sorts = sorts;

  const response = await notion.databases.query(queryOptions);
  const maxEdited = response.results.map((r: any) => r.last_edited_time as string | undefined).filter(Boolean).sort().pop() ?? '';
  const records = await Promise.all(response.results.map(page => pageToNotionRecord(page as PageObjectResponse)));

  await setCache(cacheKey, { value: records, lastChange: maxEdited, cachedAt: Date.now() });
  return records;
};

/**
 * 指定ページをMarkdown文字列で取得（本番環境は画像をダウンロード）
 * @param pageId - ページID
 * @returns ページのコンテンツとOGP画像URL
 */
export const fetchNotionPage = async (pageId: string): Promise<{ content: string; ogImage: string } | null> => {
  try {
    const n2m = new NotionConverter(notion).withRenderer(renderer);
    const isProduction = import.meta.env.MODE === 'production';
    let ogImage = OGP_IMAGE;

    // キャッシュ: まずページメタで更新有無を軽量チェック
    const cacheKey = makePageCacheKey(pageId, isProduction);
    const cached = await getCache<{ content: string; ogImage: string }>(cacheKey);

    // TTL内のキャッシュがあれば即返却
    if (cached && isTTLValid(cached.cachedAt)) {
      if (isProduction && cached.value.ogImage.startsWith(ASTRO_DIR)) {
        const filename = path.basename(cached.value.ogImage);
        const localPath = path.join(OUTPUT_DIR, filename);
        if (fssync.existsSync(localPath)) {
          return cached.value;
        }
      } else {
        return cached.value;
      }
    }

    let pageMeta: { last_edited_time?: string } | null = null;
    try {
      pageMeta = (await notion.pages.retrieve({ page_id: pageId })) as any;
    } catch (e) {
      if (cached && isTTLValid(cached.cachedAt)) return cached.value;
    }

    // 変更がなくキャッシュがあれば即返却
    if (cached && pageMeta?.last_edited_time && cached.lastChange === pageMeta.last_edited_time) {
      if (isProduction && cached.value.ogImage.startsWith(ASTRO_DIR)) {
        const filename = path.basename(cached.value.ogImage);
        const localPath = path.join(OUTPUT_DIR, filename);
        if (fssync.existsSync(localPath)) {
          await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
          return cached.value;
        }
      } else {
        await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
        return cached.value;
      }
    }

    if (isProduction) {

      // 本番環境：画像をダウンロード
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      n2m.downloadMediaTo({
        outputDir: OUTPUT_DIR,
        transformPath: (local) => {
          const filename = `${path.parse(local).name}.${IMAGE_FORMAT}`;
          ogImage = path.posix.join(ASTRO_DIR, filename);
          return ogImage;
        },
        preserveExternalUrls: true,
      });
    } else {

      // 開発環境：画像をダウンロードしない
      n2m.useDirectStrategy();
    }

    const { content } = await n2m.convert(pageId);

    // 開発環境の場合、コンテンツから最初の画像を取得
    if (!isProduction) ogImage = content.match(/!\[[^\]]*]\(([^)]+)\)/)?.[1] ?? OGP_IMAGE;

    const result = { content, ogImage };

    // 新しいコンテンツと最終変更時刻でキャッシュを更新
    const lastChange = (pageMeta?.last_edited_time as string) ?? undefined;

    await setCache(cacheKey, { value: result, lastChange, cachedAt: Date.now() });

    return result;
  } catch (error) {
    console.error('Error fetching page from Notion:', error);
    return null;
  }
};
