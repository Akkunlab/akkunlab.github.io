const NOTION_API_VERSION = '2022-06-28';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SITE_URL = 'https://akkunlab.dev';
const SITE_TITLE = 'Akkunlab Portfolio Generator';

const USER_PROMPT_TEMPLATE = (title: string) => `
次のタイトルから、ブログのような語り口のポートフォリオ紹介文を書いてください。

タイトル: 『${title}』

【条件】
- 一つの物語のように流れる文章にする。
- 技術やデザインの工夫を自然な流れで紹介する。
- 感情と理性のバランスを取り、作品の人間的な側面を伝える。
- 出力は日本語のMarkdownで、見出しなし・段落のみ。
`;

export interface Env {
  NOTION_API_KEY: string;
  OPENROUTER_API_KEY: string;
  SYSTEM_PROMPT?: string;
  MODEL?: string;
}

/**
 * MarkdownテキストをNotionブロック形式に変換
 */
const parseMarkdownToNotionBlocks = (markdown: string): any[] => {
  const lines = markdown.split('\n').filter((line: string) => line.trim() !== '');
  const blocks: any[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // 見出し (# ## ###)
    if (trimmed.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: trimmed.slice(2) } }] },
      });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: trimmed.slice(3) } }] },
      });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: trimmed.slice(4) } }] },
      });
    }
    // 箇条書き (- または *)
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: trimmed.slice(2) } }] },
      });
    }
    // 番号付きリスト (1. 2. など)
    else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: [{ type: 'text', text: { content: trimmed.replace(/^\d+\.\s/, '') } }] },
      });
    }
    // コードブロック (```)
    else if (trimmed.startsWith('```')) {
      // コードブロックの開始/終了マーカーはスキップ
      continue;
    }
    // 通常の段落
    else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: trimmed } }] },
      });
    }
  }

  return blocks;
};

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
      const systemPrompt = env.SYSTEM_PROMPT || 'You are a professional writer creating creative and structured portfolio descriptions.';

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
              content: systemPrompt,
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

      // MarkdownをNotionブロックに変換
      const blocks = parseMarkdownToNotionBlocks(generatedText);

      // Notionページを更新
      await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': NOTION_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          children: blocks,
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
