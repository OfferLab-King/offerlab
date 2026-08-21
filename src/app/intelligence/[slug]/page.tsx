import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IntelligenceReportDetail,
  intelligenceReportTitle,
} from "../../components/intelligence-report";
import { readPublicIntelligenceReport } from "../../../modules/recruitment-intelligence/application/reports";
import { recruitmentStageLabel } from "../../../modules/taxonomy/domain/display-labels";
import { SiteHeader } from "../../components/site-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const report = await readPublicIntelligenceReport((await params).slug);
  if (!report) return { openGraph: { images: [] }, twitter: { images: [] } };
  const title = `${intelligenceReportTitle(report)} experience (${report.recruitmentCycle}) | OfferLab`;
  const description = `${report.formatSummary} Read a moderated ${report.recruitmentCycle} ${recruitmentStageLabel(report.recruitmentStage).toLowerCase()} experience and preparation preview.`;
  return {
    alternates: { canonical: `/intelligence/${report.slug}` },
    description,
    openGraph: { description, images: [], title, type: "article" },
    title,
    twitter: { description, images: [], title },
  };
}

export default async function PublicIntelligenceReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const report = await readPublicIntelligenceReport((await params).slug);
  if (!report) notFound();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    about: `${report.companyName} ${report.roleTitle} graduate recruitment`,
    datePublished: report.moderatedAt ?? report.approximateDate,
    description: report.formatSummary,
    headline: `${intelligenceReportTitle(report)} experience (${report.recruitmentCycle})`,
    publisher: { "@type": "Organization", name: "OfferLab" },
  };
  return (
    <>
      <SiteHeader />
      <main className="public-intelligence-detail-page">
        <div className="intelligence-back-link">
          <Link href="/intelligence">← All recruitment experiences</Link>
        </div>
        <IntelligenceReportDetail preview report={report} />
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</gu, "\\u003c"),
          }}
          type="application/ld+json"
        />
      </main>
    </>
  );
}
