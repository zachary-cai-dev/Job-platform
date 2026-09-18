export interface SmartRecruitersLocation {
  city?: string;
  country?: string;
  remote?: boolean;
  fullLocation?: string;
}

export interface SmartRecruitersPostingSummary {
  id: string;
  name: string;
  company: { identifier: string; name: string };
  releasedDate?: string;
  location?: SmartRecruitersLocation;
}

export interface SmartRecruitersPostingsListResponse {
  offset: number;
  limit: number;
  totalFound: number;
  content: SmartRecruitersPostingSummary[];
}

export interface SmartRecruitersJobAdSection {
  title?: string;
  text?: string;
}

export interface SmartRecruitersPostingDetail {
  id: string;
  name: string;
  location?: SmartRecruitersLocation;
  releasedDate?: string;
  postingUrl: string;
  applyUrl: string;
  jobAd?: {
    sections?: Record<string, SmartRecruitersJobAdSection>;
  };
}
