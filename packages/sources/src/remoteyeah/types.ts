/** The schema.org JobPosting JSON-LD block RemoteYeah embeds on every job detail page (for Google for Jobs indexing) — the structured data this adapter reads instead of parsing visible HTML/CSS selectors. */
export interface RemoteYeahJobPosting {
  "@type": "JobPosting";
  title: string;
  description: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string[];
  applicantLocationRequirements?: Array<{ "@type": string; name: string }>;
  jobLocationType?: string;
  hiringOrganization?: { name: string; sameAs?: string; logo?: string };
  baseSalary?: {
    currency?: string;
    value?: { minValue?: number | null; maxValue?: number | null; unitText?: string };
  };
  skills?: string;
}
