import type { NotionRecord } from '@/types';
import { NAV_ITEMS } from '@/constants/siteData';
import { translations, type Translation } from './translations';

// URL 設計: 既存 URL を壊さないため日本語にはプレフィックスを付けず、英語のみ /en/ を付与する
export const LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';

// 言語名は必ず自言語表記にする（読みたい本人が必ず読める表記にするため）
export const LOCALE_LABELS: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
};

// aria-label はリンク先の言語で表記する
export const SWITCH_LABELS: Record<Locale, string> = {
  ja: '日本語に切り替える',
  en: 'Switch to English',
};

export const OG_LOCALES: Record<Locale, string> = {
  ja: 'ja_JP',
  en: 'en_US',
};

export const getLangFromUrl = (url: URL): Locale => {
  const [, first] = url.pathname.split('/');
  if (first && first !== DEFAULT_LOCALE && (LOCALES as readonly string[]).includes(first)) {
    return first as Locale;
  }
  return DEFAULT_LOCALE;
};

export const stripLocale = (path: string): string => {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (path === `/${locale}` || path === `/${locale}/`) return '/';
    if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
  }
  return path;
};

export const localizePath = (path: string, locale: Locale): string => {
  const base = stripLocale(path);
  if (locale === DEFAULT_LOCALE) return base;
  return base === '/' ? `/${locale}/` : `/${locale}${base}`;
};

export const useTranslations = (locale: Locale): Translation => translations[locale];

export const otherLocale = (locale: Locale): Locale => (locale === 'ja' ? 'en' : 'ja');

export const getLanguageSwitch = (url: URL) => {
  const target = otherLocale(getLangFromUrl(url));
  return {
    target,
    href: localizePath(url.pathname, target),
    label: LOCALE_LABELS[target],
    aria: SWITCH_LABELS[target],
  };
};

export const getNavItems = (locale: Locale) => {
  const t = useTranslations(locale);
  return NAV_ITEMS.map(item => ({
    ...item,
    label: t.nav[item.key],
    href: localizePath(item.href, locale),
  }));
};

// *_en は Notion 側に翻訳を追加するための任意プロパティ。未設定なら日本語のまま表示する
export const localizeRecord = (record: NotionRecord, locale: Locale): NotionRecord => {
  if (locale === DEFAULT_LOCALE) return record;

  // いずれかのフィールドが日本語フォールバックになるレコードは textLang で示す
  // （英語ページ内の日本語テキストに lang="ja" を付けるため。レコード単位の粗い判定）
  const hasFallback =
    (record.title && !record.title_en) ||
    (record.summary && !record.summary_en) ||
    (record.name && !record.name_en) ||
    (record.dept_prog && !record.dept_prog_en);

  return {
    ...record,
    title: record.title_en || record.title,
    summary: record.summary_en || record.summary,
    name: record.name_en || record.name,
    dept_prog: record.dept_prog_en || record.dept_prog,
    ...(hasFallback && { textLang: 'ja' as const }),
  };
};

export const localizeRecords = (records: NotionRecord[], locale: Locale): NotionRecord[] =>
  records.map(record => localizeRecord(record, locale));

export { CONTENT_LABELS, localizeContentLabel } from './translations';
export type { Translation };
