export type ATSName =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "smartrecruiters"
  | "workable"
  | "teamtailor"
  | "bamboohr"
  | "recruitee"
  | "pinpoint"
  | "personio"
  | "unknown";

const HOST_RULES: Array<[ATSName, RegExp]> = [
  ["greenhouse", /(^|\.)boards\.greenhouse\.io$|(^|\.)job-boards\.greenhouse\.io$/i],
  ["lever", /(^|\.)jobs\.lever\.co$/i],
  ["ashby", /(^|\.)jobs\.ashbyhq\.com$/i],
  ["workday", /(^|\.)myworkdayjobs\.com$/i],
  ["smartrecruiters", /(^|\.)jobs\.smartrecruiters\.com$/i],
  ["workable", /(^|\.)apply\.workable\.com$/i],
  ["teamtailor", /(^|\.)teamtailor\.com$/i],
  ["bamboohr", /(^|\.)bamboohr\.com$/i],
  ["recruitee", /(^|\.)recruitee\.com$/i],
  ["pinpoint", /(^|\.)pinpointhq\.com$/i],
  ["personio", /(^|\.)jobs\.personio\.(com|de)$/i],
];

export function detectATS(value: string): ATSName {
  try {
    const hostname = new URL(value).hostname;
    return HOST_RULES.find(([, rule]) => rule.test(hostname))?.[0] ?? "unknown";
  } catch {
    return "unknown";
  }
}
