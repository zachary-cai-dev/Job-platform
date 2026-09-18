export const REGION_LABELS: Record<string, string> = {
  EUROPE: "Europe",
  EU: "European Union",
  EEA: "EEA",
  EMEA: "EMEA",
  WORLDWIDE: "Worldwide",
};

export const SENIORITY_LABELS: Record<string, string> = {
  INTERNSHIP: "Internship",
  JUNIOR: "Junior",
  MID: "Mid-Level",
  SENIOR: "Senior",
  STAFF: "Staff",
  PRINCIPAL: "Principal",
  LEAD: "Lead",
  MANAGER: "Manager",
  DIRECTOR: "Director",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  PERMANENT: "Permanent",
  CONTRACT: "Contract",
  FREELANCE: "Freelance",
  PART_TIME: "Part-time",
  INTERNSHIP: "Internship",
};

export const POSTED_WITHIN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "1h", label: "Last hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "3d", label: "Last 3 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

export const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "relevance", label: "Relevance" },
  { value: "salary_desc", label: "Salary: high to low" },
  { value: "salary_asc", label: "Salary: low to high" },
];
