import { describe, expect, it } from "vitest";
import { reconcileJobFields } from "../src/reconciliation.js";

const NOW = new Date("2026-09-15T00:00:00Z");

const baseExisting = {
  postedAt: new Date("2026-09-05T00:00:00Z"),
  postedAtIsInferred: false,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
};

const baseIncoming = {
  postedAt: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
  salaryPeriod: null,
};

describe("reconcileJobFields — postedAt", () => {
  it("keeps the existing real date when the incoming date is later", () => {
    const result = reconcileJobFields(
      baseExisting,
      { ...baseIncoming, postedAt: new Date("2026-09-12T00:00:00Z") },
      NOW,
    );
    expect(result.postedAt).toEqual(baseExisting.postedAt);
    expect(result.postedAtIsInferred).toBe(false);
  });

  it("adopts the incoming date when it is an earlier real date", () => {
    const result = reconcileJobFields(
      baseExisting,
      { ...baseIncoming, postedAt: new Date("2026-09-01T00:00:00Z") },
      NOW,
    );
    expect(result.postedAt).toEqual(new Date("2026-09-01T00:00:00Z"));
    expect(result.postedAtIsInferred).toBe(false);
  });

  it("a real incoming date always replaces an inferred existing one", () => {
    const inferredExisting = { ...baseExisting, postedAtIsInferred: true, postedAt: NOW };
    const result = reconcileJobFields(
      inferredExisting,
      { ...baseIncoming, postedAt: new Date("2026-09-20T00:00:00Z") }, // even a later real date
      NOW,
    );
    expect(result.postedAt).toEqual(new Date("2026-09-20T00:00:00Z"));
    expect(result.postedAtIsInferred).toBe(false);
  });

  it("keeps the inferred date when neither side has a real one", () => {
    const inferredExisting = { ...baseExisting, postedAtIsInferred: true, postedAt: NOW };
    const result = reconcileJobFields(inferredExisting, baseIncoming, NOW);
    expect(result.postedAt).toEqual(NOW);
    expect(result.postedAtIsInferred).toBe(true);
  });

  it("falls back to now when the existing job has no postedAt at all", () => {
    const noDateExisting = { ...baseExisting, postedAt: null, postedAtIsInferred: true };
    const result = reconcileJobFields(noDateExisting, baseIncoming, NOW);
    expect(result.postedAt).toEqual(NOW);
    expect(result.postedAtIsInferred).toBe(true);
  });
});

describe("reconcileJobFields — salary", () => {
  it("fills in salary when the existing job has none", () => {
    const result = reconcileJobFields(baseExisting, {
      ...baseIncoming,
      salaryMin: 80000,
      salaryMax: 100000,
      salaryCurrency: "EUR",
      salaryPeriod: "YEARLY",
    }, NOW);
    expect(result.salaryMin).toBe(80000);
    expect(result.salaryMax).toBe(100000);
    expect(result.salaryCurrency).toBe("EUR");
    expect(result.salaryPeriod).toBe("YEARLY");
  });

  it("never overwrites an existing salary with an incoming one", () => {
    const withSalary = { ...baseExisting, salaryMin: 70000, salaryMax: 90000, salaryCurrency: "EUR", salaryPeriod: "YEARLY" as const };
    const result = reconcileJobFields(withSalary, {
      ...baseIncoming,
      salaryMin: 150000,
      salaryMax: 200000,
      salaryCurrency: "USD",
      salaryPeriod: "YEARLY",
    }, NOW);
    expect(result.salaryMin).toBe(70000);
    expect(result.salaryMax).toBe(90000);
    expect(result.salaryCurrency).toBe("EUR");
  });
});
