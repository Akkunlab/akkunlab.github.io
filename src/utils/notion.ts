import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

/**
 * NotionデータベースからページIDのリストを取得
 * @returns ページIDの配列
 */
export const fetchNotionPageIds = async (): Promise<string[]> => {
  const databaseId = import.meta.env.DATABASE_ID;
  
  if (!databaseId) {
    throw new Error('DATABASE_ID is not defined in the environment variables.');
  }

  const response = await notion.databases.query({
    database_id: databaseId,
  });

  return response.results.map((page) => page.id);
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
