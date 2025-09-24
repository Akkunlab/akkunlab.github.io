export const getIconName = (prefix: string, icon?: string): string => {
  const v = icon?.trim() || '';
  return v && !v.includes(':') ? `${prefix}:${v}` : v;
};
