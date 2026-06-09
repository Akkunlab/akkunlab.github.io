const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SITE_URL = 'https://akkunlab.dev';
const SITE_TITLE = 'Akkunlab Portfolio Generator';

// types プロパティが「活動」のときは活動用テンプレート、それ以外は作品用
const ACTIVITY_TYPE = '活動';
// OpenRouter へのレートリミット対策の待機時間
const LLM_RATE_LIMIT_MS = 1000;
// LLM の temperature（slug 生成は決定的寄り、本文生成は創造的寄り）
const SLUG_TEMPERATURE = 0.3;
const BODY_TEMPERATURE = 0.7;

interface Env {
  API_KEY: string;
  NOTION_API_KEY: string;
  OPENROUTER_API_KEY: string;
  WORKS_SYSTEM_PROMPT: string;
  ACTIVITIES_SYSTEM_PROMPT: string;
  MODEL: string;
}

// OpenRouter チャット補完レスポンスのうち利用する部分
interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

// Notion ブロックオブジェクト（heading/paragraph などを動的キーで保持）
type NotionBlock = {
  object: 'block';
  type: string;
  [key: string]: unknown;
};

// Notion Webhook から渡されるページデータのうち利用する部分
interface WebhookBody {
  data?: {
    id?: string;
    properties?: {
      types?: { select?: { name?: string } };
      title?: { title?: Array<{ plain_text?: string }> };
      summary?: { rich_text?: Array<{ plain_text?: string }> };
      category?: { select?: { name?: string } };
      tags?: { multi_select?: Array<{ name: string }> };
    };
  };
}

// unknown なエラーを表示用文字列に整形する
const formatError = (err: unknown): string =>
  err instanceof Error ? (err.stack ?? err.message) : String(err);

const createBaseInfo = (title: string, summary: string, category: string, tags: string[]) => `
タイトル: 『${title}』
概要: ${summary}
カテゴリ: ${category}
タグ: ${tags.join(', ')}
`.trim();

const WORKS_PROMPT_TEMPLATE = (title: string, summary: string, category: string, tags: string[]) => `
次のタイトルと概要から、ブログのような語り口のポートフォリオ紹介文を書いてください。

${createBaseInfo(title, summary, category, tags)}

【条件】
- 一つの物語のように流れる文章にする。
- 技術やデザインの工夫を自然な流れで紹介する。
- 感情と理性のバランスを取り、作品の人間的な側面を伝える。
- カテゴリやタグの情報も考慮して、作品の特徴を表現する。
- 出力は日本語のMarkdownで、見出しなし・段落のみ。
`;

const ACTIVITIES_PROMPT_TEMPLATE = (title: string, summary: string, category: string, tags: string[]) => `
次のタイトルと概要から、活動内容を紹介する文章を書いてください。

${createBaseInfo(title, summary, category, tags)}

【条件】
- 活動の背景、目的、成果を明確に伝える。
- 学びや経験、得られた知見を具体的に表現する。
- 参加した動機や、活動を通じて得た気づきも含める。
- カテゴリやタグの情報も考慮して、活動の特徴を表現する。
- 出力は日本語のMarkdownで、見出しなし・段落のみ。
`;

const SLUG_GENERATION_PROMPT = (title: string) => `
次のタイトルから、URLに使用する適切なslugを生成してください。

タイトル: 『${title}』

【条件】
- 英語で簡潔に表現する
- 単語の区切りは必ずハイフン(-)を使用
- できるだけ短く、わかりやすく（1〜5単語程度）
- 小文字のみ使用
- 特殊文字は使わない（英数字とハイフンのみ）

【出力形式】
slugのみを出力してください（説明や他の文字は不要）。

例: title: YouSync, slug: yousync
例: title: オンラインイベントを開催！, slug: online-event
例: title: 県北BCP2024 #2に参加！, slug: kenpoku-bcp-2024-2
`;

/**
 * OpenRouterのヘッダーを生成
 */
const createOpenRouterHeaders = (apiKey: string) => ({
  'Authorization': `Bearer ${apiKey}`,
  'HTTP-Referer': SITE_URL,
  'X-Title': SITE_TITLE,
  'Content-Type': 'application/json',
});

/**
 * Notion APIのヘッダーを生成
 */
const createNotionHeaders = (apiKey: string) => ({
  'Authorization': `Bearer ${apiKey}`,
  'Notion-Version': NOTION_API_VERSION,
  'Content-Type': 'application/json',
});

/**
 * Notion API へリクエストし、失敗時はステータスとレスポンスをログに残す
 */
