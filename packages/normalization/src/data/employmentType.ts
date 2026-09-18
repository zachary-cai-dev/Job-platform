import type { EmploymentType } from "../types.js";

/** Ordered by specificity — checked in order, first match wins. */
export const EMPLOYMENT_TYPE_KEYWORDS: Array<{ type: EmploymentType; keywords: string[] }> = [
  { type: "FREELANCE", keywords: ["freelance", "freelancer"] },
  { type: "CONTRACT", keywords: ["contract", "contractor", "contract-to-hire", "b2b"] },
  { type: "PART_TIME", keywords: ["part-time", "part time"] },
  { type: "INTERNSHIP", keywords: ["internship", "intern"] },
  { type: "PERMANENT", keywords: ["full-time", "full time", "permanent"] },
];
