import { SITE_URL } from '@/constants';

// http(s) で始まる絶対URLかどうかを判定する
export const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

// 末尾スラッシュを除いたサイトのベースURL
export const siteUrl = SITE_URL.replace(/\/+$/, '');

// 相対パス・絶対パスのどちらでも絶対URLに解決する
export const resolveAbsoluteUrl = (path: string): string =>
  /^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;
