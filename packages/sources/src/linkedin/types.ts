export type LinkedInWorkplaceType = "remote" | "hybrid" | "on-site";

export interface LinkedInSearchResult {
  externalId: string;
  title: string;
  company: string;
  companyUrl?: string;
  location?: string;
  workplaceType?: LinkedInWorkplaceType;
  jobUrl: string;
  postedAt?: Date;
}

export interface LinkedInSalary {
  min?: number;
  max?: number;
  currency?: string;
  unit?: string;
  text?: string;
}

export interface LinkedInJobDetail extends LinkedInSearchResult {
  description: string;
  employmentType?: string;
  seniority?: string;
  salary?: LinkedInSalary;
  structuredData?: unknown;
}
