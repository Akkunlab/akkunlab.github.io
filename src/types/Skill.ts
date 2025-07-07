export interface Skill {
  name: string;
  icon: string;
}

export interface SkillCategory {
  category: string;
  color: string;
  skills: Skill[];
}
