import type { PrismaClient } from "@euro-jobs/db";
import { normalizePagination, totalPages } from "./pagination.js";
import type {
  FacetCount,
  FilterFacets,
  JobSearchFilters,
  JobSearchParams,
  JobSearchResult,
  JobSearchResultItem,
  JobSearchService,
  SortField,
} from "./types.js";

/**
 * A plain-data SQL fragment: `sql` uses Postgres positional placeholders ($1, $2,
 * ...) numbered locally (starting at 1) within this fragment alone; `values` holds
 * the matching parameters in order. Deliberately NOT `Prisma.Sql` (the tagged-
 * template type `Prisma.sql`/`Prisma.join` produce) — composing a `Prisma.Sql` built
 * in one call into another `$queryRaw` template (even within the same module/
 * function-call-chain) broke under Next.js dev-mode's webpack bundling: the nested
 * value got serialized as a jsonb parameter instead of inlined SQL (Postgres error
 * 42804), reproducible for `search` below but never for the single flat template in
 * `getFilterFacets`. Plain objects carry no such risk, so the whole dynamic
 * WHERE/ORDER BY/LIMIT/OFFSET here is built as data and executed via
 * `$queryRawUnsafe(sql, ...values)` instead of nested tagged templates. Still fully
 * parameterized — filter values only ever go into `values`, never spliced into
 * `sql` text (docs/architecture.md §7 on injection safety).
 */
interface SqlFragment {
  sql: string;
  values: unknown[];
}

function frag(sql: string, ...values: unknown[]): SqlFragment {
  return { sql, values };
}

/** `column IN ($1, $2, ...)` sized to `values.length`. */
function inFragment(column: string, values: readonly string[]): SqlFragment {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  return frag(`${column} IN (${placeholders})`, ...values);
}

/**
 * Concatenates fragments (each locally numbered from $1) into one fragment with
 * globally sequential placeholders, joined by `joiner` in the output SQL text.
 */
function joinFragments(fragments: SqlFragment[], joiner: string): SqlFragment {
  let offset = 0;
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const fragment of fragments) {
    parts.push(fragment.sql.replace(/\$(\d+)/g, (_, n: string) => `$${Number(n) + offset}`));
    values.push(...fragment.values);
    offset += fragment.values.length;
  }
  return { sql: parts.join(joiner), values };
}

/**
 * Builds the `WHERE` fragment for the live jobs feed from typed filters — this is
 * the one place raw SQL is hand-written for search (docs/architecture.md §7), so
 * it's the one place that needs to be scrupulous about injection safety. Pure and
 * DB-free: testable by inspecting the resulting fragment's `.sql`/`.values`, no
 * live database needed.
 */
