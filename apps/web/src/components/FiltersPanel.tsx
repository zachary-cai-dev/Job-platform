"use client";

import { useQuery } from "@tanstack/react-query";
import { FilterDrawer } from "@/components/FilterDrawer";
import { FilterSidebar } from "@/components/FilterSidebar";
import { fetchFilterFacets } from "@/lib/apiClient";
import { useFilterNavigation } from "@/lib/useFilterNavigation";

/** Fetches facet counts once and feeds both the desktop sidebar and mobile drawer. */
export function FiltersPanel() {
  const { data: facets } = useQuery({
    queryKey: ["filters"],
    queryFn: fetchFilterFacets,
    staleTime: 5 * 60_000,
  });
  const { state } = useFilterNavigation();

  const activeCount =
    state.role.length +
    state.region.length +
    state.country.length +
    state.seniority.length +
    state.technology.length +
    state.employmentType.length +
    state.source.length;

  return (
    <>
      <div className="mb-4">
        <FilterDrawer facets={facets} activeCount={activeCount} />
      </div>
      <aside className="hidden lg:block lg:w-64 lg:shrink-0">
        <FilterSidebar facets={facets} />
      </aside>
    </>
  );
}
