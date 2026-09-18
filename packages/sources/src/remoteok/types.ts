export interface RemoteOkLegalNotice {
  legal?: string;
  [key: string]: unknown;
}

export interface RemoteOkJob {
  id: string;
  slug?: string;
  company: string;
  position: string;
  tags?: string[];
  location?: string;
  date?: string;
  url: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
}

/**
 * RemoteOK's public feed returns a single JSON array whose first element is a
 * legal/metadata notice (no `position` field), followed by job objects.
 */
export type RemoteOkResponse = Array<RemoteOkLegalNotice | RemoteOkJob>;

export function isRemoteOkJob(entry: RemoteOkLegalNotice | RemoteOkJob): entry is RemoteOkJob {
  return typeof (entry as RemoteOkJob).position === "string";
}
