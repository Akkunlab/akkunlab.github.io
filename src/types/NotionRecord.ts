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
  mark?: boolean;

  // EducationCareer
  start?: string;
  end?: string;
  dept_prog?: string;

  // SocialLinks
  color?: string;
}
