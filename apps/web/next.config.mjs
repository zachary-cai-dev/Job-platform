/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma's generated client isn't meant to be bundled by webpack/turbopack for
  // server components/route handlers — keep it external so it runs as plain
  // Node.js, per Prisma + Next.js App Router guidance.
  // isomorphic-dompurify's jsdom dependency reads a default-stylesheet.css resource
  // relative to its own package at runtime — webpack bundling breaks that lookup
  // (ENOENT for a file that's never copied into .next/server). Same fix as Prisma:
  // keep it external so it runs as plain, unbundled Node.js.
  serverExternalPackages: ["@prisma/client", "isomorphic-dompurify", "jsdom"],

  // Workspace packages (packages/*) are raw TypeScript source, not pre-built
  // node_modules packages — tell Next to run its own compilation pipeline over
  // them, rather than the default "treat anything under node_modules as an
  // opaque external server package" behavior for Server Components/Route Handlers.
  transpilePackages: ["@euro-jobs/db", "@euro-jobs/search", "@euro-jobs/config", "@euro-jobs/shared"],

  // HISTORICAL NOTE, kept so this doesn't get "discovered" again: `next dev`'s
  // per-route compilation used to break `packages/search`'s dynamic search query
  // in a way that looked module/bundling-related (raw WHERE-clause SQL getting
  // serialized as a jsonb parameter instead of inlined — Postgres error 42804,
  // reproducing consistently in dev, never in a production build). It was NOT a
  // module-instance mismatch, and `transpilePackages` above doesn't fix it —
  // the real root cause was nesting `Prisma.Sql` values from one `Prisma.sql`
  // template into another outer `$queryRaw` template, a composition pattern that
  // breaks under this Next.js/webpack/Prisma combination in dev. The actual fix
  // eliminates `Prisma.Sql` composition entirely for that query, in favor of a
  // hand-rolled `SqlFragment` type executed via `$queryRawUnsafe` — see the doc
  // comment at the top of packages/search/src/postgresJobSearchService.ts for the
  // full writeup. No config-level workaround is needed anymore.

  webpack: (config) => {
    // The workspace packages are TypeScript-NodeNext style: they import
    // "./foo.js" while the file on disk is "./foo.ts" (standard practice for
    // Node ESM + tsc, resolved fine by tsx/tsc/vitest). Webpack's default resolver
    // doesn't know that convention, so extend it to also try .ts/.tsx for a ".js"
    // specifier before falling back to an actual .js file.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
