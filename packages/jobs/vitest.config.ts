import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Integration tests hit the live database (Supabase) and are excluded from the
    // default `pnpm test` run so CI/local runs stay fast and offline-capable — run
    // them explicitly with `pnpm test:integration`.
    exclude: ["test/integration/**", "**/node_modules/**"],
  },
});
