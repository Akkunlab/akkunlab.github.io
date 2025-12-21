/**
 * 改行とHTMLエスケープを行い、\nを<br />に変換する関数
 * @param input 入力文字列
 * @returns エスケープおよび改行変換後の文字列
 */
export function escapeAndNl2br(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br />');
}
