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

  // MediaCoverage
  source?: string;
  date?: string;

  // Skills / SocialLinks
  subcategory?: string;
  name?: string;
  icon?: string;
  color?: string;
  
  // certifications
  description?: string;
  mark?: boolean;

  // EducationCareer
  dept_prog?: string;
  start?: string;
  end?: string;
}
