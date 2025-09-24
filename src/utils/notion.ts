import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionConverter } from 'notion-to-md';
import { MDXRenderer } from 'notion-to-md/plugins/renderer';
import * as path from 'path';
import * as fs from 'fs/promises';

import { OGP_IMAGE } from '@/constants';
import type { NotionRecord, Tag } from '@/types';

const OUTPUT_DIR = './dist/_astro';
const ASTRO_DIR = '/_astro';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const renderer = new MDXRenderer();

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
    sorts?: Array<{
      property: string;
      direction: 'ascending' | 'descending';
    }>;
  }
): Promise<NotionRecord[]> => {

  if (!databaseId) {
    throw new Error('databaseId is not defined in the environment variables.');
  }

  // 開発環境の場合はモックデータを返す
  if (import.meta.env.MODE !== 'production') {
    const mockData: NotionRecord[] = [
      {
        id: 'mock-1',
        slug: 'sample-project',
        types: 'Portfolio',
        title: 'Sample Project',
        summary: 'This is a sample project for development.',
        category: 'プログラミング',
        tags: [{ id: 'tag-1', name: 'JavaScript' }, { id: 'tag-2', name: 'React' }],
        link: 'https://example.com',
        year: '2023',
        event: '2023-01-01',
        publish: '2023-01-01',
        updated: '2023-01-01T00:00:00.000Z',
        published: true,
        image: 'https://placehold.jp/1280x720.png',
        source: 'Tech News',
        date: '2023-06-15',
        subcategory: 'Programming Languages',
        name: 'VScode',
        icon: 'local:home',
        color: '#f7df1e',
        description: 'VScode programming language',
        mark: true,
        dept_prog: 'Computer Science',
        start: '2019-09-01',
        end: '2023-06-30',
      },
    ];

    return mockData;
  }

  const { types, sorts } = options || {};
  const filters: any[] = [];

  try {
    const dbInfo = await notion.databases.retrieve({ database_id: databaseId });
    const properties = dbInfo.properties;

    // publishedプロパティが存在する場合のみフィルタに追加
    if (properties.published && properties.published.type === 'checkbox') {
      filters.push({
        property: 'published',
        checkbox: {
          equals: true,
        },
      });
    }

    // typesプロパティが存在し、かつtypesが指定されている場合のみフィルタに追加
    if (types && properties.types && properties.types.type === 'select') {
      filters.push({
        property: 'types',
        select: {
          equals: types,
        },
      });
    }
  } catch (error) {
    console.warn('Database structure check failed, proceeding without filters:', error);
  }

  const queryOptions: any = { database_id: databaseId };
  
  // フィルタが存在する場合のみfilterを追加
  if (filters.length > 0) {
    queryOptions.filter = filters.length === 1 ? filters[0] : { and: filters };
  }

  // ソートが指定されている場合のみsortsを追加
  if (sorts && sorts.length > 0) {
    queryOptions.sorts = sorts;
  }

  const response = await notion.databases.query(queryOptions);

  return Promise.all(response.results.map(page => pageToNotionRecord(page as PageObjectResponse)));
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

    if (isProduction) {

      // 本番環境：画像をダウンロード
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      n2m.downloadMediaTo({
        outputDir: OUTPUT_DIR,
        transformPath: (local) => {
          const filename = `${path.parse(local).name}.webp`;
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

    return { content, ogImage };
  } catch (error) {
    console.error('Error fetching page from Notion:', error);
    return null;
  }
};
