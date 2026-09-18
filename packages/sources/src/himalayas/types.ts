export interface HimalayasJob {
  title: string;
  excerpt?: string;
  companyName: string;
  companySlug?: string;
  companyLogo?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null;
  seniority?: string[];
  currency?: string | null;
  locationRestrictions?: string[];
  timezoneRestrictions?: number[];
  categories?: string[];
  parentCategories?: string[];
  description: string;
  pubDate: number;
  expiryDate?: number;
  applicationLink?: string;
  guid: string;
}

export interface HimalayasResponse {
  updatedAt: number;
  offset: number;
  limit: number;
  totalCount: number;
  nextCursor?: string;
  jobs: HimalayasJob[];
}
