/**
 * Instagramに投稿するスクリプト
 * Run: npx tsx scripts/postToInstagram.ts
 */

import { config } from 'dotenv';
import axios from 'axios';
import { requireEnv, validateContent, runMain } from './lib/social';

config();

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v24.0';
const IG_CAPTION_MAX = 2200;

const POST_CONTENT = {
  imageUrl: 'https://example.com/image.jpg',
  caption: `
Hello Instagram!

#ハッシュタグ
  `.trim(),
};

interface InstagramCredentials {
  userId: string;
  accessToken: string;
}

/**
 * 環境変数から認証情報を取得
 */
const getInstagramCredentials = (): InstagramCredentials => {
  const { INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN } = requireEnv([
    'INSTAGRAM_USER_ID',
    'INSTAGRAM_ACCESS_TOKEN',
  ]);

  return { userId: INSTAGRAM_USER_ID, accessToken: INSTAGRAM_ACCESS_TOKEN };
};

/**
 * Instagram Graph API に POST し、axios のエラーを読みやすく整形する
 * @param endpoint userId以下のエンドポイント（例: /media）
 * @param payload リクエストボディ
 * @param errorLabel エラー時のメッセージ接頭辞
 * @returns レスポンスデータのID
 */
const postGraph = async (
  credentials: InstagramCredentials,
  endpoint: string,
  payload: Record<string, string>,
  errorLabel: string
): Promise<string> => {
  try {
    const response = await axios.post(
      `${INSTAGRAM_API_BASE}/${credentials.userId}${endpoint}`,
      { ...payload, access_token: credentials.accessToken }
    );

    return response.data.id;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`${errorLabel}: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

/**
 * Instagramに投稿
 * @param imageUrl 画像URL
 * @param caption キャプション
 */
const postToInstagram = async (imageUrl: string, caption: string): Promise<void> => {
  const credentials = getInstagramCredentials();

  console.log('Posting to Instagram...');
  console.log(`Image URL: ${imageUrl}`);
  console.log(`Caption:\n${caption}`);
  console.log(`\nLength: ${caption.length} / ${IG_CAPTION_MAX}`);

  // 1. メディアコンテナを作成
  console.log('\n1. Creating media container...');
  const containerId = await postGraph(
    credentials,
    '/media',
    { image_url: imageUrl, caption },
    'Failed to create media container'
  );
  console.log(`Container ID: ${containerId}`);

  // 2. メディアを公開
  console.log('\n2. Publishing media...');
  const mediaId = await postGraph(
    credentials,
    '/media_publish',
    { creation_id: containerId },
    'Failed to publish media'
  );

  console.log('\nPosted to Instagram successfully!');
  console.log(`Media ID: ${mediaId}`);
};

runMain('to Instagram', async () => {
  const { imageUrl, caption } = POST_CONTENT;

  validateContent(imageUrl, Number.MAX_SAFE_INTEGER, 'imageUrl');
  validateContent(caption, IG_CAPTION_MAX, 'Caption');

  await postToInstagram(imageUrl, caption);
});
