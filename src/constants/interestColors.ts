export const INTEREST_COLOR_MAP: Record<string, string> = {
  'プログラミング': 'from-blue-500 to-cyan-500',
  'メディアアート制作': 'from-pink-500 to-rose-500',
  '学問': 'from-green-500 to-emerald-500',
};

/**
 * Get the color associated with a specific interest.
 * @param name Interest name
 * @returns Tailwind CSS color classes
 */
export const getInterestColor = (name: string) => {
  return INTEREST_COLOR_MAP[name]
};
