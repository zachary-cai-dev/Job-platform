export type SortField = "newest" | "oldest" | "relevance" | "salary_desc" | "salary_asc";

export interface JobSearchFilters {
  /** Full-text keyword search across title/normalizedTitle/skills/description. */
  q?: string;
  /** A company's jobs page (GET /api/companies/:slug) is this filter alone. */
  companySlug?: string;
  roleCategory?: string[];
  region?: string[];
  country?: string[];
  /** Countries accepted directly, plus globally available (`WORLDWIDE`) jobs. */
  countryOrWorldwide?: string[];
  /**
   * When true, excludes any job whose geography classification matched a specific
   * country (`eligibleCountries` non-empty) — keeping only jobs whose eligibility
   * came from an explicit broad-region phrase in the actual posting text ("Remote -
   * EMEA", "fully remote within Europe", "Remote, European Union"), not one this
   * app inferred from a single named country. See
   * packages/geography/src/evaluateEuropeanEligibility.ts's rule 1 vs rule 2.
   */
  regionOnly?: boolean;
  seniority?: string[];
  /** Technology slugs; matches jobs tagged with ANY of the given technologies. */
  technology?: string[];
  employmentType?: string[];
  remoteType?: string[];
  salaryMin?: number;
  salaryMax?: number;
  /** Only jobs posted within this many hours. */
  postedWithinHours?: number;
  /** Restrict to these sources. */
  sourceSlug?: string[];
  /** Exclude these sources (brief §11: allow inclusion/exclusion of individual sources). */
  excludeSourceSlug?: string[];
}

export interface JobSearchParams {
  filters: JobSearchFilters;
  sort: SortField;
  page: number;
  pageSize: number;
}

export interface JobSearchResultItem {
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
  postedAt: Date;
  postedAtIsInferred: boolean;
  applyUrl: string;
  /** The earliest-discovered active listing's source — what the job card labels "Source". */
  source: { slug: string; displayName: string } | null;
}

export interface JobSearchResult {
  items: JobSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FacetCount {
  value: string;
  /** Human-readable label, when it differs from `value` (e.g. technology/role slugs). */
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

/**
 * The search abstraction apps/web depends on — Postgres full-text search for MVP,
 * swappable for Typesense/Meilisearch/OpenSearch later without touching callers
 * (docs/architecture.md §7).
 */
export interface JobSearchService {
  search(params: JobSearchParams): Promise<JobSearchResult>;
  getFilterFacets(): Promise<FilterFacets>;
}
