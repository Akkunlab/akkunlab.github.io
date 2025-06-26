/**
 * 日付を短縮形式でフォーマットする関数
 * @param dateString - ISO形式の日付文字列
 * @returns 短縮形式の日付文字列（例：'2024/12/25'）
 */
export const formatDateShort = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`;
};
