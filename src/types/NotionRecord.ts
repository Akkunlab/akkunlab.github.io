import type { Tag } from './Tag';

export interface NotionRecord {
  id: string;

  // Portfolio
  slug?: string;
  types?: string;
  title?: string;
  summary?: string;
  category?: string;
  tags?: Tag[];
  link?: string;
  year?: string;
  event?: string;
  publish?: string;
  updated?: string;
  published?: boolean;
  image?: string;

  // Skills
  subcategory?: string;
  name?: string;
  icon?: string;
  
  // certifications
  date?: string;

  // EducationCareer
  start?: string;
  end?: string;
  dept_prog?: string;

  // SocialLinks
  color?: string;

  // 多言語対応（Notion 側の任意プロパティ）
  title_en?: string;
  summary_en?: string;
  name_en?: string;
  dept_prog_en?: string;

  // 英語ページで日本語フォールバックした場合に 'ja'（表示要素の lang 属性用、WCAG 3.1.2）
  textLang?: 'ja';
}
