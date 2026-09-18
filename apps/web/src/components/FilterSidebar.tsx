"use client";

import { X } from "lucide-react";
import { FilterSection } from "@/components/FilterSection";
import { Button } from "@/components/ui/Button";
import { EMPLOYMENT_TYPE_LABELS, REGION_LABELS, SENIORITY_LABELS } from "@/lib/labels";
import { useFilterNavigation } from "@/lib/useFilterNavigation";
import type { FilterFacets } from "@/lib/types";

function withLabels(
  facetGroup: FilterFacets[keyof FilterFacets] | undefined,
  overrides: Record<string, string> = {},
) {
  return (facetGroup ?? []).map((f) => ({
    value: f.value,
    count: f.count,
    label: overrides[f.value] ?? f.label,
  }));
}

export function FilterSidebar({ facets }: { facets: FilterFacets | undefined }) {
  const { state, toggle, clearAll } = useFilterNavigation();

  const activeCount =
    state.role.length +
    state.region.length +
    state.country.length +
    state.seniority.length +
    state.technology.length +
    state.employmentType.length +
    state.source.length;

  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 gap-1 px-2 text-xs">
            <X className="h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
      </div>

      <FilterSection
        title="Role"
        options={withLabels(facets?.roleCategory)}
        selected={state.role}
        onToggle={(v) => toggle("role", v)}
      />
      {state.tab !== "usRemote" && (
        <>
          <FilterSection
            title="Region"
            options={withLabels(facets?.region, REGION_LABELS)}
            selected={state.region}
            onToggle={(v) => toggle("region", v)}
          />
          <FilterSection
            title="Country"
            options={withLabels(facets?.country)}
            selected={state.country}
            onToggle={(v) => toggle("country", v)}
            maxVisible={12}
          />
        </>
      )}
      <FilterSection
        title="Seniority"
        options={withLabels(facets?.seniority, SENIORITY_LABELS)}
        selected={state.seniority}
        onToggle={(v) => toggle("seniority", v)}
      />
      <FilterSection
        title="Technology"
        options={withLabels(facets?.technology)}
        selected={state.technology}
        onToggle={(v) => toggle("technology", v)}
        maxVisible={12}
      />
      <FilterSection
        title="Employment type"
        options={withLabels(facets?.employmentType, EMPLOYMENT_TYPE_LABELS)}
        selected={state.employmentType}
        onToggle={(v) => toggle("employmentType", v)}
      />
      <FilterSection
        title="Source"
        options={withLabels(facets?.source)}
        selected={state.source}
        onToggle={(v) => toggle("source", v)}
      />
    </div>
  );
}
