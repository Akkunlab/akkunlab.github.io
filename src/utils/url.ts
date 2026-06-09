import { SITE_URL } from '@/constants';

// 末尾スラッシュを除いたサイトのベースURL
export const siteUrl = SITE_URL.replace(/\/+$/, '');

// 相対パス・絶対パスのどちらでも絶対URLに解決する
export const resolveAbsoluteUrl = (path: string): string =>
  /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;
