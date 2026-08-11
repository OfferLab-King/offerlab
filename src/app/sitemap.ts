import type { MetadataRoute } from "next";
import { readPublicIntelligenceReports } from "../modules/recruitment-intelligence/application/reports";
import { readSitemapEmployers, readSitemapJobs } from "../modules/job-catalog/application/catalog";
import { isJobCatalogEnabled } from "../modules/job-catalog/application/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const [reports, jobs, employers] = await Promise.all([
    readPublicIntelligenceReports({ query: "" }),
    isJobCatalogEnabled() ? readSitemapJobs(10_000) : Promise.resolve([]),
    isJobCatalogEnabled() ? readSitemapEmployers(10_000) : Promise.resolve([]),
  ]);
  return [
    { changeFrequency: "weekly", priority: 1, url: new URL("/", base).toString() },
    {
      changeFrequency: "daily",
      priority: 0.9,
      url: new URL("/intelligence", base).toString(),
    },
    ...(isJobCatalogEnabled()
      ? [
          {
            changeFrequency: "daily" as const,
            priority: 0.9,
            url: new URL("/jobs", base).toString(),
          },
          {
            changeFrequency: "weekly" as const,
            priority: 0.7,
            url: new URL("/employers", base).toString(),
          },
        ]
      : []),
    ...jobs.map((job) => ({
      changeFrequency: "daily" as const,
      lastModified: new Date(job.last_changed_at),
      priority: 0.7,
      url: new URL(`/jobs/${job.slug}`, base).toString(),
    })),
    ...employers.map((employer) => ({
      changeFrequency: "weekly" as const,
      lastModified: new Date(employer.last_modified),
      priority: 0.6,
      url: new URL(`/employers/${employer.slug}`, base).toString(),
    })),
    ...reports.map((report) => ({
      changeFrequency: "monthly" as const,
      lastModified: report.moderatedAt ? new Date(report.moderatedAt) : undefined,
      priority: 0.8,
      url: new URL(`/intelligence/${report.slug}`, base).toString(),
    })),
  ];
}
