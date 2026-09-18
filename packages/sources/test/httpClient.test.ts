import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, HttpError } from "../src/shared/httpClient.js";

describe("fetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const result = await fetchJson<{ ok: boolean }>("https://example.com/api");
    expect(result).toEqual({ ok: true });
  });

  it("retries on 429 and eventually succeeds", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        if (calls < 3) return new Response("rate limited", { status: 429 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    const result = await fetchJson<{ ok: boolean }>("https://example.com/api", {
      maxRetries: 3,
      backoffBaseMs: 1,
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it("fails immediately on a non-retryable 404 without retrying", async () => {
    const fetchSpy = vi.fn(async () => new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchJson("https://example.com/missing", { maxRetries: 3, backoffBaseMs: 1 })).rejects.toThrow(
      HttpError,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries on persistent 500s", async () => {
    const fetchSpy = vi.fn(async () => new Response("server error", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchJson("https://example.com/api", { maxRetries: 2, backoffBaseMs: 1 })).rejects.toThrow(
      HttpError,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });
});
