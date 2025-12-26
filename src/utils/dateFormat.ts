/**
 * 単一の日付を短縮形式でフォーマットする関数
 * @param dateString - ISO形式の日付文字列
 * @returns 短縮形式の日付文字列（例：'2024/12/25'）
 */
const formatSingleDate = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
};

/**
 * 日付を短縮形式でフォーマットする関数
 * 日付範囲（"start/end"形式）にも対応
 * @param dateString - ISO形式の日付文字列、または "start/end" 形式の日付範囲
 * @returns 短縮形式の日付文字列（例：'2024/12/25' または '2024/12/25 - 2024/12/26'）
 */
export const formatDateShort = (dateString: string): string => {
  if (!dateString) return '';

  // 日付範囲の場合（"start/end"形式）
  if (dateString.includes('/') && dateString.split('/').length === 2) {
    const [start, end] = dateString.split('/');

    // ISO日付形式かどうかを確認（YYYY-MM-DD）
    if (start.match(/^\d{4}-\d{2}-\d{2}/) && end.match(/^\d{4}-\d{2}-\d{2}/)) {
      return `${formatSingleDate(start)} - ${formatSingleDate(end)}`;
    }
  }

  return formatSingleDate(dateString);
};
