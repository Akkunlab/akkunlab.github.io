import type { Card, Tag } from '@/types';
import { Client } from '@notionhq/client';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionToMarkdown } from 'notion-to-md';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

/**
 * ページをCardオブジェクトにマッピング
 * @param page Notionページ
 * @returns Cardオブジェクト
 */
const mapNotionPageToCard = ({ id, properties }: PageObjectResponse): Card => {
  const { path, types, title, summary, tags, year, link, publication, image } = properties;

  return {
    id,
    path: path.type === 'rich_text' ? path.rich_text[0]?.plain_text || '' : '',
    types: types?.type === 'select' ? types.select?.name || '' : '',
    title: title.type === 'title' ? title.title[0]?.plain_text || '' : '',
    summary: summary.type === 'rich_text' ? summary.rich_text[0]?.plain_text || '' : '',
    tags: tags?.type === 'multi_select'
      ? tags.multi_select.map((tag: Tag) => ({ id: tag.id, name: tag.name }))
      : [],
    year: year?.type === 'number' ? year.number?.toString() || '' : '',
    link: link?.type === 'url' ? link.url || '' : '',
    publication: publication?.type === 'date' ? publication.date?.start || '' : '',
    image: image?.type === 'files' && image.files.length > 0
      ? image.files[0].type === 'file' ? image.files[0].file.url : '/ogp.png'
      : '/ogp.png',
  };
};

/**
 * NotionデータベースからPublishedがtrueのページのリストを取得
 * @returns Notionページのリスト
 */
export const fetchNotionPageList = async (): Promise<Card[]> => {
  const databaseId = import.meta.env.DATABASE_ID;
  
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

  return response.results.map(page => mapNotionPageToCard(page as PageObjectResponse));
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
