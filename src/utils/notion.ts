import type { NotionRecord, Tag } from '@/types';
import { Client } from '@notionhq/client';
import type { BlockObjectResponse, PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionToMarkdown } from 'notion-to-md';
import type { ListBlockChildrenResponseResult } from 'notion-to-md/build/types';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const databaseId = import.meta.env.DATABASE_ID;
const n2m = new NotionToMarkdown({ notionClient: notion });

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
const getImage = (property: any): string =>
  property?.type === 'files' && property.files.length > 0 && property.files[0].type === 'file'
    ? property.files[0].file.url
    : '/ogp.png';

/**
 * Notionの段落ブロックを判定するヘルパー関数
 *  @param block Notionのブロックオブジェクト
 *  @returns ブロックが段落ブロックである場合はtrue、それ以外はfalse
 */
const isParagraphBlock = (block : ListBlockChildrenResponseResult): block is BlockObjectResponse & {
  type: 'paragraph';
  paragraph: { rich_text: { plain_text: string }[] };
} => (block as any).type === 'paragraph';

/**
 * Notionの段落ブロックをMarkdownに変換するカスタムトランスフォーマーを設定
 * 段落ブロックが空の場合は改行文字を返す
 */
n2m.setCustomTransformer('paragraph', (block) =>
  isParagraphBlock(block) && block.paragraph.rich_text.length === 0 ? '&nbsp;' : false
);

/**
 * ページをNotionRecordオブジェクトに変換
 * @param page Notionページ
 * @returns NotionRecordオブジェクト
 */
const pageToNotionRecord = ({ id, properties }: PageObjectResponse): NotionRecord => {
  const { slug, types, title, summary, tags, year, link, publication, image, category, published } = properties;

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
    image: getImage(image),
    category: getSelect(category),
    published: getCheckbox(published),
  };
};

/**
 * NotionデータベースからPublishedがtrueのページのリストを取得
 * @returns Notionページのリスト
 */
export const fetchNotionPageList = async (): Promise<NotionRecord[]> => {
  if (!databaseId) {
    throw new Error('DATABASE_ID is not defined in the environment variables.');
  }

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'published',
      checkbox: {
        equals: true,
      },
    },
  });

  return response.results.map(page => pageToNotionRecord(page as PageObjectResponse));
};

/**
 * Notionのページを取得
 * @param pageId ページID
 * @returns ページのMarkdown文字列
 */
export const fetchNotionPage = async (pageId: string) => {
  try {
    const mdBlocks = await n2m.pageToMarkdown(pageId);
    const mdString = n2m.toMarkdownString(mdBlocks);
    const markdownContent = Object.values(mdString).join('\n');

    return markdownContent;
  } catch (error) {
    console.error('Error fetching page from Notion:', error);

    return null;
  }
};
