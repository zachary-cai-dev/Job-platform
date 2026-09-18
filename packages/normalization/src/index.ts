export type {
  Seniority,
  EmploymentType,
  SalaryPeriod,
  RoleCategoryDefinition,
  TitleNormalizationResult,
  TechnologyDefinition,
  ExtractedTechnology,
  SalaryExtractionResult,
} from "./types.js";

export { normalizeTitle, extractSeniority } from "./titleNormalization.js";
export { extractTechnologies } from "./technologyExtraction.js";
export { extractEmploymentType } from "./employmentTypeExtraction.js";
export { extractSalary } from "./salaryExtraction.js";
export { ROLE_CATEGORIES, OTHER_ROLE_CATEGORY } from "./data/roleCategories.js";
export { TECHNOLOGIES } from "./data/technologies.js";
