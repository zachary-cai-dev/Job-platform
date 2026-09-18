"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  DEFAULT_FILTER_STATE,
  filterStateToQueryString,
  parseFilterState,
  toggleMultiValue,
  withUpdate,
  type FilterState,
  type MultiValueKey,
} from "./urlFilters.js";

/**
 * The URL is the single source of truth for the current search (brief §26) — every
 * filter/sort/page change here is a `router.push` to a new query string, which both
 * re-triggers the client-side data fetch (JobsFeed's query key includes the query
 * string) and keeps the search bookmarkable/shareable.
 */
export function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<FilterState>(() => {
    const entries: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      entries[key] = value;
    });
    return parseFilterState(entries);
  }, [searchParams]);

  const navigate = useCallback(
    (next: FilterState) => {
      const qs = filterStateToQueryString(next);
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const toggle = useCallback((key: MultiValueKey, value: string) => navigate(toggleMultiValue(state, key, value)), [
    state,
    navigate,
  ]);

  const update = useCallback((updates: Partial<FilterState>) => navigate(withUpdate(state, updates)), [
    state,
    navigate,
  ]);

  const clearAll = useCallback(() => navigate(DEFAULT_FILTER_STATE), [navigate]);

  return { state, toggle, update, clearAll };
}
