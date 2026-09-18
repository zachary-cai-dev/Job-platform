"use client";

import { cn } from "@/lib/cn";
import { useFilterNavigation } from "@/lib/useFilterNavigation";
import type { JobsTab } from "@/lib/urlFilters";

const TABS: Array<{ value: JobsTab; label: string; description: string }> = [
  { value: "all", label: "Europe", description: "Every Europe-eligible job, including country-specific postings" },
  {
    value: "regionOnly",
    label: "EMEA / EU / EEA / Europe only",
    description: "Only postings whose own location says a broad region, not a specific country",
  },
  {
    value: "usRemote",
    label: "US remote",
    description: "Fully remote jobs open to US candidates, including worldwide roles",
  },
];

/** Switches between the full Europe-eligible list and the narrower "explicit broad-region text only" view (see packages/search's regionOnly filter). */
export function JobsTabSwitcher() {
  const { state, update } = useFilterNavigation();

  return (
    <div role="tablist" aria-label="Job list view" className="mb-5 flex w-fit max-w-full flex-wrap rounded-lg border border-border bg-muted p-1">
      {TABS.map((tab) => {
        const active = state.tab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={tab.description}
            onClick={() => update({ tab: tab.value, region: [], country: [] })}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
