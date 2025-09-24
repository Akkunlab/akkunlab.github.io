export interface Skill {
  name: string;
  icon: string;
  color: string;
}

export interface CategoryGroup {
  name: string;
  color: string;
  subgroups: Array<{ name: string; skills: Skill[] }>;
  skills: Skill[];
}
