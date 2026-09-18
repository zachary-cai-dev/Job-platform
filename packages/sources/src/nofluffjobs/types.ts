export interface NoFluffJobsPlace {
  country?: { code: string; name: string };
  city?: string;
}

export interface NoFluffJobsSalary {
  from?: number;
  to?: number;
  type?: string;
  currency?: string;
  period?: string;
}

export interface NoFluffJobsTile {
  value: string;
  type: string;
}

export interface NoFluffJobsPosting {
  id: string;
  name: string;
  location: {
    places: NoFluffJobsPlace[];
    fullyRemote: boolean;
  };
  posted: number;
  renewed: number;
  title: string;
  technology?: string;
  category?: string;
  seniority?: string[];
  url: string;
  regions?: string[];
  fullyRemote: boolean;
  salary?: NoFluffJobsSalary;
  tiles?: { values: NoFluffJobsTile[] };
}

export interface NoFluffJobsResponse {
  postings: NoFluffJobsPosting[];
}
