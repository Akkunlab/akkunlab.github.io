import type { Tag } from './Tag';

export interface NotionRecord {
  id: string;
  slug: string;
  types: string;
  title: string;  
  summary: string;
  category: string;
  tags: Tag[];
  year: string;
  link: string;
  publication: string;
  published: boolean;
  image: string;
}
