/**
 * HTML特殊文字をエスケープする
 * @param input 入力文字列
 * @returns エスケープ後の文字列
 */
function escapeHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 改行とHTMLエスケープを行い、\nを<br />に変換する関数
 * @param input 入力文字列
 * @returns エスケープおよび改行変換後の文字列
 */
export function escapeAndNl2br(input: string): string {
  return escapeHtml(input).replace(/\r?\n/g, '<br />');
}

/**
 * 改行とHTMLエスケープを行い、\nを段落区切りに変換する関数
 * 各段落は両端揃えで、最終行は左揃えになる
 * @param input 入力文字列
 * @returns エスケープおよび段落変換後の文字列
 */
export function escapeAndNl2p(input: string): string {
  const paragraphs = escapeHtml(input).split(/\r?\n/);
  return paragraphs
    .map((p, i, arr) => {
      const isLast = i === arr.length - 1;
      return `<p class="text-justify${isLast ? '' : ' mb-4'}">${p}</p>`;
    })
    .join('');
}
