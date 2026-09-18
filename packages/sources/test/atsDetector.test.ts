import { describe, expect, it } from "vitest";
import { detectATS } from "../src/ats/detectATS.js";

describe("detectATS", () => {
  it.each([
    ["https://boards.greenhouse.io/acme/jobs/1", "greenhouse"],
    ["https://jobs.lever.co/acme/1", "lever"],
    ["https://jobs.ashbyhq.com/acme/1", "ashby"],
    ["https://acme.wd3.myworkdayjobs.com/en-US/jobs/job/1", "workday"],
    ["https://jobs.smartrecruiters.com/Acme/1", "smartrecruiters"],
    ["https://apply.workable.com/acme/j/ABC", "workable"],
    ["https://career.acme.teamtailor.com/jobs/1", "teamtailor"],
    ["https://acme.bamboohr.com/careers/1", "bamboohr"],
    ["https://acme.recruitee.com/o/job", "recruitee"],
    ["https://acme.pinpointhq.com/postings/1", "pinpoint"],
    ["https://acme.jobs.personio.com/job/1", "personio"],
  ])("detects %s", (url, expected) => expect(detectATS(url)).toBe(expected));

  it("returns unknown for custom and malformed URLs", () => {
    expect(detectATS("https://careers.example.com/jobs/1")).toBe("unknown");
    expect(detectATS("not a url")).toBe("unknown");
  });
});
