export type Seniority =
  | "INTERNSHIP"
  | "JUNIOR"
  | "MID"
  | "SENIOR"
  | "STAFF"
  | "PRINCIPAL"
  | "LEAD"
  | "MANAGER"
  | "DIRECTOR";

export type EmploymentType = "PERMANENT" | "CONTRACT" | "FREELANCE" | "PART_TIME" | "INTERNSHIP";

export type SalaryPeriod = "HOURLY" | "DAILY" | "MONTHLY" | "YEARLY";

export interface RoleCategoryDefinition {
  slug: string;
  label: string;
  baseTags: string[];
  /** Lowercase keyword phrases; first category (in priority order) with a hit wins. */
  keywords: string[];
}

export interface TitleNormalizationResult {
  normalizedTitle: string;
  roleCategory: string;
  seniority: Seniority | null;
  tags: string[];
}

export interface TechnologyDefinition {
  slug: string;
  displayName: string;
  aliases: string[];
  category: "LANGUAGE" | "FRAMEWORK" | "CLOUD" | "DATABASE" | "AI_ML" | "TOOLING" | "OTHER";
}

export interface ExtractedTechnology {
  slug: string;
  displayName: string;
  matchedPhrase: string;
}

export interface SalaryExtractionResult {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
}
