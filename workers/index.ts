const NOTION_API_VERSION = '2022-06-28';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SITE_URL = 'https://akkunlab.dev';
const SITE_TITLE = 'Akkunlab Portfolio Generator';

const SYSTEM_PROMPT = 'You are a professional writer creating creative and structured portfolio descriptions.';

const USER_PROMPT_TEMPLATE = (title: string) => `
Write a portfolio project description based on the title below.
Include: concept, features, and technologies used.
Title: '${title}'
Output in markdown with headings.
`;

export interface Env {
  NOTION_API_KEY: string;
  OPENROUTER_API_KEY: string;
  MODEL?: string;
}

export default {
  async fetch(req: Request, env: Env) {

    // POSTリクエストのみ許可
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const { pageId } = await req.json();
      
      if (!pageId) return new Response('Missing pageId', { status: 400 });

      // Notionページからタイトル取得
      const notionRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
      });
      const pageData = await notionRes.json();
      const title = pageData.properties?.title?.title?.[0]?.plain_text || '(Untitled)';

      console.log("Notion response:", JSON.stringify(pageData, null, 2)); // デバッグ用ログ

      // OpenRouter APIを使って記事生成
      const prompt = USER_PROMPT_TEMPLATE(title);
      const model = env.MODEL;

      const openrouterRes = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': SITE_URL,
          'X-Title': SITE_TITLE,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      const data = await openrouterRes.json();
      const generatedText = data.choices?.[0]?.message?.content?.trim() ?? '';

      console.log("OpenRouter response:", JSON.stringify(data, null, 2)); // デバッグ用ログ

      // Notionページを更新
      await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: generatedText } }] },
            },
          ],
        }),
      });

      return new Response(
        JSON.stringify({ ok: true, title, generatedText }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    } catch (err: any) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
