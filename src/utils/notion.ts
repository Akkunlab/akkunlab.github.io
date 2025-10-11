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

    // MediaCoverage
    source: getRichText(properties.source),
    date: getDate(properties.date),

    // Skills / SocialLinks
    subcategory: getSelect(properties.subcategory),
    name: getTitle(properties.name),
    icon: getRichText(properties.icon),
    color: getRichText(properties.color),

    // Certifications
    description: getRichText(properties.description),
    mark: getCheckbox(properties.mark),

    // EducationCareer
    dept_prog: getRichText(properties.dept_prog),
    start: getDate(properties.start),
    end: getDate(properties.end),
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
  options?: { types?: string }
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
      filters.push({ property: 'types', select: { equals: types } });
    }
  } catch (error) {
    console.warn('Database structure check failed, proceeding without filters:', error);
  }
  return filters;
};

// last_edited_time を用いた軽量なデータベース変更検知
const hasDatabaseChangedSince = async (
  databaseId: string,
  sinceISO: string,
  baseFilters: any[]
): Promise<boolean> => {

  // タイムスタンプがなければ初回取得として変更あり扱い
  if (!sinceISO) return true;

  const changeFilter = { timestamp: 'last_edited_time', last_edited_time: { after: sinceISO } } as const;
  const filter = baseFilters.length > 0 ? { and: [...baseFilters, changeFilter] } : changeFilter;

  try {
    const resp = await notion.databases.query({ database_id: databaseId, page_size: 1, filter: filter as any });
    return resp.results.length > 0;
  } catch (error) {
    console.warn('Change detection failed for database:', error);
    throw error;
  }
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
    types?: string;
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

  // 検証や再取得が必要になった時のみフィルタを組み立て
  const filters = await buildListFilters(databaseId, options);

  // TTL切れ後に変更検知、未変更なら cachedAt を更新して返却
  if (cached) {
    try {
      const changed = await hasDatabaseChangedSince(databaseId, cached.lastChange ?? '', filters);
      if (!changed) {
        await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
        return cached.value;
      }
    } catch (e) {
      await setCache(cacheKey, { ...cached, cachedAt: Date.now() });
      return cached.value;
    }
  }

  // 変更がある場合、またはキャッシュが無い場合のみ最新データを取得
  const queryOptions: any = { database_id: databaseId };

  if (filters.length > 0) {
    queryOptions.filter = filters.length === 1 ? filters[0] : { and: filters };
  }
  if (sorts && sorts.length > 0) {
    queryOptions.sorts = sorts;
  }

  const response = await notion.databases.query(queryOptions);

  // 取得結果の last_edited_time の最大を追跡用に保存
  const maxEdited = response.results
    .map((r: any) => r.last_edited_time as string | undefined)
    .filter(Boolean)
    .sort()
    .pop() ?? '';

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
