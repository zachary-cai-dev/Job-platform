import { describe, expect, it } from "vitest";
import { extractSeniority, normalizeTitle } from "../src/titleNormalization.js";

describe("normalizeTitle", () => {
  it("matches the brief's worked example exactly", () => {
    const result = normalizeTitle("Sr. Fullstack Software Developer - AI Platform");
    expect(result.normalizedTitle).toBe("Senior Full Stack Software Engineer");
    expect(result.roleCategory).toBe("FULL_STACK_ENGINEER");
    expect(result.seniority).toBe("SENIOR");
    expect(result.tags.sort()).toEqual(["ai", "full-stack", "software-engineering"].sort());
  });

  it("does not repeat a seniority word already present in the category label", () => {
    // Real-world case caught via live data: "Manager, Engineering Manager" must not
    // normalize to "Manager Engineering Manager".
    const result = normalizeTitle("Engineering Manager, Trusted Agentic Development");
    expect(result.roleCategory).toBe("ENGINEERING_MANAGEMENT");
    expect(result.seniority).toBe("MANAGER");
    expect(result.normalizedTitle).toBe("Engineering Manager");
  });

  it("keeps a seniority prefix that does not overlap with the category label", () => {
    const result = normalizeTitle("Director of Engineering, Security Factory");
    expect(result.roleCategory).toBe("ENGINEERING_MANAGEMENT");
    expect(result.seniority).toBe("DIRECTOR");
    expect(result.normalizedTitle).toBe("Director Engineering Manager");
  });

  it("detects generic Software Engineer with no seniority keyword", () => {
    const result = normalizeTitle("Software Engineer");
    expect(result.roleCategory).toBe("SOFTWARE_ENGINEER");
    expect(result.seniority).toBeNull();
    expect(result.normalizedTitle).toBe("Software Engineer");
  });

  it("prefers discipline categories over the generic fallback", () => {
    expect(normalizeTitle("Backend Engineer").roleCategory).toBe("BACKEND_ENGINEER");
    expect(normalizeTitle("Frontend Developer").roleCategory).toBe("FRONTEND_ENGINEER");
    expect(normalizeTitle("DevOps Engineer").roleCategory).toBe("DEVOPS_ENGINEER");
    expect(normalizeTitle("Site Reliability Engineer").roleCategory).toBe("SITE_RELIABILITY_ENGINEER");
  });

  it("resolves iOS/Android before generic mobile", () => {
    expect(normalizeTitle("iOS Engineer").roleCategory).toBe("IOS_ENGINEER");
    expect(normalizeTitle("Android Developer").roleCategory).toBe("ANDROID_ENGINEER");
    expect(normalizeTitle("Mobile Engineer").roleCategory).toBe("MOBILE_ENGINEER");
  });

  it("resolves AI vs ML distinctly", () => {
    expect(normalizeTitle("Machine Learning Engineer").roleCategory).toBe("ML_ENGINEER");
    expect(normalizeTitle("AI Engineer").roleCategory).toBe("AI_ENGINEER");
    expect(normalizeTitle("Generative AI Engineer").roleCategory).toBe("AI_ENGINEER");
  });

  it("falls back to OTHER and keeps the original title when nothing matches", () => {
    const result = normalizeTitle("Chief Vibes Officer");
    expect(result.roleCategory).toBe("OTHER");
    expect(result.normalizedTitle).toBe("Chief Vibes Officer");
    expect(result.seniority).toBeNull();
  });

  it("compound seniority: manager outranks a bare senior mention", () => {
    expect(extractSeniority("Senior Engineering Manager")).toBe("MANAGER");
  });

  it("extracts each seniority level correctly", () => {
    expect(extractSeniority("Junior Software Engineer")).toBe("JUNIOR");
    expect(extractSeniority("Staff Software Engineer")).toBe("STAFF");
    expect(extractSeniority("Principal Engineer")).toBe("PRINCIPAL");
    expect(extractSeniority("Engineering Director")).toBe("DIRECTOR");
    expect(extractSeniority("Software Engineering Intern")).toBe("INTERNSHIP");
  });

  it("never guesses a seniority when none is stated", () => {
    expect(extractSeniority("Backend Engineer")).toBeNull();
  });
});
