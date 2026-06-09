/**
 * タグに関する純粋関数（DOM 非依存）。
 * サーバー側（ビルド時）でもブラウザ側でも安全に利用できる。
 */

/**
 * タグ名・カテゴリ名を ID 用に正規化
 * @param name - タグ名・カテゴリ名
 * @returns 正規化された ID
 */
export const normalizeTagName = (name?: string): string => {
  if (!name) return '';

  return name
    .trim()
    .toLowerCase()
    .replace(/[/\s]+/g, '-')  // スラッシュ・空白をハイフンに変換
    .replace(/-+/g, '-');     // 連続したハイフンを 1 つにまとめる
};

/**
 * タグ名やカテゴリ名を正規化して data-tags 属性を生成
 * @param tags - NotionRecord の tags プロパティ
 * @param category - NotionRecord の category プロパティ
 * @returns data-tags 属性に埋め込むためのカンマ区切り文字列
 */
export const generateTagString = (
  tags?: { name?: string }[],
  category?: string,
): string => {
  const normalizedTags = [
    ...(tags ?? []).map(tag => normalizeTagName(tag.name)),
    normalizeTagName(category),
  ].filter((tag): tag is string => Boolean(tag));

  return normalizedTags.join(',');
};
