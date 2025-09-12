import type { Tag } from './Tag';

export interface NotionRecord {
  id: string;

  // Portfolio
  slug?: string;
  types?: string;
  title?: string;
  summary?: string;
  tags?: Tag[];
  year?: string;
  link?: string;
  publication?: string;
  image?: string;
  category?: string;
  published?: boolean;

  // MediaCoverage
  source?: string;
  date?: string;

  // Skills / SocialLinks
  name?: string;
  icon?: string;
  subcategory?: string;
  color?: string;
  description?: string;

  // EducationCareer
  dept_prog?: string;
  start?: string;
  end?: string;

  // Certifications
  mark?: boolean;
}
