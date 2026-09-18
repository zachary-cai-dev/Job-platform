/** Client-side mirrors of the API's JSON-serialized shapes (Dates arrive as strings). */

export interface JobListItem {
  id: string;
  title: string;
  normalizedTitle: string;
  roleCategorySlug: string;
  seniority: string | null;
  tags: string[];
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  locationDisplay: string;
  remoteType: string;
  eligibleCountries: string[];
  eligibleRegions: string[];
  geographyConfidence: string;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  technologies: Array<{ slug: string; displayName: string }>;
  postedAt: string;
  postedAtIsInferred: boolean;
  applyUrl: string;
  source: { slug: string; displayName: string } | null;
}

export interface JobListResult {
  items: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FacetCount {
  value: string;
  label: string;
  count: number;
}

export interface FilterFacets {
  roleCategory: FacetCount[];
  region: FacetCount[];
  country: FacetCount[];
  seniority: FacetCount[];
  technology: FacetCount[];
  employmentType: FacetCount[];
  source: FacetCount[];
}

/** Client-side mirror of `apps/web/src/lib/jobDetail.ts`'s `JobDetail` (Dates as strings). */
export interface JobDetailItem {
  id: string;
  title: string;
  normalizedTitle: string;
  roleCategorySlug: string;
  seniority: string | null;
  tags: string[];
  company: { name: string; slug: string; logoUrl: string | null; websiteUrl: string | null };
  description: string;
  locationRaw: string | null;
  locationDisplay: string;
  remoteType: string;
  eligibleCountries: string[];
  eligibleRegions: string[];
  geographyConfidence: string;
  geographyReason: string;
  employmentType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  technologies: Array<{ slug: string; displayName: string }>;
  postedAt: string | null;
  postedAtIsInferred: boolean;
  applyUrl: string;
  isActive: boolean;
  sources: Array<{ slug: string; displayName: string; sourceUrl: string }>;
}

/** New-listing counts since a given timestamp, broken down by source — see NewJobsNotifier. */
export interface NewJobsCount {
  total: number;
  bySource: Array<{ slug: string; displayName: string; count: number }>;
  checkedAt: string;
}
