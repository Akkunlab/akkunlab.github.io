/**
 * Xに投稿するスクリプト
 * Run: npx tsx scripts/postToX.ts
 */

import { config } from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';
import { requireEnv, validateContent, runMain } from './lib/social';

config();

const X_MAX_LENGTH = 280;

const TWEET_CONTENT = `
Hello World!

#ハッシュタグ
`.trim();

/**
 * 環境変数から認証情報を取得
 * @return TwitterApiクライアント
 */
const getTwitterClient = (): TwitterApi => {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = requireEnv([
    'X_API_KEY',
    'X_API_SECRET',
    'X_ACCESS_TOKEN',
    'X_ACCESS_SECRET',
  ]);

  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });
};

/**
 * Xに投稿
 * @param text ツイート内容
 */
const postTweet = async (text: string): Promise<void> => {
  const client = getTwitterClient();
  const rwClient = client.readWrite;

  console.log('Posting tweet...');
  console.log(`Content:\n${text}`);
  console.log(`\nLength: ${text.length} / ${X_MAX_LENGTH}`);

  const tweet = await rwClient.v2.tweet(text);

  console.log('\nTweet posted successfully!');
  console.log(`Tweet ID: ${tweet.data.id}`);
  console.log(`URL: https://twitter.com/i/web/status/${tweet.data.id}`);
};

runMain('tweet', async () => {
  validateContent(TWEET_CONTENT, X_MAX_LENGTH, 'Tweet');
  await postTweet(TWEET_CONTENT);
});
