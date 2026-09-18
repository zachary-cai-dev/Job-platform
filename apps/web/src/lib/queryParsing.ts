import type { JobSearchFilters, JobSearchParams, SortField } from "@euro-jobs/search";
import { z } from "zod";
import type { JobsTab } from "./urlFilters.js";

/**
 * When the caller doesn't explicitly choose a region, default to excluding
 * "Worldwide" listings (remote-anywhere postings that don't exclude Europe, but
 * also aren't targeted at it) — surfacing only jobs geography classified as
 * actually Europe/EU/EEA/EMEA. A user can still opt into "Worldwide" postings by
 * checking that box in the region filter, which overrides this default.
 */
export const DEFAULT_REGION_FILTER = ["EU", "EEA", "EUROPE", "EMEA"];

/**
 * What each tab (apps/web/src/lib/urlFilters.ts's `JobsTab`) actually filters
 * on — the single source of truth, used by both `parseJobsQuery` below (client
 * refetch via /api/jobs) and page.tsx's SSR initial fetch, plus newJobsCount.ts's
 * "US remote" case, so the three can't silently drift apart on what the tab means.
 */
export function resolveTabOverrides(
  tab: JobsTab,
  region: string[] | undefined,
  country: string[] | undefined,
): Pick<JobSearchFilters, "region" | "country" | "countryOrWorldwide" | "remoteType"> {
  if (tab === "usRemote") {
    return { region: undefined, country: undefined, countryOrWorldwide: ["US"], remoteType: ["FULLY_REMOTE"] };
  }
  return { region: region ?? DEFAULT_REGION_FILTER, country, countryOrWorldwide: undefined, remoteType: undefined };
}

export const POSTED_WITHIN_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "3d": 72,
  "7d": 168,
  "30d": 720,
};

const SORT_VALUES: SortField[] = ["newest", "oldest", "relevance", "salary_desc", "salary_asc"];

function csv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/**
 * The whole `/api/jobs` query contract, matching brief §23's shape:
 * `?q=typescript&role=full-stack&region=EUROPE&country=GB&seniority=senior
 *   &technology=react,node&postedWithin=24h&sort=newest&page=1`
 *
 * `role`/`seniority`/`technology`/`region`/`country`/`employmentType`/`source` are
 * our own canonical slugs (e.g. `FULL_STACK_ENGINEER`, `REACT`), matched
 * case-insensitively — apps/web's own links always emit canonical slugs, so this
 * isn't a fuzzy free-text mapping layer, just a normalization convenience for
 * hand-typed/bookmarked URLs.
 */
const jobsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  role: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  seniority: z.string().optional(),
  technology: z.string().optional(),
  employmentType: z.string().optional(),
  source: z.string().optional(),
  excludeSource: z.string().optional(),
  salaryMin: z.coerce.number().int().nonnegative().optional(),
  salaryMax: z.coerce.number().int().nonnegative().optional(),
  postedWithin: z.enum(["1h", "6h", "24h", "3d", "7d", "30d"]).optional(),
  sort: z.enum(["newest", "oldest", "relevance", "salary_desc", "salary_asc"]).optional(),
  tab: z.enum(["all", "regionOnly", "usRemote"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type JobsQueryParseResult =
  | { success: true; params: JobSearchParams }
  | { success: false; error: string };

export function parseJobsQuery(searchParams: URLSearchParams): JobsQueryParseResult {
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = jobsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const q = parsed.data;
  const tab: JobsTab = q.tab ?? "all";

  const upper = (values: string[] | undefined) => values?.map((v) => v.toUpperCase());

  const filters: JobSearchFilters = {
    q: q.q,
    roleCategory: upper(csv(q.role ?? null)),
    ...resolveTabOverrides(tab, upper(csv(q.region ?? null)), upper(csv(q.country ?? null))),
    // The "regionOnly" tab (apps/web/src/lib/urlFilters.ts's JobsTab) excludes
    // country/city-specific postings, keeping only jobs whose eligibility came from
    // an explicit broad-region phrase in the posting itself ("Remote - EMEA"), not a
    // named country this app then mapped to a region. Off by default — the "all"
    // tab keeps its normal, much larger, result set.
    regionOnly: tab === "regionOnly",
    seniority: upper(csv(q.seniority ?? null)),
    technology: upper(csv(q.technology ?? null)),
    employmentType: upper(csv(q.employmentType ?? null)),
    sourceSlug: csv(q.source ?? null)?.map((v) => v.toLowerCase()),
    excludeSourceSlug: csv(q.excludeSource ?? null)?.map((v) => v.toLowerCase()),
    salaryMin: q.salaryMin,
    salaryMax: q.salaryMax,
    postedWithinHours: q.postedWithin ? POSTED_WITHIN_HOURS[q.postedWithin] : undefined,
  };

  const sort: SortField = q.sort && SORT_VALUES.includes(q.sort) ? q.sort : "newest";

  return {
    success: true,
    params: { filters, sort, page: q.page ?? 1, pageSize: q.pageSize ?? 20 },
  };
}
