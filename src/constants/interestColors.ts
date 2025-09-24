export const INTEREST_COLOR_MAP: Record<string, string> = {
  'ものづくり': 'from-blue-500 to-cyan-500',
  'プログラミング': 'from-green-500 to-emerald-500',
  'メディアアート制作': 'from-purple-500 to-violet-500',
  '電子工作': 'from-orange-500 to-red-500',
  'オーディオ': 'from-pink-500 to-rose-500',
  '映像制作': 'from-amber-500 to-yellow-500',
  '科学の啓蒙': 'from-amber-700 to-yellow-700',
};

/**
 * Get the color associated with a specific interest.
 * @param name Interest name
 * @returns Tailwind CSS color classes
 */
export const getInterestColor = (name: string) => {
  return INTEREST_COLOR_MAP[name]
};
