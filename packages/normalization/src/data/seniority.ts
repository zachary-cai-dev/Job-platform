import type { Seniority } from "../types.js";

/**
 * Ordered by priority (most specific / highest-ranking first) so a compound title
 * like "Senior Engineering Manager" resolves to MANAGER rather than SENIOR.
 * Absence of any keyword leaves seniority `null` — it is never guessed.
 */
export const SENIORITY_KEYWORDS: Array<{ level: Seniority; keywords: string[] }> = [
  { level: "DIRECTOR", keywords: ["director"] },
  { level: "MANAGER", keywords: ["manager"] },
  { level: "PRINCIPAL", keywords: ["principal"] },
  { level: "STAFF", keywords: ["staff"] },
  { level: "LEAD", keywords: ["lead", "tech lead", "technical lead"] },
  { level: "SENIOR", keywords: ["senior", "sr.", "sr"] },
  { level: "JUNIOR", keywords: ["junior", "jr.", "jr"] },
  { level: "INTERNSHIP", keywords: ["internship", "intern"] },
  { level: "MID", keywords: ["mid-level", "mid level", "midlevel", "mid-senior"] },
];

export const SENIORITY_LABEL: Record<Seniority, string> = {
  INTERNSHIP: "Intern",
  JUNIOR: "Junior",
  MID: "Mid-Level",
  SENIOR: "Senior",
  STAFF: "Staff",
  PRINCIPAL: "Principal",
  LEAD: "Lead",
  MANAGER: "Manager",
  DIRECTOR: "Director",
};