export function buildWhereClause(filters: JobSearchFilters, now: Date): SqlFragment {
  const conditions: SqlFragment[] = [frag('j."isActive" = true')];

  if (filters.q?.trim()) {
    conditions.push(frag(`j."searchVector" @@ websearch_to_tsquery('english', $1)`, filters.q));
  }
  if (filters.companySlug) {
    conditions.push(frag("c.slug = $1", filters.companySlug));
  }
  if (filters.roleCategory?.length) {
    conditions.push(inFragment('j."roleCategorySlug"', filters.roleCategory));
  }
  if (filters.region?.length) {
    conditions.push(frag(`j."eligibleRegions"::text[] && $1::text[]`, filters.region));
  }
  if (filters.country?.length) {
    conditions.push(frag(`j."eligibleCountries" && $1::text[]`, filters.country));
  }
  if (filters.countryOrWorldwide?.length) {
    conditions.push(
      frag(
        `(j."eligibleCountries" && $1::text[] OR j."eligibleRegions"::text[] && ARRAY['WORLDWIDE']::text[])`,
        filters.countryOrWorldwide,
      ),
    );
  }
  if (filters.regionOnly) {
    conditions.push(frag(`array_length(j."eligibleCountries", 1) IS NULL`));
  }
  if (filters.seniority?.length) {
    conditions.push(inFragment("j.seniority::text", filters.seniority));
  }
  if (filters.employmentType?.length) {
    conditions.push(inFragment('j."employmentType"::text', filters.employmentType));
  }
  if (filters.remoteType?.length) {
    conditions.push(inFragment('j."remoteType"::text', filters.remoteType));
  }
  if (filters.technology?.length) {
    const inTech = inFragment('jt."technologySlug"', filters.technology);
    conditions.push(
      frag(
        `EXISTS (SELECT 1 FROM job_technologies jt WHERE jt."jobId" = j.id AND ${inTech.sql})`,
        ...inTech.values,
      ),
    );
  }
  if (filters.salaryMin != null) {
    conditions.push(frag('j."salaryMax" >= $1', filters.salaryMin));
  }
  if (filters.salaryMax != null) {
    conditions.push(frag('j."salaryMin" <= $1', filters.salaryMax));
  }
  if (filters.postedWithinHours != null) {
    const cutoff = new Date(now.getTime() - filters.postedWithinHours * 60 * 60 * 1000);
    conditions.push(frag('j."postedAt" >= $1', cutoff));
  }
  if (filters.sourceSlug?.length) {
    const inSource = inFragment('jsl."sourceSlug"', filters.sourceSlug);
    conditions.push(
      frag(
        `EXISTS (SELECT 1 FROM job_source_listings jsl WHERE jsl."jobId" = j.id AND jsl."isActive" = true AND ${inSource.sql})`,
        ...inSource.values,
      ),
    );
  }
  if (filters.excludeSourceSlug?.length) {
    const inExcluded = inFragment('jsl."sourceSlug"', filters.excludeSourceSlug);
    conditions.push(
      frag(
        `NOT EXISTS (SELECT 1 FROM job_source_listings jsl WHERE jsl."jobId" = j.id AND jsl."isActive" = true AND ${inExcluded.sql})`,
        ...inExcluded.values,
      ),
    );
  }

  return joinFragments(conditions, " AND ");
}

/** `relevance` without a keyword query has nothing to rank by — falls back to newest. */
export function buildOrderByClause(sort: SortField, q: string | undefined): SqlFragment {
  switch (sort) {
    case "relevance":
      return q?.trim()
        ? frag(`ts_rank(j."searchVector", websearch_to_tsquery('english', $1)) DESC, j."postedAt" DESC`, q)
        : frag('j."postedAt" DESC');
    case "oldest":
      return frag('j."postedAt" ASC');
    case "salary_desc":
      return frag('j."salaryMax" DESC NULLS LAST, j."postedAt" DESC');
    case "salary_asc":
      return frag('j."salaryMin" ASC NULLS LAST, j."postedAt" DESC');
    case "newest":
    default:
      return frag('j."postedAt" DESC');
  }
}

interface RawSearchRow {
  id: string;
  title: string;
  normalizedTitle: string;
  roleCategorySlug: string;
  seniority: string | null;
  tags: string[];
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
  postedAt: Date;
  postedAtIsInferred: boolean;
  applyUrl: string;
  companyName: string;
  companySlug: string;
  companyLogoUrl: string | null;
  sourceSlug: string | null;
  sourceDisplayName: string | null;
  totalCount: number;
}

interface FacetRow {
  value: string;
  label: string;
  count: number;
}

/**
 * Postgres-FTS-backed `JobSearchService`. The one implementation for MVP — swapping
 * to Typesense/Meilisearch/OpenSearch later means writing a new class against this
 * same interface, not touching `apps/web` (docs/architecture.md §7).
 */
export class PostgresJobSearchService implements JobSearchService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async search(params: JobSearchParams): Promise<JobSearchResult> {
    const { page, pageSize, offset } = normalizePagination(params);

