export interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary?: string;
  description: string;
  company_logo_url?: string;
}

export interface RemotiveResponse {
  "job-count": number;
  "total-job-count": number;
  jobs: RemotiveJob[];
}
