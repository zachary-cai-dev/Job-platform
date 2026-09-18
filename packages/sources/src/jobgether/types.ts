export interface JobgetherJob {
  id: string;
  title: string;
  company: string;
  url: string;
  location: string;
  remote: string;
  contractType: string;
  experience: string;
  salaryRange?: string;
  jobFunctions: string[];
  postedAt: string;
}

export interface JobgetherResponse {
  jobs: JobgetherJob[];
  pagination: { page: number; limit: number; hasMore: boolean };
}
