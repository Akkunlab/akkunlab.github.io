/**
 * Instagramに投稿するスクリプト
 * Run: npx tsx scripts/postToInstagram.ts
 */

import { config } from 'dotenv';
import axios from 'axios';

config();

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v24.0';

const POST_CONTENT = {
  imageUrl: 'https://example.com/image.jpg',
  caption: `
Hello Instagram!

#ハッシュタグ
  `.trim(),
};

/**
 * 環境変数から認証情報を取得
 */
const getInstagramCredentials = () => {
  const { INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN } = process.env;

  if (!INSTAGRAM_USER_ID || !INSTAGRAM_ACCESS_TOKEN) {
    throw new Error(
      'Environment variables are not set. Please set the following:\n' +
      'INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN'
    );
  }

  return {
    userId: INSTAGRAM_USER_ID,
    accessToken: INSTAGRAM_ACCESS_TOKEN,
  };
};

/**
 * メディアコンテナを作成
 * @param imageUrl 画像URL
 * @param caption キャプション
 * @returns コンテナID
 */
const createMediaContainer = async (
  imageUrl: string,
  caption: string
): Promise<string> => {
  const { userId, accessToken } = getInstagramCredentials();

  try {
    const response = await axios.post(
      `${INSTAGRAM_API_BASE}/${userId}/media`,
      {
        image_url: imageUrl,
        caption: caption,
        access_token: accessToken,
      }
    );

    return response.data.id;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Failed to create media container: ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
};

/**
 * メディアを公開
 * @param creationId メディアコンテナID
 * @returns 投稿ID
 */
const publishMedia = async (creationId: string): Promise<string> => {
  const { userId, accessToken } = getInstagramCredentials();

  try {
    const response = await axios.post(
      `${INSTAGRAM_API_BASE}/${userId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      }
    );

    return response.data.id;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        `Failed to publish media: ${JSON.stringify(error.response.data)}`
      );
    }
    throw error;
  }
};

/**
 * Instagramに投稿
 * @param imageUrl 画像URL
 * @param caption キャプション
 */
const postToInstagram = async (
  imageUrl: string,
  caption: string
): Promise<void> => {
  try {
    console.log('Posting to Instagram...');
    console.log(`Image URL: ${imageUrl}`);
    console.log(`Caption:\n${caption}`);
    console.log(`\nLength: ${caption.length} / 2200`);

    // 1. メディアコンテナを作成
    console.log('\n1. Creating media container...');
    const containerId = await createMediaContainer(imageUrl, caption);
    console.log(`Container ID: ${containerId}`);

    // 2. メディアを公開
    console.log('\n2. Publishing media...');
    const mediaId = await publishMedia(containerId);

    console.log('\nPosted to Instagram successfully!');
    console.log(`Media ID: ${mediaId}`);
  } catch (error) {
    console.error('Failed to post to Instagram:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

/**
 * メイン処理
 */
const main = async (): Promise<void> => {
  const { imageUrl, caption } = POST_CONTENT;

  if (!imageUrl || !caption) {
    console.error('Error: imageUrl or caption is empty');
    process.exit(1);
  }

  if (caption.length > 2200) {
    console.error('Error: Caption exceeds 2200 characters');
    process.exit(1);
  }

  await postToInstagram(imageUrl, caption);
};

main();
