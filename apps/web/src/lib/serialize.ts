import type { JobSearchResultItem } from "@euro-jobs/search";
import type { JobListItem } from "./types.js";

/** Server Components can pass Dates to Client Components, but the client-side fetch
 * path (JSON over HTTP) returns strings — normalize both to the same shape. */
export function toJobListItem(item: JobSearchResultItem): JobListItem {
  return { ...item, postedAt: new Date(item.postedAt).toISOString() };
}
