import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkBreaks from 'remark-breaks'

/**
 * Markdown形式の文字列をHTMLに変換
 * @param markdownContent Markdown形式の文字列
 * @returns HTML形式の文字列
 */
export const markdownToHtml = async (markdownContent: string): Promise<string> => {
  try {
    const html = await remark()
      .use(remarkBreaks)
      .use(remarkHtml)
      .process(markdownContent);

    return html.toString();
  } catch (error) {
    console.error('Error in markdownToHtml:', error);

    return '';
  }
};
