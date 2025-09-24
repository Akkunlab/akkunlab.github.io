export interface Skill {
  name: string;
  icon: string;
}

export interface SkillSubcategory {
  name: string;
  skills: Skill[];
}

export interface SkillCategory {
  category: string;
  color: string;
  skills?: Skill[];
  subcategories?: SkillSubcategory[];
}
