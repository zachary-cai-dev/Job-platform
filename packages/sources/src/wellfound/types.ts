export interface WellfoundJobPosting {
  "@type"?: string;
  title?: string;
  identifier?: { value?: string | number };
  employmentType?: string | string[];
  hiringOrganization?: { name?: string; sameAs?: string };
  description?: string;
  datePosted?: string;
  jobLocationType?: string;
  applicantLocationRequirements?: Array<{ name?: string }> | { name?: string };
  jobLocation?: Array<WellfoundPlace> | WellfoundPlace;
  baseSalary?: {
    currency?: string;
    value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string };
  };
}

interface WellfoundPlace {
  address?: {
    addressLocality?: string;
    addressRegion?: string;
    addressCountry?: string | { name?: string };
  };
}
