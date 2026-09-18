export interface FetchJobsOptions {
  /** Incremental-fetch hint; an adapter uses it only if the source supports it. */
  since?: Date;
  /** Resume token from a previous capped run. */
  cursor?: string;
  signal?: AbortSignal;
  /** Existing source identities, allowing detail-heavy adapters to avoid refetching known listings. */
  knownExternalIds?: ReadonlySet<string>;
}

export interface RawJobPayload {
  externalId: string;
  sourceUrl: string;
  applyUrl: string;
  rawTitle: string;
  rawLocation?: string;
  companyUrl?: string;
  remoteType?: "FULLY_REMOTE" | "HYBRID" | "UNKNOWN";
  employmentType?: "PERMANENT" | "CONTRACT" | "FREELANCE" | "PART_TIME" | "INTERNSHIP";
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: "HOURLY" | "DAILY" | "MONTHLY" | "YEARLY";
  /**
   * A single-tenant ATS board (Greenhouse/Lever/Ashby) doesn't include the
   * company's display name in the per-job payload at all — the whole board
   * belongs to one company, supplied via adapter config. RemoteOK is the
   * opposite: it's a multi-company aggregator, so this comes from each job's
   * own `company` field instead. Either way, every adapter must resolve it.
   */
  companyName: string;
  /** Original description as provided — HTML or plain text, whichever the source gives. */
  description: string;
  /** Only set when the source actually provides a genuine posting date. */
  postedAt?: Date;
  /** The full, untouched parsed response for this job — never pre-filtered. */
  rawPayload: unknown;
}

export interface FetchJobsResult {
  jobs: RawJobPayload[];
  /** Present only if the source has more pages than this run fetched. */
  nextCursor?: string;
  /** Known listings seen in this fetch but intentionally omitted from `jobs`. */
  seenKnownExternalIds?: string[];
}

/**
 * Every source adapter implements exactly this. An adapter owns its own HTTP calls,
 * pagination, mapping, retries, and rate limiting internally — it never imports
 * packages/db or packages/jobs, and never persists anything itself. See
 * docs/ingestion.md §2.
 */
export interface JobSourceAdapter {
  /** Matches the `Source.slug` row in the database. */
  source: string;
  fetchJobs(options?: FetchJobsOptions): Promise<FetchJobsResult>;
}
