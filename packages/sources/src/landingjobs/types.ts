export interface LandingJobsLocation {
  city?: string;
  country_code?: string;
}

export interface LandingJobsJob {
  id: number;
  currency_code?: string;
  expires_at?: string;
  main_requirements?: string;
  nice_to_have?: string;
  perks?: string;
  relocation_paid?: boolean;
  role_description?: string;
  title: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  type?: string;
  remote?: boolean;
  gross_salary_low?: number;
  gross_salary_high?: number;
  tags?: string[];
  url: string;
  locations?: LandingJobsLocation[];
}

export type LandingJobsResponse = LandingJobsJob[];
