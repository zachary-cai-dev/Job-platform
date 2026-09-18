import type { SortField } from "@euro-jobs/search";
import { FiltersPanel } from "@/components/FiltersPanel";
import { JobsFeed } from "@/components/JobsFeed";
import { JobsTabSwitcher } from "@/components/JobsTabSwitcher";
import { PostedWithinChips } from "@/components/PostedWithinChips";
import { SearchInput } from "@/components/SearchInput";
import { SortSelect } from "@/components/SortSelect";
import { getSearchService } from "@/lib/db";
import { POSTED_WITHIN_HOURS, resolveTabOverrides } from "@/lib/queryParsing";
import { toJobListItem } from "@/lib/serialize";
import { filterStateToQueryString, parseFilterState } from "@/lib/urlFilters";

export const dynamic = "force-dynamic";

const VALID_SORTS: SortField[] = ["newest", "oldest", "relevance", "salary_desc", "salary_asc"];

function toSortField(value: string): SortField {
  return (VALID_SORTS as string[]).includes(value) ? (value as SortField) : "newest";
}

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Server-rendered: the initial job list is fetched here (directly via the search
 * service, no HTTP round-trip needed) so the first paint has real content — good
 * for both perceived speed and SEO/crawlers. Filter interactions after that happen
 * client-side (see JobsFeed) without a full page reload.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedParams = await searchParams;
  const filterState = parseFilterState(resolvedParams);
  const queryString = filterStateToQueryString(filterState);

  const initialData = await getSearchService().search({
    filters: {
      q: filterState.q || undefined,
      roleCategory: filterState.role.length ? filterState.role : undefined,
      ...resolveTabOverrides(
        filterState.tab,
        filterState.region.length ? filterState.region : undefined,
        filterState.country.length ? filterState.country : undefined,
      ),
      regionOnly: filterState.tab === "regionOnly",
      seniority: filterState.seniority.length ? filterState.seniority : undefined,
      technology: filterState.technology.length ? filterState.technology : undefined,
      employmentType: filterState.employmentType.length ? filterState.employmentType : undefined,
      sourceSlug: filterState.source.length ? filterState.source : undefined,
      postedWithinHours: filterState.postedWithin ? POSTED_WITHIN_HOURS[filterState.postedWithin] : undefined,
    },
    sort: toSortField(filterState.sort),
    page: filterState.page,
    pageSize: 20,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput />
        <SortSelect />
      </div>
      <div className="mb-5">
        <PostedWithinChips />
      </div>

      <JobsTabSwitcher />

      <div className="flex gap-6">
        <FiltersPanel />
        <div className="min-w-0 flex-1">
          <JobsFeed
            initialData={{
              items: initialData.items.map(toJobListItem),
              total: initialData.total,
              page: initialData.page,
              pageSize: initialData.pageSize,
              totalPages: initialData.totalPages,
            }}
            initialQueryString={queryString}
          />
        </div>
      </div>
    </main>
  );
}
