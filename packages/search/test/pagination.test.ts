import { describe, expect, it } from "vitest";
import { normalizePagination, totalPages } from "../src/pagination.js";

describe("normalizePagination", () => {
  it("defaults to page 1, pageSize 20", () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 20, offset: 0 });
  });

  it("computes offset correctly", () => {
    expect(normalizePagination({ page: 3, pageSize: 10 })).toEqual({ page: 3, pageSize: 10, offset: 20 });
  });

  it("clamps page below 1 up to 1", () => {
    expect(normalizePagination({ page: 0 }).page).toBe(1);
    expect(normalizePagination({ page: -5 }).page).toBe(1);
  });

  it("clamps pageSize to [1, 100]", () => {
    expect(normalizePagination({ pageSize: 0 }).pageSize).toBe(1);
    expect(normalizePagination({ pageSize: 500 }).pageSize).toBe(100);
  });

  it("floors non-integer input", () => {
    expect(normalizePagination({ page: 2.9 }).page).toBe(2);
  });
});

describe("totalPages", () => {
  it("computes ceiling division", () => {
    expect(totalPages(45, 20)).toBe(3);
    expect(totalPages(40, 20)).toBe(2);
  });

  it("is at least 1 even for zero results", () => {
    expect(totalPages(0, 20)).toBe(1);
  });
});
