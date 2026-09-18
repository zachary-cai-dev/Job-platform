import type { MetadataRoute } from "next";

/** The whole site now sits behind sign-in (see app/(public)/layout.tsx) — nothing here is crawlable. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
