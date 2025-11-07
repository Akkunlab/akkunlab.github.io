/**
 * ツイートを投稿するスクリプト
 * Run: npx tsx scripts/post_to_x.ts
 */

import { config } from 'dotenv';
import { TwitterApi } from 'twitter-api-v2';

config();

const TWEET_CONTENT = `
Hello World!

#ハッシュタグ
`.trim();

/**
 * 環境変数から認証情報を取得
 * @return TwitterApiクライアント
 */
const getTwitterClient = (): TwitterApi => {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
    throw new Error(
      'Environment variables are not set. Please set the following:\n' +
      'X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET'
    );
  }

  return new TwitterApi({
    appKey: X_API_KEY,
    appSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });
};

/**
 * ツイートを投稿
 * @param text ツイート内容
 */
const postTweet = async (text: string): Promise<void> => {
  try {
    const client = getTwitterClient();
    const rwClient = client.readWrite;

    console.log('Posting tweet...');
    console.log(`Content:\n${text}`);
    console.log(`\nLength: ${text.length} / 280`);
    
    const tweet = await rwClient.v2.tweet(text);
    
    console.log('\nTweet posted successfully!');
    console.log(`Tweet ID: ${tweet.data.id}`);
    console.log(`URL: https://twitter.com/i/web/status/${tweet.data.id}`);
  } catch (error) {
    console.error('Failed to post tweet:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

/**
 * メイン処理
 */
const main = async (): Promise<void> => {

  if (!TWEET_CONTENT) {
    console.error('Error: TWEET_CONTENT is empty');
    process.exit(1);
  }

  if (TWEET_CONTENT.length > 280) {
    console.error('Error: Tweet exceeds 280 characters');
    process.exit(1);
  }

  await postTweet(TWEET_CONTENT);
};

main();
