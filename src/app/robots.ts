import type { MetadataRoute } from "next";
import { isJobCatalogEnabled } from "../modules/job-catalog/application/config";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  return {
    rules: {
      allow: isJobCatalogEnabled() ? ["/", "/intelligence/", "/jobs/"] : ["/", "/intelligence/"],
      disallow: ["/admin/", "/api/", "/auth/", "/member/"],
      userAgent: "*",
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
