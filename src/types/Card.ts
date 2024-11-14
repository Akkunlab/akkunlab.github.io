import type { Tag } from "./Tag";

export interface Card {
  id: string;
  path: string;
  types: string;
  title: string;  
  summary: string;
  tags: Tag[];
  year: string;
  link: string;
  publication: string;
  image: string;
}
