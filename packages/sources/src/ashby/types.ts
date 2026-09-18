export interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  publishedAt?: string;
  jobUrl: string;
  applyUrl?: string;
  descriptionHtml?: string;
  isRemote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  compensation?: { minValue?: number; maxValue?: number; currency?: string; interval?: string };
}

export interface AshbyJobBoardResponse {
  jobs: AshbyJob[];
}
