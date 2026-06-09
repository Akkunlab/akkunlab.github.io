/**
 * ナビゲーション共通ロジック（Header / Footer / BottomNavigation で共有）。
 */

// パスがホームページかどうか
export const isHomePath = (pathname: string): boolean =>
  pathname === '/' || pathname === '';

// ホームページかつ /#... アンカーリンクのときだけスムーススクロール対象にする
export const scrollAttr = (pathname: string, href: string): 'true' | 'false' =>
  isHomePath(pathname) && href.startsWith('/#') ? 'true' : 'false';
