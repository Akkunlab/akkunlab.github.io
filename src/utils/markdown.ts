import { remark } from 'remark';
import remarkHtml from 'remark-html';

/**
 * Markdown形式の文字列をHTMLに変換
 * @param markdownContent Markdown形式の文字列
 * @returns HTML形式の文字列
 */
export const markdownToHtml = async (markdownContent: string): Promise<string> => {
  try {
    const result = await remark().use(remarkHtml).process(markdownContent);

    return result.toString();
  } catch (error) {
    console.error('Error in markdownToHtml:', error);

    return '';
  }
};
