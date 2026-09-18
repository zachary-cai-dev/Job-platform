export type {
  SortField,
  JobSearchFilters,
  JobSearchParams,
  JobSearchResultItem,
  JobSearchResult,
  FacetCount,
  FilterFacets,
  JobSearchService,
} from "./types.js";

export { normalizePagination, totalPages, type PaginationInput, type Pagination } from "./pagination.js";
export { buildWhereClause, buildOrderByClause, PostgresJobSearchService } from "./postgresJobSearchService.js";
