import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionConverter } from 'notion-to-md';
import { MDXRenderer } from 'notion-to-md/plugins/renderer';
import * as path from 'path';
import * as fs from 'fs/promises';

import { OGP_IMAGE } from '@/constants';
import type { NotionRecord, Tag } from '@/types';

const DATABASE_ID = import.meta.env.DATABASE_ID;
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

/**
 * 指定ページの最初の画像を取得
 * @param pageId - ページID
 * @returns 画像URL（本番環境は変換されたパス、開発環境では元のURL）
 */
const getImage = async (pageId: string): Promise<string> => {
  try {
    await notion.pages.retrieve({ page_id: pageId });

    // 先頭50ブロック内で最初の画像を探す
    const { results } = await notion.blocks.children.list({ block_id: pageId, page_size: 50 });
    const url = (results.find((b: any) => b.type === 'image' && b.image?.type === 'file') as any)?.image?.file?.url;

    // 画像が見つからない場合はOGP画像を返す
    if (!url) return OGP_IMAGE;

    // 本番環境では画像を変換して保存
    if (import.meta.env.PROD) {
      const filename = `${path.parse(new URL(url).pathname).name}.webp`;
      return path.posix.join(ASTRO_DIR, filename);
    }

    // 開発環境では元のURLを返す
    return url;
  } catch (err) {
    console.error('Notion image fetch error:', err);

    return OGP_IMAGE;
  }
};

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
const pageToNotionRecord = async ({ id, properties }: PageObjectResponse): Promise<NotionRecord> => {
  const { slug, types, title, summary, tags, year, link, publication, category, published } = properties;

  return {
    id,
    slug: getRichText(slug),
    types: getSelect(types),
    title: getTitle(title),
    summary: getRichText(summary),
    tags: getMultiSelect(tags),
    year: getNumber(year),
    link: getUrl(link),
    publication: getDate(publication),
    image: await getImage(id),
    category: getSelect(category),
    published: getCheckbox(published),
  };
};

/**
 * NotionデータベースからPublishedがtrueのページのリストを取得
 * @param types - フィルタリングするタイプ
 * @returns Notionページのリスト
 */
export const fetchNotionPageList = async (types?: string): Promise<NotionRecord[]> => {
  if (!DATABASE_ID) {
    throw new Error('DATABASE_ID is not defined in the environment variables.');
  }

  // フィルタ条件を構築
  const filters: any[] = [
    {
      property: 'published',
      checkbox: {
        equals: true,
      },
    },
  ];

  // typesが指定されている場合はフィルタに追加
  if (types) {
    filters.push({
      property: 'types',
      select: {
        equals: types,
      },
    });
  }

  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: filters,
    },
  });

  return Promise.all(response.results.map(page => pageToNotionRecord(page as PageObjectResponse)));
};

/**
 * 指定ページをMarkdown文字列で取得（本番環境は画像をダウンロード）
 * @param pageId - ページID
 * @returns Markdown文字列
 */
export const fetchNotionPage = async (pageId: string): Promise<string | null> => {
  try {
    const n2m = new NotionConverter(notion).withRenderer(renderer);
    
    if (import.meta.env.MODE === 'production') {

      // 本番環境では画像をダウンロード
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      n2m.downloadMediaTo({
        outputDir: OUTPUT_DIR,
        transformPath: (local) => {
          const filename = `${path.parse(local).name}.webp`;
          return path.posix.join(ASTRO_DIR, filename);
        },
        preserveExternalUrls: true,
      });
    } else {

      // 開発環境では画像をダウンロードしない
      n2m.useDirectStrategy();
    }

    const { content } = await n2m.convert(pageId);

    return content;
  } catch (error) {
    console.error('Error fetching page from Notion:', error);

    return null;
  }
};
