/**
 * Single source of truth for the URL <-> filter-state mapping, shared by the
 * server-rendered initial fetch (page.tsx) and the client-side filter UI — so a
 * search is always fully represented in the URL (bookmarkable/shareable, brief §26)
 * and both sides parse it identically.
 */

export const MULTI_VALUE_KEYS = [
  "role",
  "region",
  "country",
  "seniority",
  "technology",
  "employmentType",
  "source",
] as const;

export type MultiValueKey = (typeof MULTI_VALUE_KEYS)[number];

export type JobsTab = "all" | "regionOnly" | "usRemote";

export interface FilterState {
  q: string;
  role: string[];
  region: string[];
  country: string[];
  seniority: string[];
  technology: string[];
  employmentType: string[];
  source: string[];
  postedWithin: string;
  sort: string;
  page: number;
  /**
   * "all" shows every Europe-eligible job (country-specific postings included);
   * "regionOnly" narrows to jobs whose eligibility came from an explicit broad-
   * region phrase in the posting itself ("Remote - EMEA"), not a specific country
   * this app inferred a region from. See packages/search's `regionOnly` filter.
   */
  tab: JobsTab;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  q: "",
  role: [],
  region: [],
  country: [],
  seniority: [],
  technology: [],
  employmentType: [],
  source: [],
  postedWithin: "",
  sort: "newest",
  page: 1,
  tab: "all",
};

function csv(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

/** Accepts Next.js's server-side `searchParams` shape or a plain query-string record. */
export function parseFilterState(params: Record<string, string | string[] | undefined>): FilterState {
  const get = (key: string): string | undefined => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const tabValue = get("tab");
  const tab: JobsTab = tabValue === "regionOnly" || tabValue === "usRemote" ? tabValue : "all";

  return {
    q: get("q") ?? "",
    role: csv(get("role")),
    region: csv(get("region")),
    country: csv(get("country")),
    seniority: csv(get("seniority")),
    technology: csv(get("technology")),
    employmentType: csv(get("employmentType")),
    source: csv(get("source")),
    postedWithin: get("postedWithin") ?? "",
    sort: get("sort") ?? "newest",
    page: Number(get("page") ?? "1") || 1,
    tab,
  };
}

export function filterStateToQueryString(state: FilterState): string {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  for (const key of MULTI_VALUE_KEYS) {
    const values = state[key];
    if (values.length > 0) sp.set(key, values.join(","));
  }
  if (state.postedWithin) sp.set("postedWithin", state.postedWithin);
  if (state.sort && state.sort !== "newest") sp.set("sort", state.sort);
  if (state.tab !== "all") sp.set("tab", state.tab);
  if (state.page > 1) sp.set("page", String(state.page));
  return sp.toString();
}

/** Toggles a value in a multi-select filter and resets to page 1 (a changed filter invalidates the current page). */
export function toggleMultiValue(state: FilterState, key: MultiValueKey, value: string): FilterState {
  const current = state[key];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...state, [key]: next, page: 1 };
}

export function withUpdate(state: FilterState, updates: Partial<FilterState>): FilterState {
  const resetPage = "page" in updates ? {} : { page: 1 };
  return { ...state, ...updates, ...resetPage };
}
