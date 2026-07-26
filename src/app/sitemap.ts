import type { MetadataRoute } from "next";
import { readPublicIntelligenceReports } from "../modules/recruitment-intelligence/application/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const reports = await readPublicIntelligenceReports({ query: "" });
  return [
    { changeFrequency: "weekly", priority: 1, url: new URL("/", base).toString() },
    {
      changeFrequency: "daily",
      priority: 0.9,
      url: new URL("/intelligence", base).toString(),
    },
    ...reports.map((report) => ({
      changeFrequency: "monthly" as const,
      lastModified: report.moderatedAt ? new Date(report.moderatedAt) : undefined,
      priority: 0.8,
      url: new URL(`/intelligence/${report.slug}`, base).toString(),
    })),
  ];
}