const notionFetch = async (env: Env, path: string, init: RequestInit): Promise<Response> => {
  const res = await fetch(`${NOTION_API_BASE}${path}`, {
    headers: createNotionHeaders(env.NOTION_API_KEY),
    ...init,
  });

  if (!res.ok) {
    console.error(`[Notion] ${init.method} ${path} failed (${res.status}): ${await res.text().catch(() => '')}`);
  }

  return res;
};

/**
 * LLMを呼び出してテキストを生成
 */
const callLLM = async (
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number = BODY_TEMPERATURE
): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, LLM_RATE_LIMIT_MS));

  let response: Response | undefined;

  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: createOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      }),
    });

    const data = (await response.json()) as OpenRouterResponse;
    console.log("[callLLM] OpenRouter response:", JSON.stringify(data, null, 2));

    return data.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (err: unknown) {
    console.error("[callLLM] fetch error:", err, response ? await response.text().catch(() => "") : "");
    throw err;
  }
};

/**
 * 生成されたslugを正規化
 */
const normalizeSlug = (slug: string): string => {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '') // 英数字とハイフンのみ許可
    .replace(/-+/g, '-')        // 連続するハイフンを1つに
    .replace(/^-|-$/g, '');     // 先頭と末尾のハイフンを削除
};

/**
 * MarkdownテキストをNotionブロック形式に変換
 */
const parseMarkdownToNotionBlocks = (markdown: string): NotionBlock[] => {
  const lines = markdown.split('\n').filter((line: string) => line.trim() !== '');
  const blocks: NotionBlock[] = [];

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

/**
 * バックグラウンドで処理を実行
 */
const processInBackground = async (body: WebhookBody, env: Env) => {
  try {
    const pageId = body.data?.id;
    const types = body.data?.properties?.types?.select?.name || '';
    const title = body.data?.properties?.title?.title?.[0]?.plain_text || '';
    const summary = body.data?.properties?.summary?.rich_text?.[0]?.plain_text || '';
    const category = body.data?.properties?.category?.select?.name || '';
    const tags = body.data?.properties?.tags?.multi_select?.map(tag => tag.name) || [];

    if (!pageId || !title || !summary) {
      console.error('Missing required fields:', { pageId, title, summary });
      return;
    }

    // typesに応じてプロンプトを切り替え
    const prompt = types === ACTIVITY_TYPE
      ? ACTIVITIES_PROMPT_TEMPLATE(title, summary, category, tags)
      : WORKS_PROMPT_TEMPLATE(title, summary, category, tags);

    const systemPrompt = types === ACTIVITY_TYPE
      ? env.ACTIVITIES_SYSTEM_PROMPT
      : env.WORKS_SYSTEM_PROMPT;

    const model = env.MODEL;

    // デバッグ用ログ
    console.log('Request parameters:', JSON.stringify({
      pageId,
      types,
      title,
      summary,
      category,
      tags,
      model,
      systemPrompt,
    }, null, 2));

    // 1. slug生成
    const slugPrompt = SLUG_GENERATION_PROMPT(title);
    const rawSlug = await callLLM(
      env.OPENROUTER_API_KEY,
      model,
      'あなたはURLスラッグ生成の専門家です。与えられた情報から、SEOに適した簡潔で分かりやすいslugを生成してください。',
      slugPrompt,
      SLUG_TEMPERATURE
    );
    const generatedSlug = normalizeSlug(rawSlug);

    // 2. 本文生成
    const generatedText = await callLLM(
      env.OPENROUTER_API_KEY,
      model,
      systemPrompt,
      prompt,
      BODY_TEMPERATURE
    );

    // 3. Notionページの本文を更新
    const blocks = parseMarkdownToNotionBlocks(generatedText);

    await notionFetch(env, `/blocks/${pageId}/children`, {
      method: 'PATCH',
      body: JSON.stringify({ children: blocks }),
    });

    // 4. Notionページのslugプロパティを更新
    if (generatedSlug) {
      await notionFetch(env, `/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          properties: {
            slug: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: generatedSlug },
                },
              ],
            },
          },
        }),
      });
    }

    console.log('Background processing completed successfully:', { title, slug: generatedSlug });
  } catch (err: unknown) {
    console.error("[processInBackground] Error detail:", formatError(err));
  }
};

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {

    // APIキー認証チェック
    const authHeader = req.headers.get('API-Key');

    if (!authHeader || authHeader !== env.API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json; charset=utf-8' }
        }
      );
    }

    // POSTリクエストのみ許可
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = (await req.json()) as WebhookBody;

      // バックグラウンドで処理
      ctx.waitUntil(processInBackground(body, env));

      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    } catch (err: unknown) {
      console.error("[fetch handler] Error detail:", formatError(err));
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? (err.stack ?? '') : '';
      return new Response(`Error: ${message}\n${stack}`, { status: 500 });
    }
  },
};
