import { describe, expect, it } from "vitest";
import { extractEmploymentType } from "../src/employmentTypeExtraction.js";

describe("extractEmploymentType", () => {
  it("detects each explicit employment type", () => {
    expect(extractEmploymentType("This is a contract role")).toBe("CONTRACT");
    expect(extractEmploymentType("Freelance opportunity")).toBe("FREELANCE");
    expect(extractEmploymentType("Part-time, 20 hours/week")).toBe("PART_TIME");
    expect(extractEmploymentType("Summer internship")).toBe("INTERNSHIP");
    expect(extractEmploymentType("Full-time, permanent position")).toBe("PERMANENT");
  });

  it("never guesses when no keyword is present", () => {
    expect(extractEmploymentType("Senior Backend Engineer")).toBeNull();
  });

  it("scans across multiple provided fields", () => {
    expect(extractEmploymentType("Senior Engineer", undefined, "This is a 6-month contract")).toBe(
      "CONTRACT",
    );
  });
});
