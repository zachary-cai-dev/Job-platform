export interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  offices?: Array<{ name: string }>;
}

export interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[];
}
