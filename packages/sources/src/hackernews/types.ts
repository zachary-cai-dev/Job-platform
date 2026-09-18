export interface HackerNewsUser {
  submitted: number[];
}

export interface HackerNewsItem {
  id: number;
  type: string;
  by?: string;
  time: number;
  text?: string;
  title?: string;
  kids?: number[];
  deleted?: boolean;
  dead?: boolean;
}