    const whereFragment = buildWhereClause(params.filters, this.now());
    const orderByFragment = buildOrderByClause(params.sort, params.filters.q);
    const { sql: sqlParts, values } = joinFragmentsKeepingBoundaries([
      whereFragment,
      orderByFragment,
      frag("$1", pageSize),
      frag("$1", offset),
    ]);
    const [whereSql, orderBySql, limitSql, offsetSql] = sqlParts;

    const sql = `
      SELECT
        j.id, j.title, j."normalizedTitle", j."roleCategorySlug", j.seniority, j.tags,
        j."locationDisplay", j."remoteType",
        j."eligibleCountries", j."eligibleRegions"::text[] AS "eligibleRegions",
        j."geographyConfidence"::text AS "geographyConfidence",
        j."employmentType"::text AS "employmentType",
        j."salaryMin", j."salaryMax", j."salaryCurrency", j."salaryPeriod"::text AS "salaryPeriod",
        j."postedAt", j."postedAtIsInferred", j."applyUrl",
        c.name AS "companyName", c.slug AS "companySlug", c."logoUrl" AS "companyLogoUrl",
        src."sourceSlug" AS "sourceSlug", src."displayName" AS "sourceDisplayName",
        count(*) OVER ()::int AS "totalCount"
      FROM "jobs" j
      JOIN "companies" c ON c.id = j."companyId"
      LEFT JOIN LATERAL (
        SELECT jsl."sourceSlug", s."displayName"
        FROM "job_source_listings" jsl
        JOIN "sources" s ON s.slug = jsl."sourceSlug"
        WHERE jsl."jobId" = j.id
        ORDER BY jsl."firstDiscoveredAt" ASC
        LIMIT 1
      ) src ON true
      WHERE ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ${limitSql} OFFSET ${offsetSql}
    `;

    const rows = await this.prisma.$queryRawUnsafe<RawSearchRow[]>(sql, ...values);

    const total = rows[0]?.totalCount ?? 0;
    const technologiesByJob = await this.fetchTechnologies(rows.map((row) => row.id));

