/**
 * ナビゲーション共通ロジック（Header / Footer / BottomNavigation で共有）。
 */

import { stripLocale } from '@/i18n';

// パスがホームページかどうか（/en/ などロケールプレフィックスを除いて判定）
export const isHomePath = (pathname: string): boolean => {
  const path = stripLocale(pathname);
  return path === '/' || path === '';
};

// ホームページかつ /#... アンカーリンクのときだけスムーススクロール対象にする
export const scrollAttr = (pathname: string, href: string): 'true' | 'false' =>
  isHomePath(pathname) && stripLocale(href).startsWith('/#') ? 'true' : 'false';
