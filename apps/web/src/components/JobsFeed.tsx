"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { JobCard } from "@/components/JobCard";
import { JobDetailDrawer } from "@/components/JobDetailDrawer";
import { Pagination } from "@/components/Pagination";
import { fetchJobs } from "@/lib/apiClient";
import { filterStateToQueryString } from "@/lib/urlFilters";
import { useFilterNavigation } from "@/lib/useFilterNavigation";
import type { JobListResult } from "@/lib/types";

function JobListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[104px] animate-pulse rounded-lg border border-border bg-muted/50" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border py-16 text-center">
      <p className="text-sm font-medium text-foreground">No jobs match these filters</p>
      <p className="mt-1 text-sm text-muted-foreground">Try widening your search or clearing a filter.</p>
    </div>
  );
}

/**
 * The initial render uses server-fetched data (SSR — fast first paint, real content
 * for crawlers, per docs/architecture.md §7's SSR-for-SEO/CSR-for-filtering split).
 * `initialData` only seeds the query matching the exact search that produced it —
 * once the URL changes (a filter/sort/page interaction), this fetches fresh from
 * /api/jobs client-side without a full page navigation.
 */
export function JobsFeed({
  initialData,
  initialQueryString,
}: {
  initialData: JobListResult;
  initialQueryString: string;
}) {
  const { state } = useFilterNavigation();
  const queryString = filterStateToQueryString(state);
  const initialQueryStringRef = useRef(initialQueryString);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["jobs", queryString],
    queryFn: () => fetchJobs(queryString),
    initialData: queryString === initialQueryStringRef.current ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  if (isError) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Something went wrong loading jobs.</p>;
  }

  if (!data) {
    return <JobListSkeleton />;
  }

  return (
    <div>
      <div className="mb-3 text-sm text-muted-foreground">
        <span className={isFetching ? "opacity-60" : undefined}>
          {data.total.toLocaleString()} remote tech job{data.total === 1 ? "" : "s"}
        </span>
      </div>

      {data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {data.items.map((job) => (
            <JobCard key={job.id} job={job} onOpen={setSelectedJobId} />
          ))}
        </div>
      )}

      <Pagination page={data.page} totalPages={data.totalPages} />

      <JobDetailDrawer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
    </div>
  );
}