    const items: JobSearchResultItem[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      normalizedTitle: row.normalizedTitle,
      roleCategorySlug: row.roleCategorySlug,
      seniority: row.seniority,
      tags: row.tags,
      companyName: row.companyName,
      companySlug: row.companySlug,
      companyLogoUrl: row.companyLogoUrl,
      locationDisplay: row.locationDisplay,
      remoteType: row.remoteType,
      eligibleCountries: row.eligibleCountries,
      eligibleRegions: row.eligibleRegions,
      geographyConfidence: row.geographyConfidence,
      employmentType: row.employmentType,
      salaryMin: row.salaryMin,
      salaryMax: row.salaryMax,
      salaryCurrency: row.salaryCurrency,
      salaryPeriod: row.salaryPeriod,
      technologies: technologiesByJob.get(row.id) ?? [],
      postedAt: row.postedAt,
      postedAtIsInferred: row.postedAtIsInferred,
      applyUrl: row.applyUrl,
      source: row.sourceSlug && row.sourceDisplayName ? { slug: row.sourceSlug, displayName: row.sourceDisplayName } : null,
    }));

    return { items, total, page, pageSize, totalPages: totalPages(total, pageSize) };
  }

  private async fetchTechnologies(
    jobIds: string[],
  ): Promise<Map<string, Array<{ slug: string; displayName: string }>>> {
    if (jobIds.length === 0) return new Map();

    const rows = await this.prisma.jobTechnology.findMany({
      where: { jobId: { in: jobIds } },
      include: { technology: { select: { displayName: true } } },
    });

    const map = new Map<string, Array<{ slug: string; displayName: string }>>();
    for (const row of rows) {
      const list = map.get(row.jobId) ?? [];
      list.push({ slug: row.technologySlug, displayName: row.technology.displayName });
      map.set(row.jobId, list);
    }
    return map;
  }

  async getFilterFacets(): Promise<FilterFacets> {
    // One round-trip via UNION ALL rather than seven concurrent $queryRaw calls —
    // besides being faster, this sidesteps a real reliability issue hit against
    // Supabase's pooler: seven simultaneous connections from one Promise.all burst
    // intermittently failed to connect (P1001) where a single query never did. No
    // dynamic values here, so a plain flat $queryRaw template is fine as-is.
    const rows = await this.prisma.$queryRaw<Array<FacetRow & { facet: string }>>`
      SELECT 'roleCategory' AS facet, j."roleCategorySlug" AS value, rc.label AS label, count(*)::int AS count
      FROM "jobs" j JOIN "role_categories" rc ON rc.slug = j."roleCategorySlug"
      WHERE j."isActive" = true GROUP BY 1, 2, 3

      UNION ALL
      SELECT 'region', unnest("eligibleRegions")::text, unnest("eligibleRegions")::text, count(*)::int
      FROM "jobs" WHERE "isActive" = true GROUP BY 1, 2, 3

      UNION ALL
      SELECT 'country', country, country, count(*)::int
      FROM (
        SELECT unnest("eligibleCountries") AS country FROM "jobs" WHERE "isActive" = true
      ) uc
      -- "US" is offered only via the "US remote" tab (countryOrWorldwide filter,
      -- not this checkbox list) — showing it here would let a viewer pick
      -- country=US on the Europe-default tabs, where it's ANDed against the
      -- default region filter (EU/EEA/EUROPE/EMEA) and silently yields zero
      -- results despite the facet count implying otherwise.
      WHERE country != 'US'
      GROUP BY 1, 2, 3

      UNION ALL
      SELECT 'seniority', seniority::text, seniority::text, count(*)::int
      FROM "jobs" WHERE "isActive" = true AND seniority IS NOT NULL GROUP BY 1, 2, 3

      UNION ALL
      SELECT 'technology', jt."technologySlug", t."displayName", count(*)::int
      FROM "job_technologies" jt
      JOIN "jobs" j ON j.id = jt."jobId"
      JOIN "technologies" t ON t.slug = jt."technologySlug"
      WHERE j."isActive" = true GROUP BY 1, 2, 3

      UNION ALL
      SELECT 'employmentType', "employmentType"::text, "employmentType"::text, count(*)::int
      FROM "jobs" WHERE "isActive" = true AND "employmentType" IS NOT NULL GROUP BY 1, 2, 3

      UNION ALL
      SELECT 'source', jsl."sourceSlug", s."displayName", count(DISTINCT j.id)::int
      FROM "job_source_listings" jsl
      JOIN "jobs" j ON j.id = jsl."jobId"
      JOIN "sources" s ON s.slug = jsl."sourceSlug"
      WHERE j."isActive" = true AND jsl."isActive" = true GROUP BY 1, 2, 3

      ORDER BY 1, 4 DESC
    `;

    const byFacet = (facet: string): FacetCount[] =>
      rows.filter((r) => r.facet === facet).map((r) => ({ value: r.value, label: r.label, count: r.count }));

    return {
      roleCategory: byFacet("roleCategory"),
      region: byFacet("region"),
      country: byFacet("country"),
      seniority: byFacet("seniority"),
      technology: byFacet("technology"),
      employmentType: byFacet("employmentType"),
      source: byFacet("source"),
    };
  }
}

/** Like `joinFragments`, but returns each fragment's renumbered SQL separately (not joined) alongside the combined values, for callers that need to place each piece independently in a larger template. */
function joinFragmentsKeepingBoundaries(fragments: SqlFragment[]): { sql: string[]; values: unknown[] } {
  let offset = 0;
  const sql: string[] = [];
  const values: unknown[] = [];
  for (const fragment of fragments) {
    sql.push(fragment.sql.replace(/\$(\d+)/g, (_, n: string) => `$${Number(n) + offset}`));
    values.push(...fragment.values);
    offset += fragment.values.length;
  }
  return { sql, values };
}
