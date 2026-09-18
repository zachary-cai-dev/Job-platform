import type { MetadataRoute } from "next";

/** The whole site now sits behind sign-in (see app/(public)/layout.tsx) — nothing to advertise. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
