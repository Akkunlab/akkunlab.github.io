/**
 * SNS投稿スクリプト共通ユーティリティ
 */

/**
 * 必須の環境変数をまとめて取得する。未設定があればエラーを投げる。
 * @param keys 必須の環境変数名のリスト
 * @returns 環境変数名をキーとした値のレコード
 */
export const requireEnv = <K extends string>(keys: readonly K[]): Record<K, string> => {
  const missing = keys.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      'Environment variables are not set. Please set the following:\n' + keys.join(', ')
    );
  }

  return Object.fromEntries(
    keys.map((key) => [key, process.env[key] as string])
  ) as Record<K, string>;
};

/**
 * 投稿内容の空・最大文字数バリデーション。違反時はプロセスを終了する。
 * @param text 投稿テキスト
 * @param maxLength 最大文字数
 * @param label エラー表示に使うラベル
 */
export const validateContent = (text: string, maxLength: number, label: string): void => {
  if (!text) {
    console.error(`Error: ${label} is empty`);
    process.exit(1);
  }

  if (text.length > maxLength) {
    console.error(`Error: ${label} exceeds ${maxLength} characters`);
    process.exit(1);
  }
};

/**
 * メイン処理を共通のエラーハンドリングでラップして実行する。
 * @param label 失敗メッセージに使うラベル
 * @param fn 実行する非同期処理
 */
export const runMain = async (label: string, fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    console.error(`Failed to post ${label}:`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
};
