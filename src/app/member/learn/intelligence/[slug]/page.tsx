import Link from "next/link";
import { notFound } from "next/navigation";
import { IntelligenceReportDetail } from "../../../../components/intelligence-report";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { readIntelligenceReport } from "../../../../../modules/recruitment-intelligence/application/reports";
import { readIntelligenceDiscussion } from "../../../../../modules/recruitment-intelligence/application/community";
import { LearnNavigation } from "../../learn-navigation";
import { IntelligenceDiscussion } from "./intelligence-discussion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemberIntelligenceReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ discussion?: string }>;
}) {
  const { userId } = await requireMember();
  const slug = (await params).slug;
  const report = await readIntelligenceReport(userId, slug);
  if (!report || report.moderationState !== "published") notFound();
  const [discussion, query] = await Promise.all([
    readIntelligenceDiscussion(userId, report.id),
    searchParams,
  ]);
  return (
    <main className="applications-shell intelligence-report-page">
      <LearnNavigation active="intelligence" />
      <div className="intelligence-back-link">
        <Link href="/member/learn/intelligence">← All intelligence reports</Link>
      </div>
      <IntelligenceReportDetail report={report} />
      <IntelligenceDiscussion
        agreementAccepted={discussion.agreementAccepted}
        comments={discussion.comments}
        reportId={report.id}
        slug={slug}
        {...(query.discussion ? { result: query.discussion } : {})}
      />
    </main>
  );
}
