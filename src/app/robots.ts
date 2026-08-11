import type { MetadataRoute } from "next";
import { isJobCatalogEnabled } from "../modules/job-catalog/application/config";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  return {
    rules: {
      // The employer route family is explicitly crawlable. Filtered directory
      // and catalogue query URLs are controlled with per-page noindex metadata,
      // not robots.txt, so legitimate profiles stay crawlable.
      allow: isJobCatalogEnabled()
        ? ["/", "/employers/", "/jobs/", "/intelligence/"]
        : ["/", "/intelligence/"],
      disallow: ["/admin/", "/api/", "/auth/", "/member/"],
      userAgent: "*",
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
