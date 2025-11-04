export interface Env {
  NOTION_API_KEY: string;
  OPENROUTER_API_KEY: string;
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
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
      });
      const pageData = await notionRes.json();
      const title = pageData.properties?.title?.title?.[0]?.plain_text || '(Untitled)';
      console.log(title);

      // OpenRouter APIを使って記事生成
      const prompt = `
      Write a portfolio project description based on the title below.
      Include: concept, features, and technologies used.
      Title: '${title}'
      Output in markdown with headings.
      `;

      const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://akkunlab.dev',
          'X-Title': 'AkkunLab Portfolio Generator',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen-2.5-72b-instruct:free',
          messages: [
            {
              role: 'system',
              content: 'You are a professional writer creating creative and structured portfolio descriptions.',
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

      // Notionページを更新
      await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          children: [
            {
              object: 'block',
              type: 'heading_1',
              heading_1: { rich_text: [{ type: 'text', text: { content: title } }] },
            },
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
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
