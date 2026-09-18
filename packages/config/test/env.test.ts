import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  it("parses a minimal valid environment with sensible defaults", () => {
    const env = loadEnv({ DATABASE_URL: "postgresql://localhost/db" });
    expect(env.DATABASE_URL).toBe("postgresql://localhost/db");
    expect(env.NODE_ENV).toBe("development");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("throws a clear, listed error when required variables are missing", () => {
    expect(() => loadEnv({})).toThrowError(/DATABASE_URL/);
  });

  it("rejects an invalid enum value", () => {
    expect(() =>
      loadEnv({ DATABASE_URL: "postgresql://localhost/db", NODE_ENV: "staging" }),
    ).toThrow();
  });

  it("honors explicitly provided overrides", () => {
    const env = loadEnv({
      DATABASE_URL: "postgresql://localhost/db",
      REDIS_URL: "redis://redis:6380",
      LOG_LEVEL: "debug",
      NODE_ENV: "production",
    });
    expect(env.REDIS_URL).toBe("redis://redis:6380");
    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.NODE_ENV).toBe("production");
  });
});
